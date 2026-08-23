import express from "express";
import { handlEMCPRequest, handleSessionRequest } from "./mcp-server/index.js";

const app = express();
app.use(express.json());

app.post("/mcp", handlEMCPRequest);
app.get("/mcp", handleSessionRequest);
app.delete("/mcp", handleSessionRequest);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `html-to-markdown MCP server listening on http://localhost:${PORT}/mcp`,
  );
});
