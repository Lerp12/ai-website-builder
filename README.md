# ai-website-builder

AI-powered website builder. Describe what you want in plain text, get a live preview you can edit through conversation.

## Stack

- **Backend** — Python, FastAPI, SQLite, OpenAI-compatible API
- **Frontend** — React, TypeScript, Vite, Tailwind CSS

## Quick start

```bash
# 1. Clone
git clone <your-repo-url> ai-web
cd ai-web

# 2. Backend setup
cd backend
cp .env.example .env        # add your API key
uv sync                     # install deps
cd ..

# 3. Frontend setup
cd frontend
npm install
cd ..

# 4. Run
./start.sh
```

Backend runs on `http://localhost:8000`, frontend on `http://localhost:5173`.

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_API_KEY` | Yes | — | API key for an OpenAI-compatible provider |
| `LLM_BASE_URL` | No | `https://openrouter.ai/api/v1` | Base URL for the LLM API |
| `LLM_MODEL` | No | `glm-5.1` | Model to use for generation and edits |

Works with OpenRouter, OpenAI, Ollama, LM Studio, or any OpenAI-compatible endpoint.

## Usage

1. Open `http://localhost:5173`
2. Type a prompt like "landing page for a coffee shop" or "portfolio with dark theme"
3. Watch the page generate live in the canvas
4. Ask for edits in the chat — "make the header bigger", "change the color to blue", etc.
5. Export the final HTML when ready
