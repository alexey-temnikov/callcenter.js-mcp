FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy sources and build distribution artifacts
COPY . .
RUN npm run build

ENV NODE_ENV=production \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=3001

EXPOSE 3001

# Start MCP HTTP transport. Token and SIP/OpenAI creds come from env vars.
CMD ["node", "dist/cli.js", "--mcp-http"]
