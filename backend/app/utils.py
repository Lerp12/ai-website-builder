from __future__ import annotations

import json
import re
import uuid

from bs4 import BeautifulSoup, Tag

_FENCE_RE = re.compile(r"^```(?:ya?ml|json)?\s*\n?(.*?)\n?```\s*$", re.DOTALL)


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def strip_fences(text: str) -> str:
    """Strip markdown code fences from LLM output."""
    text = text.strip()
    m = _FENCE_RE.match(text)
    if m:
        return m.group(1).strip()
    text = re.sub(r"^```(?:ya?ml|json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def extract_edit_response(buffer: str) -> dict | None:
    """Try to extract the full edit response from the accumulated LLM buffer.

    Expects: {"changes": [...], "summary": "...", "done": true/false}
    Returns the dict, or None if not parseable yet.
    """
    cleaned = strip_fences(buffer)
    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict) and "changes" in obj:
            return obj
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[^{}]*\"changes\"[^{}]*\}", cleaned, re.DOTALL)
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict) and "changes" in obj:
                return obj
        except json.JSONDecodeError:
            pass
    m = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if m:
        try:
            arr = json.loads(m.group(0))
            if isinstance(arr, list):
                return {"changes": arr, "summary": "", "done": True}
        except json.JSONDecodeError:
            pass
    return None


def derive_title(prompt: str) -> str:
    words = [w for w in prompt.split() if w][:6]
    return " ".join(words).capitalize() or "Untitled"


_ESCAPES = {"n": "\n", "t": "\t", "r": "\r", '"': '"', "\\": "\\", "/": "/", "b": "\b", "f": "\f"}


def partial_json_string_value(buffer: str, key: str) -> str | None:
    """Best-effort value of a JSON string field from a partial (streaming) buffer.

    Returns None if the key / opening quote has not arrived yet. Returns the
    decoded text collected so far while the string is still open.
    """
    m = re.search(rf'"{re.escape(key)}"\s*:\s*"', buffer)
    if not m:
        return None
    i = m.end()
    out: list[str] = []
    while i < len(buffer):
        c = buffer[i]
        if c == '"':
            return "".join(out)  # closing quote — complete
        if c == "\\":
            if i + 1 >= len(buffer):
                break  # escape still streaming — wait for more
            esc = buffer[i + 1]
            if esc == "u":
                if i + 6 > len(buffer):
                    break
                try:
                    out.append(chr(int(buffer[i + 2 : i + 6], 16)))
                except ValueError:
                    pass
                i += 6
                continue
            out.append(_ESCAPES.get(esc, esc))
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)  # quote still open — partial


def apply_html_changes(html: str, changes: list[dict]) -> tuple[str, list[str]]:
    """Apply a list of {id, html} changes to the page HTML.

    Returns (new_html, errors).
    """
    errors: list[str] = []
    if not changes:
        return html, errors

    soup = BeautifulSoup(html, "html.parser")

    for change in changes:
        target_id = change.get("id", "")
        replacement_html = change.get("html", "")

        if not target_id:
            errors.append("change missing 'id'")
            continue
        if not replacement_html:
            errors.append(f"change for id={target_id} missing 'html'")
            continue

        target = soup.find(attrs={"data-id": target_id})
        if target is None:
            errors.append(f"element with data-id={target_id} not found")
            continue

        replacement = BeautifulSoup(replacement_html, "html.parser")
        replacement_children = list(replacement.body.children) if replacement.body else list(replacement.children)
        replacement_children = [c for c in replacement_children if isinstance(c, Tag)]

        if len(replacement_children) == 0:
            errors.append(f"replacement for id={target_id} parsed to empty")
            continue
        elif len(replacement_children) == 1:
            target.replace_with(replacement_children[0])
        else:
            wrapper = replacement.new_tag("div")
            for child in replacement_children:
                wrapper.append(child)
            target.replace_with(wrapper)

    return str(soup), errors


def ensure_data_ids(html: str) -> str:
    """Walk the HTML and add data-id to every element that lacks one."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(True):
        if not tag.has_attr("data-id"):
            tag["data-id"] = uuid.uuid4().hex[:10]
    return str(soup)
