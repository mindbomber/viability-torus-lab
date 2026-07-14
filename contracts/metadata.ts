import { MODEL_VERSION } from "../engine/simulator.ts";
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
    description: "Deterministic two-phase toroidal viability simulation for alignment-aware systems research.",
    modelVersion: MODEL_VERSION,
    contractVersion: CONTRACT_VERSION,
    apiVersion: API_VERSION,
    scientificScope: "Synthetic model behavior; scenario mappings and optimized parameters are hypotheses, not empirical or operational recommendations.",
    capabilities: [
      "list-scenarios",
      "run-seeded-simulation",
      "run-ensembles",
      "compare-experiments",
      "sweep-parameters",
      "validate-draft-scenario-proposals",
    ],
    endpoints: {
      model: url("/api/v1/model"),
      scenarios: url("/api/v1/scenarios"),
      simulate: url("/api/v1/simulate"),
      compare: url("/api/v1/compare"),
      sweep: url("/api/v1/sweep"),
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
