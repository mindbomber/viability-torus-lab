import { MAX_INTERNAL_DT, MODEL_VERSION } from "../engine/simulator.ts";
import { featuredSystemCount, scenarios } from "../scenarios/catalog.ts";
import { interventionDefinitions, interventionPlans } from "../scenarios/interventions.ts";
import { scenarioModules } from "../scenarios/protocols.ts";
import { systemTemplates } from "../scenarios/templates.ts";
import {
  API_VERSION,
  CONTRACT_VERSION,
  PARAMETER_LIMITS,
  PUBLIC_EXECUTION_LIMITS,
} from "./constants.ts";

export function getModelManifest(origin = "") {
  const url = (path: string) => `${origin.replace(/\/$/, "")}${path}` || path;
  return {
    name: "Viability Torus Lab",
    description: "Deterministic two-phase toroidal viability simulation for synthetic alignment research and education.",
    modelVersion: MODEL_VERSION,
    contractVersion: CONTRACT_VERSION,
    apiVersion: API_VERSION,
    scientificScope: "Synthetic model behavior; bounded-system mappings and protocol parameters are hypotheses, not empirical or operational recommendations.",
    catalogModel: "system-template → bounded-system → scenario-module → intervention-plan → run-assessment",
    evidencePolicy: {
      kind: "synthetic-model",
      empiricalValidation: false,
      publicationGate: "Human review and deterministic reference cases are required before a bounded system and protocol enter the published registry.",
      empiricalResearch: "Researcher-supplied observations are classified as observed-descriptive. Receipts and explanations remain provisional model evidence, not causal or empirical validation of the theory.",
      evidenceRegistry: "Redacted receipts are compared against an anchor. Only compatible observed receipts receive descriptive summaries; negative, synthetic, and non-comparable studies remain visible and no watchlist tier is averaged.",
    },
    empiricalResearchAccess: {
      browser: "Browser-local import is enabled and does not upload or persist source rows.",
      localMcp: "Enabled by the stdio MCP server. Local CSV access is restricted to VTL_EMPIRICAL_ROOTS; connector rows may be passed to empirical_analyze_table.",
      httpApi: "Disabled by default. Self-hosted operators must set VTL_ENABLE_EMPIRICAL_API=true and VTL_EMPIRICAL_API_TOKEN; remote requests must explicitly authorize remote processing.",
      retention: "request-only",
      rawInputLogging: false,
      sensitiveDataDefault: "Remote sensitive or restricted data are rejected unless deidentified; an operator must explicitly opt in to any exception.",
    },
    numerics: {
      method: "bounded explicit Euler substeps",
      maximumInternalStep: MAX_INTERNAL_DT,
      note: "Requested dt values above the internal bound are integrated through deterministic substeps and charged against the public work budget.",
    },
    phaseEstimation: {
      observable: "synthetic external-adaptation mismatch derived from the latent major phase",
      gate: "amplitude, spectral concentration, at least two observed cycles, and sampling adequacy",
      regimes: "Viability is classified independently. Identifiable phase trajectories are classified as recurrent winding or rational phase locking across low-order signed ratios.",
      limitation: "The synthetic estimator demonstrates the revised coordinate construction; it is not a calibrated real-world AIx phase measurement.",
    },
    viabilitySemantics: {
      states: ["Viable recurrence", "Viability-boundary crossing", "Recoverable excursion", "Irreversible rupture"],
      terminalRule: "Persistent boundary excursion plus cumulative irreversible loss and either domain-policy debt or radial severity.",
      displayedMargins: ["C-D", "C-D-chi*debt", "d-rho/dt"],
      policyProvenance: "Each bounded-system mapping declares an illustrative rupture policy pending domain calibration.",
    },
    aix: {
      framework: "ATS-4.0",
      components: ["P", "B", "C", "F", "M", "G", "R", "Pi"],
      gate: "Verifier-grounded AANA accept/revise/defer/refuse decision",
      calibration: "Transparent synthetic heuristics; not an empirically calibrated domain score.",
    },
    capabilities: [
      "list-reusable-system-templates",
      "list-bounded-systems-and-protocols",
      "list-and-compose-scenario-modules",
      "list-and-schedule-intervention-modules-and-plans",
      "run-seeded-simulation",
      "run-ensembles",
      "compare-experiments",
      "sweep-parameters",
      "reproduce-paper-cases",
      "analyze-imported-telemetry",
      "analyze-researcher-empirical-tables",
      "export-redacted-empirical-receipts",
      "compare-and-descriptively-aggregate-compatible-receipts",
      "evaluate-full-ats4-aix",
      "validate-draft-scenario-proposals",
    ],
    endpoints: {
      model: url("/api/v1/model"),
      systems: url("/api/v1/systems"),
      scenarios: url("/api/v1/scenarios"),
      laboratory: url("/api/v1/laboratory"),
      systemTemplates: url("/api/v1/system-templates"),
      scenarioModules: url("/api/v1/scenario-modules"),
      interventions: url("/api/v1/interventions"),
      simulate: url("/api/v1/simulate"),
      compare: url("/api/v1/compare"),
      sweep: url("/api/v1/sweep"),
      paperReproduction: url("/api/v1/research/paper"),
      telemetry: url("/api/v1/telemetry"),
      empiricalAnalyze: url("/api/v1/empirical/analyze"),
      empiricalAggregate: url("/api/v1/empirical/aggregate"),
      validateProposal: url("/api/v1/proposals/validate"),
      mcp: url("/mcp"),
      schemas: url("/schemas/v1/index.json"),
      paper: url("/paper.pdf"),
      source: "https://github.com/mindbomber/viability-torus-lab",
    },
    systemCount: scenarios.length,
    systemTemplateCount: systemTemplates.length,
    scenarioModuleCount: scenarioModules.length,
    interventionDefinitionCount: interventionDefinitions.length,
    interventionPlanCount: interventionPlans.length,
    scenarioCount: scenarios.length,
    featuredSystemCount,
    limits: PUBLIC_EXECUTION_LIMITS,
    parameters: PARAMETER_LIMITS,
  };
}
