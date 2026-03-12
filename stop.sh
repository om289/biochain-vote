#!/bin/bash
# BioChain Vote — Stop Script
# Stops the dev server started by start.sh

cd "$(dirname "$0")"

echo "🛑 BioChain Vote — Stopping..."

# Method 1: Use saved PID
if [ -f .dev.pid ]; then
  PID=$(cat .dev.pid)
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    echo "✅ Stopped dev server (PID: $PID)"
  else
    echo "⚠️  Saved PID $PID is not running"
  fi
  rm -f .dev.pid
else
  echo "⚠️  No .dev.pid file found"
fi

# Method 2: Kill any remaining vite processes for this project
VITE_PIDS=$(lsof -ti :5173 2>/dev/null || true)
if [ -n "$VITE_PIDS" ]; then
  echo "$VITE_PIDS" | xargs kill 2>/dev/null
  echo "✅ Killed processes on port 5173"
fi

echo "🔴 BioChain Vote stopped"
