from __future__ import annotations

from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import db
from .dtos import (
    AddMessageRequest,
    CreateChatRequest,
    CreatePageRequest,
    CreateSessionRequest,
    EditRequest,
    GenerateRequest,
    UpdateMessageRequest,
)
from .llm import has_key, model, stream_chat
from .prompts import EDIT_PROMPT, GENERATE_PROMPT, REWRITE_TEXT_SYSTEM
from .themes import direction_block, random_theme
from .utils import (
    apply_html_changes,
    derive_title,
    ensure_data_ids,
    extract_edit_response,
    sse,
)

app = FastAPI(title="ai-web builder")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------- /api/generate
@app.post("/api/generate")
async def generate(req: GenerateRequest) -> StreamingResponse:
    if not has_key():
        raise HTTPException(503, "No LLM API key configured. Set LLM_API_KEY.")
    title = req.title or derive_title(req.prompt)

    async def event_stream() -> AsyncIterator[str]:
        yield sse("status", {"message": f"Generating with {model()}"})
        prompt = req.prompt

        # Optional rewrite: polish the user prompt before generation
        if req.rewrite_text:
            yield sse("status", {"message": "Rewriting prompt…"})
            rewritten = ""
            async for chunk in stream_chat(system=REWRITE_TEXT_SYSTEM, user=prompt):
                rewritten += chunk
            prompt = rewritten.strip() or prompt

        buffer = ""

        try:
            theme = random_theme()
            system_prompt = GENERATE_PROMPT + "\n\n" + direction_block(theme)
            async for chunk in stream_chat(
                system=system_prompt,
                user=f"Create a page for: {prompt}",
            ):
                buffer += chunk
                yield sse("delta", {"chunk": chunk})

            html_body = ensure_data_ids(buffer)
            page = db.create_page(html_body, title=title, prompt=req.prompt)

            if req.chat_id:
                chat = db.get_chat(req.chat_id)
                if chat and chat.get("session_id"):
                    db.update_session(
                        chat["session_id"], title=title, page_id=page["id"]
                    )
                    db.update_chat(req.chat_id, title=title)

            yield sse("complete", {"page_id": page["id"], "html": html_body, "title": title})
        except Exception as e:  # noqa: BLE001
            yield sse("error", {"message": str(e)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ----------------------------------------------------------- /api/edit
MAX_EDIT_ROUNDS = 5


@app.post("/api/edit")
async def edit(req: EditRequest) -> StreamingResponse:
    if not has_key():
        raise HTTPException(503, "No LLM API key configured.")
    page = db.get_page(req.page_id)
    if not page:
        raise HTTPException(404, "Page not found")
    current_html = page["html"]

    # Build context: optionally highlight the focused element
    focus_note = ""
    if req.focus_id and req.focus_id != "root":
        focus_note = (
            f"\nThe user has SELECTED the element with data-id=\"{req.focus_id}\" "
            f"in the canvas. Focus the change here unless the instruction is "
            f"clearly broader.\n"
        )

    async def event_stream() -> AsyncIterator[str]:
        nonlocal current_html
        yield sse("status", {"message": f"Editing with {model()}"})
        summaries: list[str] = []
        total_errors: list[str] = []

        for round_num in range(1, MAX_EDIT_ROUNDS + 1):
            yield sse("status", {"message": "Editing…"})

            user_msg = (
                f"Current page HTML:\n```html\n{current_html}```\n"
                f"{focus_note}\n"
                f"User instruction: {req.instruction}\n\n"
                f"Round {round_num} of {MAX_EDIT_ROUNDS}. "
                f"Return ONLY the JSON with changes, summary, and done field."
            )

            buffer = ""
            async for chunk in stream_chat(system=EDIT_PROMPT, user=user_msg):
                buffer += chunk
                yield sse("delta", {"chunk": chunk, "round": round_num})

            parsed = extract_edit_response(buffer)
            if parsed is None:
                total_errors.append(f"Round {round_num}: could not parse LLM output")
                break

            changes = parsed.get("changes", [])
            summary = parsed.get("summary", "")
            done = parsed.get("done", True)

            if summary:
                summaries.append(summary)

            if changes:
                current_html, errors = apply_html_changes(current_html, changes)
                current_html = ensure_data_ids(current_html)
                for err in errors:
                    total_errors.append(f"Round {round_num}: {err}")

            yield sse("round_complete", {
                "round": round_num,
                "changes_applied": len(changes),
                "summary": summary,
                "done": done,
            })

            if done:
                break

        db.update_page(req.page_id, html=current_html)
        full_summary = "; ".join(summaries) if summaries else "No changes applied."

        yield sse(
            "complete",
            {
                "page_id": page["id"],
                "html": current_html,
                "changed": bool(summaries),
                "summary": full_summary,
                "errors": total_errors,
                "rounds": len(summaries),
            },
        )

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ----------------------------------------------------------- page CRUD
@app.get("/api/pages")
async def list_pages():
    return db.list_pages()


@app.get("/api/pages/{pid}")
async def get_page(pid: str):
    page = db.get_page(pid)
    if not page:
        raise HTTPException(404, "Page not found")
    return page


@app.post("/api/pages")
async def create_page(req: CreatePageRequest):
    return db.create_page("", title=req.title, prompt=req.prompt)


@app.put("/api/pages/{pid}")
async def update_page(pid: str, html: str):
    return db.update_page(pid, html=html)


@app.delete("/api/pages/{pid}")
async def delete_page(pid: str):
    if not db.delete_page(pid):
        raise HTTPException(404, "Page not found")
    return {"ok": True}


# ----------------------------------------------------------- session CRUD
@app.get("/api/sessions")
async def list_sessions():
    return db.list_sessions()


@app.get("/api/sessions/{sid}")
async def get_session(sid: str):
    session = db.get_session(sid)
    if not session:
        raise HTTPException(404, "Session not found")
    session["chats"] = db.list_chats_for_session(sid)
    return session


@app.post("/api/sessions")
async def create_session(req: CreateSessionRequest):
    return db.create_session(title=req.title)


@app.put("/api/sessions/{sid}")
async def update_session(sid: str, title: str | None = None):
    session = db.update_session(sid, title=title)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@app.delete("/api/sessions/{sid}")
async def delete_session(sid: str):
    if not db.delete_session(sid):
        raise HTTPException(404, "Session not found")
    return {"ok": True}


# ----------------------------------------------------------- chat CRUD
@app.get("/api/sessions/{sid}/chats")
async def list_chats(sid: str):
    session = db.get_session(sid)
    if not session:
        raise HTTPException(404, "Session not found")
    return db.list_chats_for_session(sid)


@app.get("/api/chats/{cid}")
async def get_chat(cid: str):
    chat = db.get_chat(cid)
    if not chat:
        raise HTTPException(404, "Chat not found")
    chat["messages"] = db.get_messages(cid)
    return chat


@app.post("/api/sessions/{sid}/chats")
async def create_chat(sid: str, req: CreateChatRequest):
    session = db.get_session(sid)
    if not session:
        raise HTTPException(404, "Session not found")
    return db.create_chat(session_id=sid, title=req.title)


@app.put("/api/chats/{cid}")
async def update_chat(cid: str, title: str | None = None):
    chat = db.update_chat(cid, title=title)
    if not chat:
        raise HTTPException(404, "Chat not found")
    return chat


@app.delete("/api/chats/{cid}")
async def delete_chat(cid: str):
    if not db.delete_chat(cid):
        raise HTTPException(404, "Chat not found")
    return {"ok": True}


@app.post("/api/chats/{cid}/messages")
async def add_message(cid: str, req: AddMessageRequest):
    chat = db.get_chat(cid)
    if not chat:
        raise HTTPException(404, "Chat not found")
    return db.add_message(cid, req.role, req.content)


@app.put("/api/messages/{mid}")
async def update_message(mid: str, req: UpdateMessageRequest):
    db.update_message_content(mid, req.content)
    return {"ok": True}


@app.get("/api/chats/{cid}/messages")
async def get_messages(cid: str):
    chat = db.get_chat(cid)
    if not chat:
        raise HTTPException(404, "Chat not found")
    return db.get_messages(cid)


# ----------------------------------------------------------- misc
@app.get("/api/health")
async def health():
    return {"ok": True, "has_key": has_key(), "model": model()}
