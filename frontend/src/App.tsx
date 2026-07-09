import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Routes, Route, useParams, useNavigate } from "react-router-dom";
import Canvas from "./components/Canvas";
import Chat from "./components/Chat";
import Landing from "./components/Landing";
import LeftPanel from "./components/LeftPanel";
import { BrandMark } from "./components/BrandMark";
import {
  addMessage,
  createChat,
  createSession,
  deleteChat,
  deleteSession,
  getChat,
  getPage,
  getSession,
  getMe,
  listSessions,
  logout,
  openSSE,
  updateMessageContent,
  updatePageHtml,
} from "./lib/api";
import { wrapHtmlForExport } from "./lib/export";
import type { ChatMessage, User } from "./lib/types";

type Device = "desktop" | "tablet" | "mobile";

const AUTH_ENABLED = !import.meta.env.DEV;
const uid = () => Math.random().toString(36).slice(2, 10);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Workspace />} />
      <Route path="/app/session/:sessionId" element={<Workspace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
}

interface SessionLite {
  id: string;
  title: string;
  updated_at?: string;
}
interface ChatLite {
  id: string;
  title: string;
}

function Workspace() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [chats, setChats] = useState<ChatLite[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [html, setHtml] = useState<string>("");
  const [pageId, setPageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rewriteText, setRewriteText] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!AUTH_ENABLED);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeChatIdRef = useRef<string | null>(null);
  const pendingPromptRef = useRef<string | null>(null);
  const htmlBufferRef = useRef<string>("");

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Auth check — production only
  useEffect(() => {
    if (!AUTH_ENABLED) return;
    getMe().then((u) => {
      setAuthUser(u);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    listSessions().then(setSessions).catch(() => {});
  }, []);

  // Poll DOM for selected element
  useEffect(() => {
    const interval = setInterval(() => {
      const el = document.querySelector(".canvas-scope .b-editing, .canvas-scope .b-selected");
      const id = el?.getAttribute("data-id") || null;
      setSelectedId((prev) => (prev !== id ? id : prev));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const loadChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId);
    setMessages([]);
    setSelectedId(null);
    try {
      const chat = await getChat(chatId);
      const restored: ChatMessage[] = (chat.messages || []).map((m) => ({
        id: m.id || uid(),
        backendId: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      setMessages(restored);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch {
      /* ignore */
    }
  }, []);

  const refreshChats = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await getSession(sessionId);
      setChats(s.chats || []);
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  // ---------- generate ----------
  const generateInto = useCallback(
    (chatId: string, prompt: string) => {
      setStreaming(true);
      setStatus("Starting…");
      setSelectedId(null);
      htmlBufferRef.current = "";
      setHtml("");

      const userMsg: ChatMessage = { id: uid(), role: "user", content: prompt };
      const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "", pending: true };
      setMessages([userMsg, assistantMsg]);

      addMessage(chatId, "user", prompt)
        .then((r) => {
          if (r?.id) setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, backendId: r.id } : m)));
        })
        .catch(() => {});

      abortRef.current = openSSE(
        "/api/generate",
        { prompt, chat_id: chatId, rewrite_text: rewriteText },
        (evt) => {
          switch (evt.event) {
            case "status":
              setStatus(evt.data.message);
              break;
            case "delta":
              htmlBufferRef.current += evt.data.chunk;
              setHtml(htmlBufferRef.current);
              break;
            case "complete":
              setHtml(evt.data.html);
              setPageId(evt.data.page_id);
              htmlBufferRef.current = evt.data.html;
              finishAssistant(assistantMsg.id, "Done — your page is on the canvas. Ask me to change anything.");
              setStatus("");
              break;
            case "error":
              setErrorOn(assistantMsg.id, "Error: " + evt.data.message);
              setStatus("");
              break;
          }
        },
        () => setErrorOn(assistantMsg.id, "Network error during generation."),
        () => {
          setStreaming(false);
          setStatus("");
          refreshSessions();
          refreshChats();
        },
      );
    },
    [refreshSessions, refreshChats, rewriteText],
  );

  const handleGenerate = useCallback(
    (prompt: string) => {
      if (!activeChatId) return;
      generateInto(activeChatId, prompt);
    },
    [activeChatId, generateInto],
  );

  // Load session + chats whenever the routed session changes.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStatus("");

    if (!sessionId) {
      setChats([]);
      setActiveChatId(null);
      setHtml("");
      setPageId(null);
      setMessages([]);
      setSelectedId(null);
      return;
    }
    setHtml("");
    setPageId(null);
    setMessages([]);
    setSelectedId(null);
    setActiveChatId(null);

    getSession(sessionId)
      .then(async (session) => {
        setChats(session.chats || []);
        if (session.page_id) {
          setPageId(session.page_id);
          try {
            const p = await getPage(session.page_id);
            setHtml(p.html);
          } catch {
            setHtml("");
          }
        }
        let firstChat = (session.chats || [])[0];
        if (!firstChat) {
          const newChat = await createChat(sessionId);
          if (!newChat?.id) return;
          firstChat = newChat;
          setChats([firstChat]);
        }
        await loadChat(firstChat.id);
        const pending = pendingPromptRef.current;
        if (pending) {
          pendingPromptRef.current = null;
          generateInto(firstChat.id, pending);
        }
      })
      .catch(() => {});
  }, [sessionId, loadChat, generateInto]);

  // ---------- edit ----------
  const handleEdit = useCallback(
    (instruction: string) => {
      if (!pageId || !activeChatId) return;
      setStreaming(true);
      setStatus("Editing…");

      const userMsg: ChatMessage = { id: uid(), role: "user", content: instruction };
      const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "", pending: true };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      addMessage(activeChatId, "user", instruction)
        .then((r) => {
          if (r?.id) setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, backendId: r.id } : m)));
        })
        .catch(() => {});

      abortRef.current = openSSE(
        "/api/edit",
        { page_id: pageId, instruction, focus_id: selectedId, chat_id: activeChatId },
        (evt) => {
          switch (evt.event) {
            case "status":
              setStatus(evt.data.message);
              break;
            case "delta":
              break;
            case "complete":
              setHtml(evt.data.html);
              htmlBufferRef.current = evt.data.html;
              const editSummary = evt.data.summary || (evt.data.errors?.length
                ? `Done (${evt.data.errors.length} notes).`
                : "Done. Ask for more changes.");
              finishAssistant(assistantMsg.id, editSummary);
              setStatus("");
              break;
            case "error":
              setErrorOn(assistantMsg.id, "Error: " + evt.data.message);
              setStatus("");
              break;
          }
        },
        () => setErrorOn(assistantMsg.id, "Network error during edit."),
        () => {
          setStreaming(false);
          setStatus("");
          refreshChats();
        },
      );
    },
    [pageId, activeChatId, selectedId, refreshChats],
  );

  function finishAssistant(id: string, content: string) {
    const msg = messagesRef.current.find((m) => m.id === id);
    if (msg) {
      if (msg.backendId) {
        updateMessageContent(msg.backendId, content).catch(() => {});
      } else if (activeChatIdRef.current) {
        addMessage(activeChatIdRef.current, "assistant", content)
          .then((r) => {
            if (r?.id) setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, backendId: r.id } : m)));
          })
          .catch(() => {});
      }
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, pending: false } : m)));
  }

  function setErrorOn(id: string, content: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, pending: false, error: true } : m)));
  }

  const handleSend = useCallback(
    async (text: string) => {
      if (streaming) return;
      // Auth gate: show popup if not logged in (production only)
      if (AUTH_ENABLED && !authUser) {
        setShowLoginPopup(true);
        return;
      }
      if (pageId) {
        handleEdit(text);
        return;
      }
      if (activeChatId) {
        handleGenerate(text);
        return;
      }
      if (sessionId) return;
      try {
        const s = await createSession();
        if (!s?.id) return;
        setSessions((prev) => [s, ...prev]);
        pendingPromptRef.current = text;
        navigate(`/app/session/${s.id}`);
      } catch {
        /* ignore */
      }
    },
    [streaming, pageId, sessionId, activeChatId, handleEdit, handleGenerate, navigate, authUser],
  );

  // ---------- chat management ----------
  const handleNewChat = useCallback(async () => {
    if (!sessionId) return;
    if (AUTH_ENABLED && !authUser) {
      setShowLoginPopup(true);
      return;
    }
    const chat = await createChat(sessionId);
    if (!chat?.id) return;
    setChats((prev) => [...prev, chat]);
    await loadChat(chat.id);
    refreshChats();
  }, [sessionId, loadChat, refreshChats, authUser]);

  const handleDeleteChat = useCallback(
    async (id: string) => {
      await deleteChat(id);
      const remaining = chats.filter((c) => c.id !== id);
      setChats(remaining);
      if (id === activeChatId) {
        if (remaining.length) await loadChat(remaining[0].id);
        else {
          setActiveChatId(null);
          setHtml("");
          setPageId(null);
          setMessages([]);
        }
      }
      refreshChats();
    },
    [chats, activeChatId, loadChat, refreshChats],
  );

  // ---------- session management ----------
  const handleNewSession = useCallback(async () => {
    if (AUTH_ENABLED && !authUser) {
      setShowLoginPopup(true);
      return;
    }
    const s = await createSession();
    if (!s?.id) return;
    navigate(`/app/session/${s.id}`);
    refreshSessions();
  }, [navigate, refreshSessions, authUser]);

  const handleSelectSession = useCallback((id: string) => navigate(`/app/session/${id}`), [navigate]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession(id);
      refreshSessions();
      if (id === sessionId) navigate("/app");
    },
    [sessionId, navigate, refreshSessions],
  );

  const handleExport = useCallback(async () => {
    if (!pageId) return;
    try {
      const page = await getPage(pageId);
      const fullHtml = wrapHtmlForExport(page.html, page.title);
      const blob = new Blob([fullHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "page.html";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }, [pageId]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setStatus("");
    setMessages((prev) =>
      prev.map((m) =>
        m.pending
          ? { ...m, pending: false, content: m.content || "(stopped)" }
          : m,
      ),
    );
  }, []);

  const saveTimer = useRef<number | null>(null);
  const handleHtmlChange = useCallback(
    (next: string) => {
      setHtml(next);
      htmlBufferRef.current = next;
      if (!pageId) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        updatePageHtml(pageId, next).catch(() => {});
      }, 700);
    },
    [pageId],
  );

  const handleStyleChange = useCallback(
    (dataId: string, styles: Record<string, string>) => {
      const styleStr = Object.entries(styles)
        .filter(([, v]) => v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      const escapedId = dataId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(
        `(<[^>]*?data-id="${escapedId}"[^>]*?)style="[^"]*"`,
        "i",
      );
      let next: string;
      if (regex.test(html)) {
        next = html.replace(regex, `$1style="${styleStr}"`);
      } else {
        const tagRegex = new RegExp(
          `(<[^>]*?data-id="${escapedId}"[^>]*?)(/?>)`,
          "i",
        );
        next = html.replace(tagRegex, `$1style="${styleStr}"$2`);
      }
      handleHtmlChange(next);
    },
    [html, handleHtmlChange],
  );

  const handleLogout = useCallback(async () => {
    await logout();
    setAuthUser(null);
    window.location.href = "/";
  }, []);

  const isEmpty = !html.trim();

  // Show nothing while checking auth (production)
  if (AUTH_ENABLED && !authChecked) return null;

  return (
    <div className="flex h-full w-full flex-col bg-obsidian text-snow">
      <TopBar authUser={AUTH_ENABLED ? authUser : null} onLogout={handleLogout} />
      <div className="flex flex-1 overflow-hidden">
        {leftOpen ? (
          <aside className="relative w-60 shrink-0 border-r border-charcoal bg-obsidian">
            <LeftPanel
              sessions={sessions}
              currentSessionId={sessionId ?? null}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              onNewSession={handleNewSession}
              html={html}
            />
            <button
              onClick={() => setLeftOpen(false)}
              aria-label="Hide projects panel"
              title="Hide projects panel"
              className="absolute -right-3 top-4 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-charcoal bg-obsidian text-silver transition hover:border-graphite hover:text-snow"
            >
              <ChevronLeft />
            </button>
          </aside>
        ) : (
          <div className="flex w-10 shrink-0 flex-col items-center border-r border-charcoal bg-obsidian pt-4">
            <button
              onClick={() => setLeftOpen(true)}
              aria-label="Show projects panel"
              title="Show projects panel"
              className="flex h-8 w-8 items-center justify-center rounded-full text-silver transition hover:bg-white/[0.04] hover:text-snow"
            >
              <ChevronRight />
            </button>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-hidden">
            <Canvas
              html={html}
              streaming={streaming}
              device={device}
              onDeviceChange={setDevice}
            canExport={!!pageId}
            onExport={handleExport}
            onHtmlChange={handleHtmlChange}
            isEmpty={isEmpty}
          />
        </main>

        <aside className="w-[360px] shrink-0 overflow-hidden border-l border-charcoal bg-obsidian">
          <Chat
            messages={messages}
            streaming={streaming}
            status={status}
            onSend={handleSend}
            onStop={handleStop}
            disabled={streaming}
            hasPage={!!pageId}
            hasSession={!!sessionId}
            chats={chats}
            currentChatId={activeChatId}
            onSelectChat={loadChat}
            onDeleteChat={handleDeleteChat}
            onNewChat={handleNewChat}
            rewriteText={rewriteText}
            onRewriteTextChange={setRewriteText}
            html={html}
            onStyleChange={handleStyleChange}
            onHtmlChange={handleHtmlChange}
          />
        </aside>
      </div>

      {/* Login popup */}
      {showLoginPopup && (
        <LoginPopup onClose={() => setShowLoginPopup(false)} />
      )}
    </div>
  );
}

function LoginPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-charcoal bg-obsidian p-8 text-center shadow-2xl">
        <div className="mb-4 flex justify-center">
          <BrandMark />
        </div>
        <h2 className="text-lg text-snow" style={{ fontWeight: 500 }}>
          Sign in to continue
        </h2>
        <p className="mt-2 text-sm text-silver">
          You need a GitHub account to generate and save websites.
        </p>
        <a
          href="/api/auth/github/login"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-5 py-2.5 text-sm text-snow transition hover:border-graphite hover:bg-white/[0.08]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Sign in with GitHub
        </a>
        <button
          onClick={onClose}
          className="mt-4 block w-full text-center text-xs text-smoke transition hover:text-silver"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function TopBar({ authUser, onLogout }: { authUser: User | null; onLogout: () => void }) {
  return (
    <header className="flex h-14 items-center border-b border-charcoal bg-obsidian px-4">
      <Link to="/" className="flex items-center gap-2">
        <BrandMark />
        <span className="text-[15px] tracking-tight text-snow">ai-web</span>
      </Link>
      <div className="ml-auto flex items-center gap-3">
        {AUTH_ENABLED && authUser && (
          <>
            {authUser.avatar_url && (
              <img
                src={authUser.avatar_url}
                alt={authUser.login}
                className="h-7 w-7 rounded-full"
              />
            )}
            <span className="text-xs text-silver">{authUser.login}</span>
            <button
              onClick={onLogout}
              className="rounded px-2 py-1 text-xs text-silver transition hover:bg-white/[0.04] hover:text-snow"
            >
              Logout
            </button>
          </>
        )}
        {AUTH_ENABLED && !authUser && (
          <a
            href="/api/auth/github/login"
            className="rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-xs text-silver transition hover:border-graphite hover:text-snow"
          >
            Sign in
          </a>
        )}
      </div>
    </header>
  );
}
