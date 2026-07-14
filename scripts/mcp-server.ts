#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { delimiter, resolve } from "node:path";
import { createVtlMcpServer } from "../mcp/server.ts";

const empiricalRoots = (process.env.VTL_EMPIRICAL_ROOTS ?? "")
  .split(delimiter)
  .map((root) => root.trim())
  .filter(Boolean)
  .map((root) => resolve(root));
const server = createVtlMcpServer(undefined, {
  empiricalMode: "local-mcp",
  empiricalRoots,
});
const transport = new StdioServerTransport();
await server.connect(transport);
