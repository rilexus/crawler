import express from "express";
import { handlEMCPRequest, handleSessionRequest } from "./mcp-server/index.js";

process.loadEnvFile();

const app = express();
app.use(express.json());

app.post("/mcp", handlEMCPRequest);
app.get("/mcp", handleSessionRequest);
app.delete("/mcp", handleSessionRequest);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(
    `website-to-markdown MCP server listening on http://localhost:${PORT}/mcp`,
  );
});
