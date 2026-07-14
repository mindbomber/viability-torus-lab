import { MAX_INTERNAL_DT, MODEL_VERSION } from "../engine/simulator.ts";
import { scenarios } from "../scenarios/catalog.ts";
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
    scientificScope: "Synthetic model behavior; scenario mappings and optimized parameters are hypotheses, not empirical or operational recommendations.",
    evidencePolicy: {
      kind: "synthetic-model",
      empiricalValidation: false,
      publicationGate: "Human review and deterministic reference cases are required before a scenario enters the published registry.",
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
      policyProvenance: "Each scenario declares an illustrative rupture policy pending domain calibration.",
    },
    aix: {
      framework: "ATS-4.0",
      components: ["P", "B", "C", "F", "M", "G", "R", "Pi"],
      gate: "Verifier-grounded AANA accept/revise/defer/refuse decision",
      calibration: "Transparent synthetic heuristics; not an empirically calibrated domain score.",
    },
    capabilities: [
      "list-scenarios",
      "run-seeded-simulation",
      "run-ensembles",
      "compare-experiments",
      "sweep-parameters",
      "reproduce-paper-cases",
      "analyze-imported-telemetry",
      "evaluate-full-ats4-aix",
      "validate-draft-scenario-proposals",
    ],
    endpoints: {
      model: url("/api/v1/model"),
      scenarios: url("/api/v1/scenarios"),
      simulate: url("/api/v1/simulate"),
      compare: url("/api/v1/compare"),
      sweep: url("/api/v1/sweep"),
      paperReproduction: url("/api/v1/research/paper"),
      telemetry: url("/api/v1/telemetry"),
      validateProposal: url("/api/v1/proposals/validate"),
      mcp: url("/mcp"),
      schemas: url("/schemas/v1/index.json"),
      paper: url("/paper.pdf"),
      source: "https://github.com/mindbomber/viability-torus-lab",
    },
    scenarioCount: scenarios.length,
    limits: PUBLIC_EXECUTION_LIMITS,
    parameters: PARAMETER_LIMITS,
  };
}
