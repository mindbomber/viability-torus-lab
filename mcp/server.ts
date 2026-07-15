import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { CONTRACT_VERSION, EMPIRICAL_EXECUTION_LIMITS, LOCAL_EXECUTION_LIMITS, type ExecutionLimits } from "../contracts/constants.ts";
import { compareExperiments, runExperiment, sweepParameters } from "../contracts/experiments.ts";
import { getModelManifest } from "../contracts/metadata.ts";
import { validateScenarioProposal } from "../contracts/proposals.ts";
import { comparisonSpecSchema, empiricalEvidenceRegistryRequestSchema, empiricalResearchExplanationRequestSchema, empiricalResearchRequestSchema, empiricalResearchResourceRequestSchema, experimentSpecSchema, externalTelemetrySchema, scenarioProposalSchema, sweepSpecSchema } from "../contracts/schemas.ts";
import { analyzeTelemetryRequest } from "../contracts/telemetry.ts";
import { reproducePaperCase } from "../contracts/research.ts";
import { analyzeEmpiricalRequest, explainEmpiricalObservation, type EmpiricalProcessingMode } from "../empirical/headless.ts";
import { materializeEmpiricalCsvResource } from "../empirical/local-resource.ts";
import { aggregateEmpiricalReceipts } from "../empirical/registry.ts";
import { scenarioById, scenarios } from "../scenarios/catalog.ts";
import { composeLaboratoryRun } from "../scenarios/composition.ts";
import { interventionDefinitions, interventionPlans } from "../scenarios/interventions.ts";
import { scenarioModules } from "../scenarios/protocols.ts";
import { systemTemplates } from "../scenarios/templates.ts";

const resultSchema = { result: z.unknown() };
const systemCategorySchema = z.enum(["AI", "Ecology", "Healthcare", "Organizations", "Infrastructure", "Economy", "Society"]);
const systemListInputSchema = {
  category: systemCategorySchema.optional(),
  tier: z.enum(["red", "orange", "yellow"]).optional(),
  featured: z.boolean().optional(),
};
const asToolResult = (result: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  structuredContent: { result },
});

export type VtlMcpOptions = {
  empiricalMode?: EmpiricalProcessingMode | "disabled";
  empiricalRoots?: string[];
  empiricalTokenAuthenticated?: boolean;
  allowSensitiveRemoteData?: boolean;
};

