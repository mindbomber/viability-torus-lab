import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { CONTRACT_VERSION, LOCAL_EXECUTION_LIMITS, type ExecutionLimits } from "../contracts/constants.ts";
import { compareExperiments, runExperiment, sweepParameters } from "../contracts/experiments.ts";
import { getModelManifest } from "../contracts/metadata.ts";
import { validateScenarioProposal } from "../contracts/proposals.ts";
import { comparisonSpecSchema, experimentSpecSchema, scenarioProposalSchema, sweepSpecSchema } from "../contracts/schemas.ts";
import { scenarioById, scenarios } from "../scenarios/catalog.ts";

const resultSchema = { result: z.unknown() };
const asToolResult = (result: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  structuredContent: { result },
});

export function createVtlMcpServer(limits: ExecutionLimits = LOCAL_EXECUTION_LIMITS) {
  const server = new McpServer(
    { name: "viability-torus-lab", version: CONTRACT_VERSION },
    { instructions: "Use get_model_info before experiments when model scope is unclear. List or fetch a scenario before changing parameters. Treat results as synthetic model evidence, not empirical or operational advice. Use validate_scenario_proposal before proposing publication; validation never publishes a scenario and human review is required." },
  );

  server.registerTool("get_model_info", {
    title: "Get model information",
    description: "Return model versions, parameter bounds, public limits, scientific scope, schemas, and endpoints.",
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => asToolResult(getModelManifest()));

  server.registerTool("list_scenarios", {
    title: "List scenarios",
    description: "List published scenario definitions, optionally filtered by domain category.",
    inputSchema: { category: z.enum(["AI", "Organizations", "Healthcare", "Ecology"]).optional() },
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ category }) => asToolResult({ scenarios: category ? scenarios.filter((scenario) => scenario.category === category) : scenarios }));

  server.registerTool("get_scenario", {
    title: "Get scenario",
    description: "Return one published scenario definition by stable id.",
    inputSchema: { scenarioId: z.string() },
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ scenarioId }) => asToolResult(scenarioById[scenarioId] ?? { error: `Unknown scenario '${scenarioId}'.` }));

  server.registerTool("run_simulation", {
    title: "Run simulation",
    description: "Run one deterministic seed or a bounded seed ensemble and return summaries with optional sampled frames.",
    inputSchema: experimentSpecSchema,
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (input) => asToolResult(runExperiment(input, limits)));

  server.registerTool("compare_runs", {
    title: "Compare experiments",
    description: "Run and compare two experiment specifications using the same versioned model contract.",
    inputSchema: comparisonSpecSchema,
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (input) => asToolResult(compareExperiments(input, limits)));

  server.registerTool("sweep_parameters", {
    title: "Sweep parameters",
    description: "Evaluate a bounded Cartesian parameter grid and rank candidates by rupture avoidance, alignment, debt, and stability.",
    inputSchema: sweepSpecSchema,
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (input) => asToolResult(sweepParameters(input, limits)));

  server.registerTool("validate_scenario_proposal", {
    title: "Validate draft scenario proposal",
    description: "Validate a draft scenario's schema, semantics, and seeded evidence. This tool never publishes the proposal.",
    inputSchema: scenarioProposalSchema,
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (input) => asToolResult(validateScenarioProposal(input, limits)));

  return server;
}
