import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createVtlMcpServer } from "../mcp/server.ts";
import { empiricalResearchFixture, empiricalCsv } from "./fixtures/empirical.mjs";
import { createSyntheticRegistryDemo } from "../empirical/registry-demo.ts";
import { scenarioById } from "../scenarios/catalog.ts";

test("MCP server advertises and executes the agent experiment tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "vtl-mcp-empirical-"));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createVtlMcpServer(undefined, { empiricalMode: "local-mcp", empiricalRoots: [root] });
  const client = new Client({ name: "vtl-test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    assert.deepEqual(names.sort(), [
      "analyze_external_telemetry",
      "compare_runs",
      "compose_laboratory_run",
      "empirical_aggregate_receipts",
      "empirical_analyze_resource",
      "empirical_analyze_table",
      "empirical_explain_observation",
      "empirical_export_receipt",
      "get_model_info",
      "get_scenario",
      "get_system",
      "list_interventions",
      "list_scenario_modules",
      "list_scenarios",
      "list_system_templates",
      "list_systems",
      "reproduce_paper_case",
      "run_simulation",
      "sweep_parameters",
      "validate_scenario_proposal",
    ]);

    const systems = await client.callTool({ name: "list_systems", arguments: { featured: true } });
    assert.equal(systems.isError, undefined);
    assert.equal(systems.structuredContent.result.systems.length, 10);
    assert.ok(systems.structuredContent.result.systems.every((item) => item.system && item.protocols.length >= 3));

    const templates = await client.callTool({ name: "list_system_templates", arguments: {} });
    assert.equal(templates.structuredContent.result.systemTemplates.length, 8);
    const modules = await client.callTool({ name: "list_scenario_modules", arguments: {} });
    assert.equal(modules.structuredContent.result.scenarioModules.length, 5);
    const interventions = await client.callTool({ name: "list_interventions", arguments: {} });
    assert.equal(interventions.structuredContent.result.interventionDefinitions.length, 6);
    assert.equal(interventions.structuredContent.result.interventionPlans.length, 8);

    const composition = await client.callTool({ name: "compose_laboratory_run", arguments: { systemId: "llm-deployment", protocolId: "compound-stress", interventionPlanId: "layered-correction", parameters: { steps: 80 } } });
    assert.equal(composition.isError, undefined);
    assert.equal(composition.structuredContent.result.template.id, "capability-correction");
    assert.equal(composition.structuredContent.result.protocol.moduleId, "compound-stress");
    assert.equal(composition.structuredContent.result.interventions.length, 5);

    const called = await client.callTool({
      name: "run_simulation",
      arguments: { systemId: "llm-deployment", protocolId: "compound-stress", interventionPlanId: "correction-surge", parameters: { steps: 40 }, seeds: [17, 18] },
    });
    assert.equal(called.isError, undefined);
    assert.equal(called.structuredContent.result.ensemble.runCount, 2);
    assert.equal(called.structuredContent.result.protocol.id, "llm-deployment-compound-stress");
    assert.equal(called.structuredContent.result.interventionPlan.id, "correction-surge");

    const reproduction = await client.callTool({
      name: "reproduce_paper_case",
      arguments: { caseId: "stable-periodic" },
    });
    assert.equal(reproduction.isError, undefined);
    assert.equal(reproduction.structuredContent.result.matchesArchive, true);

    const telemetry = await client.callTool({
      name: "analyze_external_telemetry",
      arguments: {
        source: { name: "test", units: "mismatch", provenance: "deterministic test fixture" },
        samples: Array.from({ length: 160 }, (_, index) => ({ time: index * 0.2, mismatch: 0.5 + 0.25 * Math.cos(index * Math.PI / 20) })),
      },
    });
    assert.equal(telemetry.isError, undefined);
    assert.equal(telemetry.structuredContent.result.samples.length, 160);

    const { request, example } = empiricalResearchFixture();
    const empirical = await client.callTool({ name: "empirical_analyze_table", arguments: request });
    assert.equal(empirical.isError, undefined);
    assert.equal(empirical.structuredContent.result.validation.torusReplayReady, true);
    assert.equal(empirical.structuredContent.result.receipt.source.rawDataIncluded, false);

    const explained = await client.callTool({ name: "empirical_explain_observation", arguments: { ...request, observationIndex: 96 } });
    assert.equal(explained.isError, undefined);
    assert.match(explained.structuredContent.result.explanation.boundary, /not causal identification/i);

    const receipt = await client.callTool({ name: "empirical_export_receipt", arguments: request });
    assert.equal(receipt.isError, undefined);
    assert.equal(receipt.structuredContent.result.kind, "empirical-research-receipt");

    const aggregate = await client.callTool({ name: "empirical_aggregate_receipts", arguments: { receipts: createSyntheticRegistryDemo(scenarioById["llm-deployment"]) } });
    assert.equal(aggregate.isError, undefined);
    assert.equal(aggregate.structuredContent.result.cohort.compatibleObservedStudies, 2);
    assert.match(aggregate.structuredContent.result.interpretationBoundary, /not a meta-analysis/i);

    const filePath = join(root, "research.csv");
    await writeFile(filePath, empiricalCsv(example), "utf8");
    const resourceRequest = { ...request };
    delete resourceRequest.data;
    const resource = await client.callTool({ name: "empirical_analyze_resource", arguments: { ...resourceRequest, filePath } });
    assert.equal(resource.isError, undefined);
    assert.equal(resource.structuredContent.result.processing.mode, "local-mcp");
  } finally {
    await client.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("authenticated remote MCP exposes table analysis but never local file access", async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createVtlMcpServer(undefined, { empiricalMode: "remote-mcp", empiricalTokenAuthenticated: true });
  const client = new Client({ name: "vtl-remote-test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    assert.ok(names.includes("empirical_analyze_table"));
    assert.ok(names.includes("empirical_explain_observation"));
    assert.ok(names.includes("empirical_export_receipt"));
    assert.ok(names.includes("empirical_aggregate_receipts"));
    assert.equal(names.includes("empirical_analyze_resource"), false);
    const { request } = empiricalResearchFixture({ privacy: { remoteProcessingAuthorized: true } });
    const result = await client.callTool({ name: "empirical_analyze_table", arguments: request });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.result.processing.mode, "remote-mcp");
    assert.equal(result.structuredContent.result.receipt.source.rawDataIncluded, false);
  } finally {
    await client.close();
    await server.close();
  }
});
