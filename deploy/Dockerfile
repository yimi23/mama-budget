# The Mama Budget API and the ChatGPT app on one box. Node 22. One image, two containers: the API (default command)
# and the ChatGPT MCP server (docker-compose overrides the command). The extension is built and shipped separately.
# better-sqlite3 needs a build toolchain for its native binding, so the build stage has it and the runtime does not.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ffmpeg && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/extension/package.json ./apps/extension/package.json
COPY apps/chatgpt/package.json ./apps/chatgpt/package.json
RUN npm ci --omit=dev --ignore-scripts && npm rebuild better-sqlite3

FROM node:22-bookworm-slim
WORKDIR /app
# ffmpeg: voice notes (afconvert exists only on macOS; the API falls back to ffmpeg when present).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8787
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY packages ./packages
COPY api ./api
COPY apps/chatgpt ./apps/chatgpt
COPY docs/privacy.html ./docs/privacy.html
# data/ holds the SQLite file, the bank cache, the voice cache: a volume, never baked in.
RUN mkdir -p data api/.cache/tts && chown -R node:node /app
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "api/server.js"]
