import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createVtlMcpServer } from "../../mcp/server.ts";
import { PUBLIC_EXECUTION_LIMITS } from "../../contracts/constants.ts";

function withCors(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  const allowedOrigin = process.env.VTL_EMPIRICAL_API_ORIGIN?.trim();
  const requestOrigin = request.headers.get("origin");
  if (allowedOrigin) {
    headers.delete("Access-Control-Allow-Origin");
    if (requestOrigin === allowedOrigin) headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Vary", "Origin");
  } else headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Expose-Headers", "MCP-Session-Id, MCP-Protocol-Version");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handle(request: Request) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const empiricalToken = process.env.VTL_EMPIRICAL_API_TOKEN?.trim();
  const empiricalTokenAuthenticated = Boolean(
    process.env.VTL_ENABLE_EMPIRICAL_API === "true"
    && empiricalToken
    && request.headers.get("authorization") === `Bearer ${empiricalToken}`,
  );
  const server = createVtlMcpServer(PUBLIC_EXECUTION_LIMITS, {
    empiricalMode: empiricalTokenAuthenticated ? "remote-mcp" : "disabled",
    empiricalTokenAuthenticated,
    allowSensitiveRemoteData: process.env.VTL_ALLOW_SENSITIVE_EMPIRICAL_DATA === "true",
  });
  await server.connect(transport);
  return withCors(await transport.handleRequest(request), request);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

export function OPTIONS() {
  const allowedOrigin = process.env.VTL_EMPIRICAL_API_ORIGIN?.trim() || "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
      "Access-Control-Max-Age": "86400",
    },
  });
}