export function createVtlMcpServer(limits: ExecutionLimits = LOCAL_EXECUTION_LIMITS, options: VtlMcpOptions = {}) {
  const empiricalMode = options.empiricalMode ?? "local-mcp";
  const empiricalPolicy = empiricalMode === "disabled" ? null : {
    mode: empiricalMode,
    tokenAuthenticated: empiricalMode === "local-mcp" ? false : options.empiricalTokenAuthenticated === true,
    allowSensitiveRemoteData: empiricalMode === "local-mcp" || options.allowSensitiveRemoteData === true,
    maxReturnedReplayPoints: empiricalMode === "local-mcp" ? EMPIRICAL_EXECUTION_LIMITS.maxLocalReturnedReplayPoints : EMPIRICAL_EXECUTION_LIMITS.maxReturnedReplayPoints,
  };
  const server = new McpServer(
    { name: "viability-torus-lab", version: CONTRACT_VERSION },
    { instructions: "Use get_model_info before experiments when model scope is unclear. Compose a reusable system template, a concrete bounded system, a scenario module, and an intervention plan; treat the resulting status as a run assessment. Scenario modules change conditions, intervention modules represent operator actions, and neither is the system itself. Simulation results are synthetic model evidence. Empirical tools return observed-descriptive, provisional receipts and model attribution, not causal identification or validation of the theory. Never force a torus interpretation when a phase gate fails. Use validate_scenario_proposal before proposing publication; validation never publishes a scenario and human review is required." },
  );

  server.registerTool("get_model_info", {
    title: "Get model information",
    description: "Return model versions, parameter bounds, public limits, scientific scope, schemas, and endpoints.",
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => asToolResult(getModelManifest()));

  server.registerTool("list_system_templates", {
    title: "List reusable system templates",
    description: "List the structural system classes that supply shared synthetic dynamics without defining a concrete real-world boundary.",
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => asToolResult({ systemTemplates }));

  server.registerTool("list_scenario_modules", {
    title: "List reusable scenario modules",
    description: "List modular exogenous condition and stress transforms that can be applied across compatible bounded systems.",
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => asToolResult({ scenarioModules }));

  server.registerTool("list_interventions", {
    title: "List intervention modules and plans",
    description: "List reusable corrective mechanisms, timing, costs, tradeoffs, domain translations, and composed intervention plans.",
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => asToolResult({ interventionDefinitions, interventionPlans }));

  server.registerTool("list_systems", {
    title: "List bounded systems",
    description: "List published bounded-system definitions and their scenario protocols, optionally filtered by category, derived default watchlist tier, or editorial featured status.",
    inputSchema: systemListInputSchema,
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ category, tier, featured }) => asToolResult({ systems: scenarios.filter((scenario) =>
    (!category || scenario.category === category) &&
    (!tier || scenario.watchlistTier === tier) &&
    (featured === undefined || scenario.featured === featured)
  ) }));

  server.registerTool("get_system", {
    title: "Get bounded system",
    description: "Return one bounded-system definition, its protocols, and its derived default educational assessment metadata by stable id.",
    inputSchema: { systemId: z.string() },
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ systemId }) => asToolResult(scenarioById[systemId] ?? { error: `Unknown system '${systemId}'.` }));

  server.registerTool("list_scenarios", {
    title: "List scenarios (compatibility alias)",
    description: "Compatibility alias that returns the published bounded systems and their attached scenario protocols.",
    inputSchema: { category: systemCategorySchema.optional() },
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ category }) => asToolResult({ scenarios: category ? scenarios.filter((scenario) => scenario.category === category) : scenarios }));

  server.registerTool("get_scenario", {
    title: "Get scenario (compatibility alias)",
    description: "Compatibility alias that returns a bounded system and its scenario protocols by stable id.",
    inputSchema: { scenarioId: z.string() },
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ scenarioId }) => asToolResult(scenarioById[scenarioId] ?? { error: `Unknown scenario '${scenarioId}'.` }));

  server.registerTool("compose_laboratory_run", {
    title: "Compose a laboratory run",
    description: "Resolve a bounded system, reusable scenario module or protocol, intervention plan, parameter overrides, and custom events into the exact deterministic engine configuration without running it.",
    inputSchema: experimentSpecSchema,
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (input) => asToolResult(composeLaboratoryRun({
    systemId: input.systemId ?? input.scenarioId!,
    protocolId: input.protocolId,
    interventionPlanId: input.interventionPlanId,
    parameters: input.parameters,
    interventions: input.interventions,
  })));

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

  server.registerTool("reproduce_paper_case", {
    title: "Reproduce a foundational paper case",
    description: "Run one exact Paper 2026 legacy regime with archived initial phases and return deterministic fixture verification.",
    inputSchema: {
      caseId: z.enum(["stable-periodic", "stable-quasiperiodic", "neutral-tube", "rupture-low-correction"]),
      includeFrames: z.boolean().optional().default(false),
    },
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ caseId, includeFrames }) => asToolResult(reproducePaperCase(caseId, includeFrames)));

  server.registerTool("analyze_external_telemetry", {
    title: "Analyze external mismatch telemetry",
    description: "Apply the revised phase-identifiability gate and signed temporal phase estimator to bounded imported observations.",
    inputSchema: externalTelemetrySchema,
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (input) => asToolResult(analyzeTelemetryRequest(input)));

  if (empiricalPolicy) {
    server.registerTool("empirical_analyze_table", {
      title: "Analyze an empirical research table",
      description: "Run the shared bounded empirical engine over inline rows or CSV content. Returns gates, sampled observed-driver replay, and a redacted receipt; it does not fit parameters or establish causality.",
      inputSchema: empiricalResearchRequestSchema,
      outputSchema: resultSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (input) => asToolResult(analyzeEmpiricalRequest(input, empiricalPolicy)));

    server.registerTool("empirical_explain_observation", {
      title: "Explain one empirical observation",
      description: "Re-evaluate a bounded empirical study and return the equation contribution trace and residual for one observation index.",
      inputSchema: empiricalResearchExplanationRequestSchema,
      outputSchema: resultSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (input) => asToolResult(explainEmpiricalObservation(input, empiricalPolicy)));

    server.registerTool("empirical_export_receipt", {
      title: "Export a redacted empirical receipt",
      description: "Evaluate a bounded empirical study and return only its versioned receipt. Raw input rows are excluded.",
      inputSchema: empiricalResearchRequestSchema,
      outputSchema: resultSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (input) => asToolResult(analyzeEmpiricalRequest({ ...input, options: { ...input.options, includeReplayPoints: false } }, empiricalPolicy).receipt));

    server.registerTool("empirical_aggregate_receipts", {
      title: "Compare redacted empirical receipts",
      description: "Classify study receipts against an anchor and summarize only compatible observed receipts. Synthetic and non-comparable evidence remains visible but excluded; this is descriptive aggregation, not meta-analysis or fitting.",
      inputSchema: empiricalEvidenceRegistryRequestSchema,
      outputSchema: resultSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (input) => asToolResult(aggregateEmpiricalReceipts(input)));

    if (empiricalMode === "local-mcp") {
      server.registerTool("empirical_analyze_resource", {
        title: "Analyze an approved local empirical CSV",
        description: "Read a CSV only from a VTL_EMPIRICAL_ROOTS directory, then run the same empirical engine and redacted receipt workflow used by the UI and table tool.",
        inputSchema: empiricalResearchResourceRequestSchema,
        outputSchema: resultSchema,
        annotations: { readOnlyHint: true, openWorldHint: true },
      }, async (input) => asToolResult(analyzeEmpiricalRequest(
        await materializeEmpiricalCsvResource(input, options.empiricalRoots ?? []),
        empiricalPolicy,
      )));
    }
  }

  server.registerTool("validate_scenario_proposal", {
    title: "Validate draft scenario proposal",
    description: "Validate a draft scenario's schema, semantics, and seeded evidence. This tool never publishes the proposal.",
    inputSchema: scenarioProposalSchema,
    outputSchema: resultSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (input) => asToolResult(validateScenarioProposal(input, limits)));

  return server;
}
