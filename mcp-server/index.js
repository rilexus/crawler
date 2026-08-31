import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import * as websiteToMarkdownTool from "./tools/website-to-markdown/index.js";
import * as fetchTool from "./tools/fetch/index.js";
import * as getElementTool from "./tools/get-element/index.js";
import * as saveValueTool from "./tools/save-value/index.js";
import * as crawlTool from "./tools/crawl/index.js";
import * as extractInfoTool from "./tools/extract-from-url/index.js";

const tools = [
  fetchTool,
  getElementTool,
  saveValueTool,
  crawlTool,
  websiteToMarkdownTool,
  extractInfoTool,
];

// Session ID -> transport, so repeat requests from the same client reuse
// the same MCP server session.
const transports = new Map();

export async function handleSessionRequest(req, res) {
  const sessionId = req.header("mcp-session-id");
  if (!sessionId) {
    res.status(400).send("Missing session ID");
    return;
  }
  const transport = transports.get(sessionId);
  if (!transport) {
    // Unknown/expired session ID — per the MCP spec, a 404 here tells the
    // client to reinitialize rather than treat this as a fatal error. This
    // is expected whenever the server process restarts, since `transports`
    // is in-memory only.
    res.status(404).send("Session not found");
    return;
  }
  try {
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error("Error handling MCP session request:", err);
    if (!res.headersSent) res.status(500).send("Internal server error");
  }
}

export const handlEMCPRequest = async (req, res) => {
  const sessionId = req.header("mcp-session-id");
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    if (sessionId) {
      // Client is referencing a session that no longer exists in memory,
      // most likely because the server restarted. Respond 404 so the
      // client reinitializes instead of getting stuck.
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Session not found" },
        id: null,
      });
      return;
    }

    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "No valid session ID provided" },
        id: null,
      });
      return;
    }

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (id) => transports.set(id, transport),
    });
    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId);
    };

    const server = createMcpServer();
    await server.connect(transport);
  }

  try {
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
};

export function createMcpServer() {
  const server = new McpServer({
    name: "website-to-markdown",
    version: "1.0.0",
  });

  for (const tool of tools) {
    server.registerTool(tool.name, tool.config, tool.handler);
  }

  return server;
}
