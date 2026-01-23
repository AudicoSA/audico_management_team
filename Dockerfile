# Use official Playwright base image with all browsers and dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.42.1-jammy

# Set working directory
WORKDIR /app

# Install Python and build dependencies
# Check python version provided by the base image or install it
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3.11 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy package files for all services
COPY package*.json ./
COPY mcp-servers/package*.json ./mcp-servers/
COPY mcp-servers/shared/package*.json ./mcp-servers/shared/
COPY mcp-servers/mcp-feed-planetworld/package*.json ./mcp-servers/mcp-feed-planetworld/
COPY mcp-servers/mcp-feed-proaudio/package*.json ./mcp-servers/mcp-feed-proaudio/
COPY mcp-http-service/package*.json ./mcp-http-service/

# Ensure dev dependencies are installed
ENV NODE_ENV=development

# Install Node dependencies
# Note: The base image already has Playwright browsers installed
RUN cd mcp-servers/shared && npm ci --unsafe-perm
RUN cd mcp-servers/mcp-feed-planetworld && npm ci --unsafe-perm
RUN cd mcp-servers/mcp-feed-proaudio && npm ci --unsafe-perm
RUN cd mcp-http-service && npm ci --unsafe-perm

# Add --disable-dev-shm-usage flag support via env var if needed, 
# but we hardcoded it in the typescript code as well.

# Copy requirements.txt and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Build TypeScript for MCP servers
RUN cd mcp-servers/shared && npm run build
RUN cd mcp-servers/mcp-feed-planetworld && npm run build

# Set environment variables for headless operation
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Expose port for the Python backend
EXPOSE 8000

# Start the application using the start script
# Ensure start.sh is executable
RUN chmod +x start.sh

CMD ["./start.sh"]
