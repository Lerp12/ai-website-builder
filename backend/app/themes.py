from __future__ import annotations

import random


_LAST: dict | None = None


def random_theme() -> dict:
    """Pick a random theme, avoiding an immediate repeat of the last one."""
    global _LAST
    pool = THEMES if _LAST is None or len(THEMES) <= 1 else [t for t in THEMES if t is not _LAST]
    pick = random.choice(pool)
    _LAST = pick
    return pick


THEMES = [
    {
        "name": "Editorial",
        "mood": "premium, magazine-like, warm and confident",
        "display": "'Playfair Display', serif",
        "body": "'DM Sans', sans-serif",
        "bg": "#faf7f2",
        "surface": "#ffffff",
        "text": "#1a1a1a",
        "muted": "#5c5c5c",
        "accent": "#b45309",
        "border": "#e7e0d6",
    },
    {
        "name": "Tech Dark",
        "mood": "modern, precise, Linear/Vercel-like",
        "display": "'Space Grotesk', sans-serif",
        "body": "'Inter', sans-serif",
        "bg": "#0a0a0b",
        "surface": "#161618",
        "text": "#f5f5f7",
        "muted": "#9a9a9f",
        "accent": "#6366f1",
        "border": "#262629",
    },
    {
        "name": "Warm Minimal",
        "mood": "soft, warm, Notion-like calm",
        "display": "'Bricolage Grotesque', sans-serif",
        "body": "'DM Sans', sans-serif",
        "bg": "#f5f1ea",
        "surface": "#fffaf3",
        "text": "#2b2418",
        "muted": "#7a6f5d",
        "accent": "#c2410c",
        "border": "#e6dccd",
    },
    {
        "name": "Mono Brutalist",
        "mood": "stark, technical, high-contrast, confident",
        "display": "'JetBrains Mono', monospace",
        "body": "'Inter', sans-serif",
        "bg": "#ffffff",
        "surface": "#f4f4f4",
        "text": "#000000",
        "muted": "#555555",
        "accent": "#dc2626",
        "border": "#000000",
    },
    {
        "name": "Forest Calm",
        "mood": "grounded, natural, quietly luxurious",
        "display": "'Source Serif 4', serif",
        "body": "'DM Sans', sans-serif",
        "bg": "#0f2a23",
        "surface": "#163a31",
        "text": "#ecf3ee",
        "muted": "#9bb5a8",
        "accent": "#c4a062",
        "border": "#1f4538",
    },
    {
        "name": "Cool Slate",
        "mood": "clean, trustworthy, modern SaaS",
        "display": "'Space Grotesk', sans-serif",
        "body": "'Inter', sans-serif",
        "bg": "#f8fafc",
        "surface": "#ffffff",
        "text": "#0f172a",
        "muted": "#64748b",
        "accent": "#0ea5e9",
        "border": "#e2e8f0",
    },
]


def direction_block(theme: dict) -> str:
    return f"""
# DESIGN DIRECTION — "{theme['name']}" (follow EXACTLY)
Mood: {theme['mood']}.
Fonts: headings -> font-family:{theme['display']}; body/root -> font-family:{theme['body']}.
Palette — use EXACTLY these hex values, reuse them everywhere:
  page background : {theme['bg']}
  surface / cards : {theme['surface']}
  primary text    : {theme['text']}
  muted text      : {theme['muted']}
  accent (ONE primary action / single highlight only) : {theme['accent']}
  borders / hairlines : {theme['border']}
Set the body font on the root wrapper and the display font on every heading.
""".strip()
