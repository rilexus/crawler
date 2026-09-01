# crawler

An MCP (Model Context Protocol) server for pulling structured content out of rendered web pages: raw HTML and element lookups, persisted CSS-selector scraping, and LLM-driven Markdown conversion and information extraction.

## Tools

| Tool | Description |
| --- | --- |
| `fetch` | Opens a URL in a headless browser and returns the rendered body's raw HTML. |
| `get-element` | Opens a URL and returns the outer HTML of the first element matching a CSS selector. |
| `save-value` | Saves a description plus up to 3 candidate CSS selectors for a value on a given URL, for later resolution. |
| `crawl-website` | Re-opens a URL with previously saved values and resolves each one's candidate selectors against the live page. |
| `extract-information-from-website` | Opens a URL, converts it to Markdown, and asks an LLM to extract a specific piece of information from it. |
| `website-to-markdown` | Opens a URL, converts it to Markdown, and asks an LLM to clean up the result. |

## How `website-to-markdown` and `extract-information-from-website` work

1. [Puppeteer](https://pptr.dev) launches headless Chromium, navigates to the URL, and waits for the page to finish loading. It strips `script`, `style`, `noscript`, `svg`, `meta`, `link`, and `template` elements from the page before reading its body content.
2. [Turndown](https://github.com/mixmark-io/turndown) mechanically converts that HTML to Markdown. This step is deterministic and keeps the payload well under the LLM's context window.
3. The raw Markdown goes to an LLM (via [DeepSeek](https://www.deepseek.com)'s OpenAI-compatible API), which either cleans it up (removing leftover navigation, ads, cookie banners, and duplicate links, and fixing structure) or extracts the requested information from it.

The browser itself is shared across all tool calls: a single headless Chromium instance launches on first use and stays warm, auto-closing after a minute of inactivity.

## `save-value` and `crawl-website`

These two support a persisted-selector workflow: use `save-value` once per value you want to track on a page (with a description and a few fallback CSS selectors), then call `crawl-website` any time after to re-resolve those selectors against the live page and get current values back. Saved sites and values are stored in `data/websites.json`.

## Prerequisites

- Node.js 22+
- A [DeepSeek](https://platform.deepseek.com) API key

## Setup

```bash
npm install
```

## Configuration

Set these environment variables (a `.env` file in the project root is loaded automatically):

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Port the MCP server listens on. |
| `DEEPSEEK_API_KEY` | — | Required. Your DeepSeek API key, used by `website-to-markdown` and `extract-information-from-website`. |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek's OpenAI-compatible API base URL. |
| `BROWSER_IDLE_TIMEOUT_MS` | `60000` | How long the shared headless browser stays open with no active calls before it's closed. |

## Running

```bash
npm start
```

The server listens at `http://localhost:3001/mcp`. Use `npm run dev` to restart automatically on file changes.

For production, build a bundled version first:

```bash
npm run build
npm run start:dist
```

## Running with Docker

```bash
docker build -t crawler .
docker run -p 3001:3001 -e DEEPSEEK_API_KEY=<your-api-key> crawler
```

> [!NOTE]
> The [Dockerfile](Dockerfile) still `EXPOSE`s port 3000, left over from before the app's default port moved to 3001. Pass `-e PORT=3000` (and map `-p <host>:3000`) if you want the container's internal port to match the `EXPOSE`d one, or update the Dockerfile.

To keep the container running across restarts:

```bash
docker run -d --name crawler --restart unless-stopped -p 3001:3001 -e DEEPSEEK_API_KEY=<your-api-key> crawler
```

## Testing

There's no automated test suite. Use the included smoke-test script against a running server on port 3001:

```bash
./test-website-to-markdown.sh <url> [output-file]
```

It runs the full MCP handshake (`initialize` → `notifications/initialized` → `tools/call`) against the `website-to-markdown` tool and saves the resulting Markdown to `output-file` (default `output.md`).

## Connecting to Claude Desktop

Claude Desktop's local config only supports stdio-based servers, so bridge to this server with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote). Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "crawler": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3001/mcp"]
    }
  }
}
```

Restart Claude Desktop after editing the config.

## Project structure

- [index.js](index.js) — Express app entry point, wires the MCP HTTP verbs to `mcp-server/index.js`.
- [mcp-server/index.js](mcp-server/index.js) — MCP transport logic (session handling, tool registration).
- [mcp-server/tools/](mcp-server/tools/) — one folder per tool, each a thin MCP wrapper around browser/agent/store logic.
- [browser/index.js](browser/index.js) — shared Puppeteer browser lifecycle used by every tool that touches a page.
- [mcp-server/store/index.js](mcp-server/store/index.js) — JSON-file store backing `save-value` and `crawl-website`.
- [agents/](agents/) — the LLM-backed fetch → convert → clean-up/extract pipelines, independent of the MCP transport.

See [CLAUDE.md](CLAUDE.md) for more implementation detail.
