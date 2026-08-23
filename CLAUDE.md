# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — run the server directly from source (`index.js`) on port 3000 (override with `PORT`).
- `npm run build` — bundle with esbuild into `dist/index.js` (single-file ESM bundle, targets Node 22).
- `npm run watch` — same as `build`, but rebuilds `dist/index.js` on file changes (esbuild `--watch`). Pair with `npm run start:dist` in another terminal.
- `npm run start:dist` — run the bundled output.
- There is no test suite (`npm test` is a stub that exits with an error) and no lint script. `./test-website-to-markdown.sh <url> [output-file]` is a manual smoke-test script: it runs the full MCP handshake against a running server (`initialize` → capture `mcp-session-id` → `notifications/initialized` → `tools/call`), then JSON-decodes the response and writes the resulting Markdown to `output-file` (default `output.md`).
- Docker: `docker build -t html-to-markdown .` builds via a two-stage build that runs `npm run build`, then installs runtime deps (`npm ci --omit=dev`) alongside Alpine's `chromium` package; the container listens on port 3000.
- Requires a local [LM Studio](https://lmstudio.ai) server running (Developer > Start Server) with a model loaded — the `website-to-markdown` tool calls out to it for every request. Configure via env vars: `LM_STUDIO_BASE_URL` (default `http://127.0.0.1:1234/v1` — use `127.0.0.1`, not `localhost`, since Node resolves `localhost` to the IPv6 `::1` first and LM Studio only listens on IPv4), `LM_STUDIO_API_KEY` (default `lm-studio`, unchecked by LM Studio), and `LM_STUDIO_MODEL` (default `qwen3.5-4b` — must match a model id LM Studio actually has loaded).

## Architecture

This is a minimal MCP (Model Context Protocol) server exposing a single tool, `website-to-markdown`, that converts a rendered web page into Markdown using a local LLM.

- [index.js](index.js) — Express app entry point. Wires the three MCP HTTP verbs (`POST/GET/DELETE /mcp`) to handlers in `mcp-server/index.js`.
- [mcp-server/index.js](mcp-server/index.js) — All MCP transport logic:
  - `createMcpServer()` builds the `McpServer` and calls `server.registerTool(tool.name, tool.config, tool.handler)` for each entry in the local `tools` array.
  - `handlEMCPRequest` (note the typo in the exported name — preserve it unless doing a deliberate rename) handles `POST /mcp`. It uses the MCP `mcp-session-id` header to look up an existing `StreamableHTTPServerTransport` in the in-memory `transports` Map, or creates a new transport + server pair on an initialize request.
  - `handleSessionRequest` handles `GET`/`DELETE /mcp`, requiring an existing session ID.
  - Session state (`transports`) is a process-local `Map`, so it does not survive restarts and does not work across multiple server instances/replicas.
- Each tool module lives one per folder under `mcp-server/tools/<name>/index.js` and exports `name`, `config` (`{ title, description, inputSchema }`, using `zod` for the schema), and an async `handler`. To add a tool, create `mcp-server/tools/<name>/index.js` following that shape and import/add it to the `tools` array in `mcp-server/index.js`.
  - [mcp-server/tools/website-to-markdown/index.js](mcp-server/tools/website-to-markdown/index.js) — thin MCP wrapper: validates the `url` input with `zod` and delegates to `generate()` from the agent module below, wrapping its return value in the MCP `content` shape.
- Agent logic (independent of the MCP transport) lives under `agents/<name>/index.js`.
  - [agents/website-to-markdown/index.js](agents/website-to-markdown/index.js) — `generate(url)` does three things: (1) launches headless Chromium via `puppeteer`, navigates to `url`, waits for network idle, and in-page strips `script`/`style`/`noscript`/`svg`/`meta`/`link`/`template` elements before reading `document.body.innerHTML` (this both drops irrelevant markup and keeps the payload sent to the LLM well under its context window); (2) mechanically converts that HTML to Markdown with `turndown` — deterministic, no LLM cost, and far smaller than raw HTML; (3) sends that raw Markdown to a local LLM (via the `ai` SDK's `@ai-sdk/openai-compatible` provider, pointed at LM Studio) to clean it up — stripping leftover navigation/ads/duplicate links and fixing structure — since an LLM is better suited to that interpretive cleanup than to doing the mechanical HTML parsing itself. Each call launches and closes its own browser instance. When `PUPPETEER_EXECUTABLE_PATH` is set (true in Docker), it also passes `--no-sandbox --disable-setuid-sandbox`, since the containerized Chromium runs as root and its sandbox can't start without extra container privileges.

The build produces a single bundled file (`dist/index.js`) via esbuild with a CJS-interop banner (`createRequire`), since some dependencies are CommonJS. `puppeteer` is excluded from the bundle (`--external:puppeteer`) because it resolves its own package/browser paths at runtime and can't be safely inlined — bundling it collides with the banner's `createRequire` and breaks the app on startup. Because of this, the Docker image can't ship only `dist/index.js`: the runtime stage also runs `npm ci --omit=dev` and installs Alpine's `chromium` package, pointing Puppeteer at it via `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` (and `PUPPETEER_SKIP_DOWNLOAD=true` to skip Puppeteer's own Chromium download in both stages).
