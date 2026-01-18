#!/bin/bash

# Activate Python Virtual Environment
source /opt/venv/bin/activate

# Start Backend API (FastAPI) in background
echo "🚀 Starting Python Backend..."
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 &

# Start MCP HTTP Service (Node.js) in background
echo "🚀 Starting MCP Service..."
echo "DEBUG: server.js stats:"
ls -la mcp-http-service/server.js
echo "DEBUG: server.js head:"
head -n 20 mcp-http-service/server.js
cd mcp-http-service && npm start &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
