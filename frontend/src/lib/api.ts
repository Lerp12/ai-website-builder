import type { Page, PageSummary, User } from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

// ── auth ────────────────────────────────────────────────────────────────
export async function getMe(): Promise<User | null> {
  try {
    const r = await fetch("/api/auth/me");
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function getHealth(): Promise<{ ok: boolean; has_key: boolean; model: string }> {
  const r = await fetch("/api/health");
  return r.json();
}

export async function listPages(): Promise<PageSummary[]> {
  const r = await fetch("/api/pages");
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

export async function getPage(id: string): Promise<Page> {
  const r = await fetch(`/api/pages/${id}`);
  if (!r.ok) throw new Error("page not found");
  return r.json();
}

export async function deletePage(id: string): Promise<void> {
  await fetch(`/api/pages/${id}`, { method: "DELETE" });
}

export async function updatePageHtml(pid: string, html: string): Promise<void> {
  await fetch(`/api/pages/${pid}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(html),
  });
}

export async function exportHtml(pageId: string): Promise<string> {
  const r = await fetch("/api/export", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ page_id: pageId }),
  });
  if (!r.ok) throw new Error("export failed");
  return r.text();
}

/** POST to an SSE endpoint; stream parsed events out via callbacks. Returns an AbortController. */
export function openSSE(
  url: string,
  body: unknown,
  onEvent: (evt: { event: string; data: any }) => void,
  onError: (err: Error) => void,
  onDone: () => void,
): AbortController {
  const controller = new AbortController();
  fetch(url, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (resp) => {
      if (!resp.ok || !resp.body) {
        onError(new Error(`HTTP ${resp.status}`));
        onDone();
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const evt = parseSSEFrame(frame);
          if (evt) onEvent(evt);
        }
      }
      onDone();
    })
    .catch((e) => {
      if (e.name !== "AbortError") {
        onError(e instanceof Error ? e : new Error(String(e)));
        onDone();
      }
    });
  return controller;
}

function parseSSEFrame(frame: string): { event: string; data: any } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return { event, data: { raw: dataLines.join("\n") } };
  }
}

// ---------------------------------------------------------------- sessions
export interface SessionSummary {
  id: string;
  title: string;
  page_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionDetail extends SessionSummary {
  chats: ChatSummary[];
}

export async function listSessions(): Promise<SessionSummary[]> {
  const r = await fetch("/api/sessions");
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

export async function getSession(id: string): Promise<SessionDetail> {
  const r = await fetch(`/api/sessions/${id}`);
  if (!r.ok) throw new Error("session not found");
  return r.json();
}

export async function createSession(title?: string): Promise<SessionSummary | null> {
  const r = await fetch("/api/sessions", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ title: title || "New Session" }),
  });
  if (!r.ok) return null;
  return r.json();
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`/api/sessions/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------- chats
export interface ChatSummary {
  id: string;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatDetail extends ChatSummary {
  messages: { id: string; role: string; content: string }[];
}

export async function listChatsForSession(sessionId: string): Promise<ChatSummary[]> {
  const r = await fetch(`/api/sessions/${sessionId}/chats`);
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

export async function getChat(id: string): Promise<ChatDetail> {
  const r = await fetch(`/api/chats/${id}`);
  if (!r.ok) throw new Error("chat not found");
  return r.json();
}

export async function createChat(sessionId: string, title?: string): Promise<ChatSummary | null> {
  const r = await fetch(`/api/sessions/${sessionId}/chats`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ title: title || "New Chat" }),
  });
  if (!r.ok) return null;
  return r.json();
}

export async function deleteChat(id: string): Promise<void> {
  await fetch(`/api/chats/${id}`, { method: "DELETE" });
}

export async function addMessage(chatId: string, role: string, content: string): Promise<{ id: string } | null> {
  const r = await fetch(`/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ role, content }),
  });
  if (!r.ok) return null;
  return r.json();
}

export async function updateMessageContent(messageId: string, content: string): Promise<void> {
  await fetch(`/api/messages/${messageId}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ content }),
  });
}
