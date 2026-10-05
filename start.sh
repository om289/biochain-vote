#!/bin/bash
# BioChain Vote — Start Script
# Installs dependencies (if needed) and starts the dev server

set -e

cd "$(dirname "$0")"

echo "🔗 BioChain Vote — Starting..."

# Install dependencies if node_modules is missing or package.json changed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo "🚀 Starting dev server..."
npm run dev &
DEV_PID=$!

# Save PID so stop.sh can find it
echo "$DEV_PID" > .dev.pid

echo "✅ Dev server started (PID: $DEV_PID)"
echo "   Open http://localhost:5173 in your browser"
echo "   Run ./stop.sh to stop the server"

wait $DEV_PID
