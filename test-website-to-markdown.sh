#!/bin/bash
set -euo pipefail

HOST="http://localhost:3001/mcp"
URL="${1:-https://example.com}"
OUT="${2:-output.md}"

SID=$(curl -s -D - -o /dev/null -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl-test","version":"1.0.0"}}}' \
  | grep -i '^mcp-session-id:' | tr -d '\r' | cut -d' ' -f2)

curl -s -o /dev/null -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

RESPONSE=$(curl -s -X POST "$HOST" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SID" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"website-to-markdown\",\"arguments\":{\"url\":\"$URL\"}}}")

node -e '
const response = process.argv[1];
const outPath = process.argv[2];
const dataLine = response.split("\n").find((line) => line.startsWith("data: "));
if (!dataLine) {
  console.error("No data line found in response:", response);
  process.exit(1);
}
const payload = JSON.parse(dataLine.slice("data: ".length));
const text = payload.result.content[0].text;
if (payload.result.isError) {
  console.error(text);
  process.exit(1);
}
require("fs").writeFileSync(outPath, text);
console.log("Saved to " + outPath);
' "$RESPONSE" "$OUT"
