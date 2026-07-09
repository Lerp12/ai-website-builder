#!/usr/bin/env bash
# Start backend + frontend. Ctrl+C stops both.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() { kill $(jobs -p) 2>/dev/null; }
trap cleanup INT TERM EXIT

echo "Starting backend on http://localhost:8000 ..."
cd "$ROOT/backend"
uv run uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:5173 ..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Press Ctrl+C to stop."
wait
