from __future__ import annotations

import os
from collections.abc import AsyncIterator
from typing import Any

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

_BASE_URL = os.getenv("LLM_BASE_URL")
_API_KEY = os.getenv("LLM_API_KEY") or ""
_MODEL = os.getenv("LLM_MODEL", "glm-5.1")

GENERATE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "generated_page",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {"html": {"type": "string"}},
            "required": ["html"],
            "additionalProperties": False,
        },
    },
}

EDIT_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "edit_result",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "changes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "html": {"type": "string"},
                        },
                        "required": ["id", "html"],
                        "additionalProperties": False,
                    },
                },
                "summary": {"type": "string"},
                "done": {"type": "boolean"},
            },
            "required": ["changes", "summary", "done"],
            "additionalProperties": False,
        },
    },
}

_client: AsyncOpenAI | None = None


def client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(base_url=_BASE_URL, api_key=_API_KEY or "missing")
    return _client


def has_key() -> bool:
    return bool(_API_KEY)


def model() -> str:
    return _MODEL


async def stream_chat(
    *,
    system: str,
    user: str | list,
    temperature: float = 0.7,
    max_tokens: int = 22000,
    response_format: dict | None = None,
) -> AsyncIterator[str]:
    """Yield content deltas (strings) from a streaming chat completion."""
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    stream = await client().chat.completions.create(
        model=_MODEL,
        messages=messages,
        stream=True,
        temperature=temperature,
        max_tokens=max_tokens,
        response_format=response_format,
    )

    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
