import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createVtlMcpServer } from "../mcp/server.ts";

test("MCP server advertises and executes the agent experiment tools", async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createVtlMcpServer();
  const client = new Client({ name: "vtl-test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    assert.deepEqual(names.sort(), [
      "compare_runs",
      "get_model_info",
      "get_scenario",
      "list_scenarios",
      "run_simulation",
      "sweep_parameters",
      "validate_scenario_proposal",
    ]);

    const called = await client.callTool({
      name: "run_simulation",
      arguments: { scenarioId: "llm-deployment", parameters: { steps: 40 }, seeds: [17, 18] },
    });
    assert.equal(called.isError, undefined);
    assert.equal(called.structuredContent.result.ensemble.runCount, 2);
  } finally {
    await client.close();
    await server.close();
  }
});
