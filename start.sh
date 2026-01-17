#!/bin/bash

# Activate Python Virtual Environment
source /opt/venv/bin/activate

# Start Backend API (FastAPI) in background
echo "🚀 Starting Python Backend..."
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 &

# Start MCP HTTP Service (Node.js) in background
echo "🚀 Starting MCP Service..."
cd mcp-http-service && node dist/index.js &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
