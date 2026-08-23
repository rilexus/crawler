FROM node:22-alpine AS builder

WORKDIR /app

# Chromium is only needed at runtime (installed below via apk); skip
# Puppeteer's own download during the build.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
RUN npm ci

COPY index.js ./
COPY mcp-server ./mcp-server
COPY agents ./agents
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache chromium

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# host.docker.internal reaches the host machine's network from inside the
# container (Docker Desktop on Mac/Windows supports this out of the box; on
# Linux, run with --add-host=host.docker.internal:host-gateway). This lets
# the container reach an LM Studio server running on the host. Override with
# -e LM_STUDIO_BASE_URL=... if LM Studio runs elsewhere.
ENV LM_STUDIO_BASE_URL=http://host.docker.internal:1234/v1

WORKDIR /app

# Puppeteer is excluded from the bundle (esbuild --external:puppeteer)
# because it resolves its own package/browser paths at runtime, so it's
# installed as a real dependency here instead.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/index.js ./index.js

EXPOSE 3000

CMD ["node", "index.js"]
