#!/bin/bash

# Activate Python Virtual Environment
source /opt/venv/bin/activate

# Set Chromium path for Playwright to use system chromium (installed via nixpkgs)
# CHROMIUM_PATH not needed for official Docker image - Playwright finds its own browsers
# export CHROMIUM_PATH=$(which chromium 2>/dev/null || which chromium-browser 2>/dev/null || echo "")

# Start Backend API (FastAPI) in background
echo "🚀 Starting Python Backend..."
python -m uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000} &

# Start MCP HTTP Service (Node.js) in background
echo "🚀 Starting MCP Service v2..."
echo "DEBUG: server_v2.js stats:"
ls -la mcp-http-service/server_v2.js
cd mcp-http-service && npm start &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
