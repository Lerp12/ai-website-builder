from __future__ import annotations

import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

_DB_PATH = Path(__file__).resolve().parent.parent / "aiweb2.db"
_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _connect() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys=ON")
        _conn.execute(
            """
            CREATE TABLE IF NOT EXISTS pages (
                id         TEXT PRIMARY KEY,
                title      TEXT NOT NULL DEFAULT 'Untitled',
                prompt     TEXT NOT NULL DEFAULT '',
                blocks     TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        _conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id         TEXT PRIMARY KEY,
                title      TEXT NOT NULL DEFAULT 'New Session',
                page_id    TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL
            )
            """
        )
        _conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chats (
                id         TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                title      TEXT NOT NULL DEFAULT 'New Chat',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
            """
        )
        _conn.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id         TEXT PRIMARY KEY,
                chat_id    TEXT NOT NULL,
                role       TEXT NOT NULL,
                content    TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
            )
            """
        )
        _conn.commit()
    return _conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------------------------------------------------------------ pages
def create_page(html: str, title: str = "Untitled", prompt: str = "") -> dict:
    pid = uuid.uuid4().hex[:12]
    now = _now()
    with _lock:
        _connect().execute(
            "INSERT INTO pages (id, title, prompt, blocks, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (pid, title, prompt, html, now, now),
        )
        _connect().commit()
    return get_page(pid)


def get_page(pid: str) -> dict | None:
    with _lock:
        row = _connect().execute("SELECT * FROM pages WHERE id = ?", (pid,)).fetchone()
    return _row_to_dict(row)


def list_pages() -> list[dict]:
    with _lock:
        rows = _connect().execute(
            "SELECT id, title, prompt, created_at, updated_at FROM pages "
            "ORDER BY updated_at DESC"
        ).fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "prompt": r["prompt"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]


def update_page(pid: str, *, html: str | None = None, title: str | None = None) -> dict | None:
    now = _now()
    with _lock:
        conn = _connect()
        if html is not None:
            conn.execute(
                "UPDATE pages SET blocks = ?, updated_at = ? WHERE id = ?",
                (html, now, pid),
            )
        if title is not None:
            conn.execute(
                "UPDATE pages SET title = ?, updated_at = ? WHERE id = ?",
                (title, now, pid),
            )
        conn.commit()
    return get_page(pid)


def delete_page(pid: str) -> bool:
    with _lock:
        cur = _connect().execute("DELETE FROM pages WHERE id = ?", (pid,))
        _connect().commit()
    return cur.rowcount > 0


def _row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "title": row["title"],
        "prompt": row["prompt"],
        "html": row["blocks"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# ------------------------------------------------------------------ sessions
def create_session(title: str = "New Session") -> dict:
    sid = uuid.uuid4().hex[:12]
    now = _now()
    with _lock:
        _connect().execute(
            "INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (sid, title, now, now),
        )
        _connect().commit()
    return get_session(sid)


def get_session(sid: str) -> dict | None:
    with _lock:
        row = _connect().execute("SELECT * FROM sessions WHERE id = ?", (sid,)).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "title": row["title"],
        "page_id": row["page_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_sessions() -> list[dict]:
    with _lock:
        rows = _connect().execute(
            "SELECT id, title, page_id, created_at, updated_at FROM sessions "
            "ORDER BY updated_at DESC"
        ).fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "page_id": r["page_id"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]


def update_session(sid: str, *, title: str | None = None, page_id: str | None = None) -> dict | None:
    now = _now()
    with _lock:
        conn = _connect()
        if title is not None:
            conn.execute(
                "UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?",
                (title, now, sid),
            )
        if page_id is not None:
            conn.execute(
                "UPDATE sessions SET page_id = ?, updated_at = ? WHERE id = ?",
                (page_id, now, sid),
            )
        conn.commit()
    return get_session(sid)


def delete_session(sid: str) -> bool:
    with _lock:
        cur = _connect().execute("DELETE FROM sessions WHERE id = ?", (sid,))
        _connect().commit()
    return cur.rowcount > 0


# ------------------------------------------------------------------ chats
def create_chat(session_id: str, title: str = "New Chat") -> dict:
    cid = uuid.uuid4().hex[:12]
    now = _now()
    with _lock:
        _connect().execute(
            "INSERT INTO chats (id, session_id, title, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (cid, session_id, title, now, now),
        )
        _connect().execute(
            "UPDATE sessions SET updated_at = ? WHERE id = ?",
            (now, session_id),
        )
        _connect().commit()
    return get_chat(cid)


def get_chat(cid: str) -> dict | None:
    with _lock:
        row = _connect().execute("SELECT * FROM chats WHERE id = ?", (cid,)).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "session_id": row["session_id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_chats_for_session(session_id: str) -> list[dict]:
    with _lock:
        rows = _connect().execute(
            "SELECT id, session_id, title, created_at, updated_at FROM chats "
            "WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "session_id": r["session_id"],
            "title": r["title"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]


def update_chat(cid: str, *, title: str | None = None) -> dict | None:
    now = _now()
    with _lock:
        conn = _connect()
        if title is not None:
            conn.execute(
                "UPDATE chats SET title = ?, updated_at = ? WHERE id = ?",
                (title, now, cid),
            )
        conn.commit()
    return get_chat(cid)


def delete_chat(cid: str) -> bool:
    with _lock:
        cur = _connect().execute("DELETE FROM chats WHERE id = ?", (cid,))
        _connect().commit()
    return cur.rowcount > 0


# ------------------------------------------------------------------ messages
def add_message(chat_id: str, role: str, content: str = "") -> dict:
    mid = uuid.uuid4().hex[:12]
    now = _now()
    with _lock:
        _connect().execute(
            "INSERT INTO messages (id, chat_id, role, content, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (mid, chat_id, role, content, now),
        )
        _connect().execute(
            "UPDATE chats SET updated_at = ? WHERE id = ?",
            (now, chat_id),
        )
        _connect().commit()
    return {"id": mid, "chat_id": chat_id, "role": role, "content": content, "created_at": now}


def update_message_content(mid: str, content: str) -> None:
    with _lock:
        _connect().execute(
            "UPDATE messages SET content = ? WHERE id = ?",
            (content, mid),
        )
        _connect().commit()


def get_messages(chat_id: str) -> list[dict]:
    with _lock:
        rows = _connect().execute(
            "SELECT id, chat_id, role, content, created_at FROM messages "
            "WHERE chat_id = ? ORDER BY created_at ASC",
            (chat_id,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "chat_id": r["chat_id"],
            "role": r["role"],
            "content": r["content"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]
