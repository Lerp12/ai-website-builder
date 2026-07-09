from __future__ import annotations

from pydantic import BaseModel


class GenerateRequest(BaseModel):
    prompt: str
    title: str | None = None
    chat_id: str | None = None
    rewrite_text: bool = False


class EditRequest(BaseModel):
    page_id: str
    instruction: str
    focus_id: str | None = None
    chat_id: str | None = None


class CreatePageRequest(BaseModel):
    title: str = "Untitled"
    prompt: str = ""


class CreateSessionRequest(BaseModel):
    title: str = "New Session"


class CreateChatRequest(BaseModel):
    title: str = "New Chat"


class AddMessageRequest(BaseModel):
    role: str
    content: str = ""


class UpdateMessageRequest(BaseModel):
    content: str
