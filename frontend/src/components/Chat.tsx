import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../lib/types";
import Spinner from "./Spinner";
import ElementProperties from "./ElementProperties";

interface ChatLite {
  id: string;
  title: string;
}

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  status: string;
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
  hasPage: boolean;
  hasSession: boolean;
  chats: ChatLite[];
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onNewChat: () => void;
  rewriteText: boolean;
  onRewriteTextChange: (v: boolean) => void;
  html: string;
  onStyleChange: (dataId: string, styles: Record<string, string>) => void;
  onHtmlChange: (html: string) => void;
}

export default function Chat({
  messages,
  streaming,
  status,
  onSend,
  onStop,
  disabled,
  hasPage,
  hasSession,
  chats,
  currentChatId,
  onSelectChat,
  onDeleteChat,
  onNewChat,
  rewriteText,
  onRewriteTextChange,
  html,
  onStyleChange,
  onHtmlChange,
}: Props) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Poll DOM for selected element
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      const el = document.querySelector(".canvas-scope .b-editing, .canvas-scope .b-selected");
      const id = el?.getAttribute("data-id") || null;
      setSelectedId((prev) => (prev !== id ? id : prev));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Right panel tab: chat or selected
  const [rightTab, setRightTab] = useState<"chat" | "selected">("chat");

  // Auto-switch to selected tab when element is selected
  useEffect(() => {
    if (selectedId) setRightTab("selected");
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || disabled) return;
    onSend(v);
    setText("");
  };

  const placeholder = hasPage ? "Ask for a change…" : "Describe the website you want to build…";

  return (
    <div className="flex h-full flex-col bg-obsidian">
      {/* Tabs: Chat / Selected */}
      <div className="flex border-b border-charcoal">
        <button
          onClick={() => setRightTab("chat")}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] uppercase tracking-[0.14em] transition ${
            rightTab === "chat"
              ? "border-b-2 border-accent text-accent"
              : "text-smoke hover:text-silver"
          }`}
        >
          <ChatIcon />
          Conversations
        </button>
        <button
          onClick={() => setRightTab("selected")}
          disabled={!selectedId}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] uppercase tracking-[0.14em] transition ${
            rightTab === "selected"
              ? "border-b-2 border-accent text-accent"
              : selectedId
                ? "text-smoke hover:text-silver"
                : "cursor-not-allowed text-graphite/40"
          }`}
        >
          <TargetIcon />
          Selected
          {selectedId && rightTab !== "selected" && (
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          )}
        </button>
      </div>

      {rightTab === "chat" ? (
        <>
          {/* conversations list */}
          {hasSession && (
            <div className="border-b border-charcoal">
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-[11px] uppercase tracking-[0.14em] text-smoke">Chats</span>
                <button
                  onClick={onNewChat}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-accent transition hover:bg-accent/10"
                >
                  <PlusIcon />
                  New
                </button>
              </div>
              <ul className="scroll-thin max-h-28 overflow-auto pb-1.5">
                {chats.length === 0 && (
                  <li className="px-3 py-1 text-xs text-smoke">No chats yet.</li>
                )}
                {chats.map((c) => {
                  const active = c.id === currentChatId;
                  return (
                    <li key={c.id} className="group flex items-center pr-1.5">
                      <button
                        onClick={() => onSelectChat(c.id)}
                        className={`flex-1 truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                          active ? "bg-accent/10 text-accent" : "text-silver hover:bg-white/[0.04]"
                        }`}
                        style={{ fontWeight: active ? 500 : 400 }}
                      >
                        {c.title || "New chat"}
                      </button>
                      <button
                        onClick={() => onDeleteChat(c.id)}
                        className="rounded p-1 text-graphite opacity-0 transition hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                        title="Delete chat"
                        aria-label={`Delete chat ${c.title || "New chat"}`}
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* messages */}
          <div ref={scrollRef} className="scroll-thin flex-1 space-y-4 overflow-auto p-4">
            {messages.length === 0 ? (
              hasPage ? (
                <div className="mt-8 text-center text-xs leading-relaxed text-smoke">
                  Ask for a change — e.g. <span className="text-silver">"make the hero darker"</span> or{" "}
                  <span className="text-silver">"add a pricing section"</span>.
                </div>
              ) : (
                <StartState onPick={onSend} disabled={streaming} />
              )
            ) : (
              messages.map((m) => (
                <ChatBubble key={m.id} message={m} status={m.pending ? status : ""} />
              ))
            )}
          </div>

          {/* composer */}
          <form onSubmit={submit} className="border-t border-charcoal p-3">
            <div className="flex items-end gap-2 rounded-lg border border-line bg-obsidian px-3 py-2 transition focus-within:border-accent">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(e);
                  }
                }}
                rows={1}
                placeholder={placeholder}
                disabled={disabled && !streaming}
                aria-label={placeholder}
                className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-snow outline-none placeholder:text-smoke focus:outline-none"
              />
              {!hasPage && (
                <button
                  type="button"
                  onClick={() => onRewriteTextChange(!rewriteText)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                    rewriteText
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-line text-smoke hover:text-silver"
                  }`}
                  title="Rewrite prompt before generating"
                >
                  <PenIcon />
                </button>
              )}
              <button
                type={streaming ? "button" : "submit"}
                onClick={streaming ? onStop : undefined}
                disabled={!streaming && (!text.trim() || disabled)}
                aria-label={streaming ? "Stop generating" : "Send message"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent bg-accent text-obsidian transition hover:border-accent-deep hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-smoke"
              >
                {streaming ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="6" width="12" height="12" rx="1.5" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </>
      ) : (
        /* Selected tab — element properties */
        <div className="scroll-thin flex-1 overflow-auto p-3">
          <ElementProperties
            selectedId={selectedId}
            html={html}
            onStyleChange={onStyleChange}
            onHtmlChange={onHtmlChange}
          />
        </div>
      )}
    </div>
  );
}

function StartState({ onPick, disabled }: { onPick: (p: string) => void; disabled: boolean }) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center text-accent">
          <SparkleIcon />
        </span>
        <h3 className="text-sm text-snow" style={{ fontWeight: 500 }}>
          What do you want to build?
        </h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-silver">
        Type below or pick a starting point. The AI designs it on the canvas — then refine it here.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            disabled={disabled}
            onClick={() => onPick(s)}
            className="group flex items-center justify-between gap-2 rounded-lg border border-charcoal bg-obsidian px-3 py-2.5 text-left text-xs text-silver transition hover:border-accent/50 hover:text-snow disabled:opacity-40"
          >
            {s}
            <span className="text-graphite transition group-hover:text-accent">
              <ArrowRight />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ message, status }: { message: ChatMessage; status?: string }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-accent">
          <SparkleIcon small />
        </span>
      )}
      <div
        className={`max-w-[82%] whitespace-pre-wrap px-3.5 py-2 text-sm leading-relaxed ${
          isUser
            ? "rounded-2xl rounded-br-md border border-charcoal bg-ash text-snow"
            : message.error
              ? "rounded-2xl rounded-bl-md border border-danger/40 bg-danger/10 text-danger"
              : "rounded-2xl rounded-bl-md border border-charcoal bg-transparent text-silver"
        }`}
      >
        {message.content}
        {message.pending && (
          <span className="ml-1.5 inline-flex items-center gap-1.5 align-middle text-smoke">
            {status && <span className="text-xs">{status}</span>}
            <Spinner size={18} />
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- icons ---------- */
function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
function SparkleIcon({ small = false }: { small?: boolean }) {
  const s = small ? 14 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function PenIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

const SUGGESTIONS = [
  "A saas landing page with pricing",
  "A portfolio for a photographer",
  "A coming soon page for a launch",
  "A pricing page for an api product",
  "A simple coming soon page",
];
