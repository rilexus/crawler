# html-to-markdown

An MCP (Model Context Protocol) server that converts a rendered web page into clean Markdown. It exposes a single tool, `website-to-markdown`, that opens a URL in a headless browser, converts the page to Markdown, and uses a local LLM (via [LM Studio](https://lmstudio.ai)) to clean up the result.

## How it works

1. [Puppeteer](https://pptr.dev) launches headless Chromium, navigates to the URL, and waits for the page to finish loading. It strips `script`, `style`, `noscript`, `svg`, `meta`, `link`, and `template` elements from the page before reading its body content.
2. [Turndown](https://github.com/mixmark-io/turndown) mechanically converts that HTML to Markdown. This step is deterministic and keeps the payload well under the LLM's context window.
3. The raw Markdown goes to a local LLM, which removes leftover navigation, ads, cookie banners, and duplicate links, and fixes structure.

## Prerequisites

- Node.js 22+
- A running [LM Studio](https://lmstudio.ai) server with a model loaded (Developer > Start Server in LM Studio)

## Setup

```bash
npm install
```

## Configuration

Set these environment variables to point the server at your LM Studio instance:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port the MCP server listens on. |
| `LM_STUDIO_BASE_URL` | `http://127.0.0.1:1234/v1` | LM Studio's OpenAI-compatible API base URL. Use `127.0.0.1`, not `localhost` — Node resolves `localhost` to the IPv6 `::1` first, and LM Studio only listens on IPv4. |
| `LM_STUDIO_API_KEY` | `lm-studio` | LM Studio doesn't check this; any value works. |
| `LM_STUDIO_MODEL` | `qwen3.5-4b` | Must match a model ID LM Studio actually has loaded. |

## Running

```bash
npm start
```

The server listens at `http://localhost:3000/mcp`.

For production, build a bundled version first:

```bash
npm run build
npm run start:dist
```

## Running with Docker

```bash
docker build -t html-to-markdown .
docker run -p 3000:3000 -e LM_STUDIO_MODEL=<your-loaded-model-id> html-to-markdown
```

The container reaches LM Studio on your host machine via `host.docker.internal` by default. Override `LM_STUDIO_BASE_URL` if LM Studio runs elsewhere. On Linux, add `--add-host=host.docker.internal:host-gateway` to the `docker run` command, since Linux doesn't resolve that hostname by default.

To keep the container running across restarts:

```bash
docker run -d --name html-to-markdown --restart unless-stopped -p 3000:3000 -e LM_STUDIO_MODEL=<your-loaded-model-id> html-to-markdown
```

## Testing

There's no automated test suite. Use the included smoke-test script against a running server:

```bash
./test-website-to-markdown.sh <url> [output-file]
```

It runs the full MCP handshake (`initialize` → `notifications/initialized` → `tools/call`) and saves the resulting Markdown to `output-file` (default `output.md`).

## Connecting to Claude Desktop

Claude Desktop's local config only supports stdio-based servers, so bridge to this server with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote). Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "website-to-markdown": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/mcp"]
    }
  }
}
```

Restart Claude Desktop after editing the config.

## Project structure

- [index.js](index.js) — Express app entry point, wires the MCP HTTP verbs to `mcp-server/index.js`.
- [mcp-server/index.js](mcp-server/index.js) — MCP transport logic (session handling, tool registration).
- [mcp-server/tools/website-to-markdown/](mcp-server/tools/website-to-markdown/) — thin MCP wrapper around the agent logic below.
- [agents/website-to-markdown/](agents/website-to-markdown/) — the actual fetch → convert → clean-up pipeline, independent of the MCP transport.

See [CLAUDE.md](CLAUDE.md) for more implementation detail.
