#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createVtlMcpServer } from "../mcp/server.ts";

const server = createVtlMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
