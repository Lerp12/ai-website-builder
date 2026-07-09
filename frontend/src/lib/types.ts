export interface Page {
  id: string;
  title: string;
  prompt: string;
  html: string;
  created_at: string;
  updated_at: string;
}

export interface PageSummary {
  id: string;
  title: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  backendId?: string;
  role: ChatRole;
  content: string;
  pending?: boolean;
  error?: boolean;
}

export type StreamEvent =
  | { event: "status"; data: { message: string } }
  | { event: "delta"; data: { chunk: string } }
  | { event: "complete"; data: { page_id: string; html: string; title?: string; changed?: boolean; errors?: string[] } }
  | { event: "error"; data: { message: string } };

export interface User {
  id: string;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}
