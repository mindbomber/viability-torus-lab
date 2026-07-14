import type { SimulationParameters } from "../engine/simulator.ts";

export const CONTRACT_VERSION = "1.0.0";
export const API_VERSION = "v1";
export const SCENARIO_SCHEMA_VERSION = "1.0.0";

export const PUBLIC_EXECUTION_LIMITS = {
  maxRuns: 50,
  maxStepsPerRun: 5_000,
  maxReturnedFramesPerRun: 2_000,
  maxTotalReturnedFrames: 5_000,
  maxTotalIntegrationSteps: 2_000_000,
  maxInterventions: 32,
  maxSweepCandidates: 250,
  maxSweepValuesPerParameter: 20,
  maxSweepParameters: 5,
} as const;

export const LOCAL_EXECUTION_LIMITS = {
  ...PUBLIC_EXECUTION_LIMITS,
  maxRuns: 500,
  maxStepsPerRun: 10_000,
  maxSweepCandidates: 10_000,
  maxTotalReturnedFrames: 100_000,
  maxTotalIntegrationSteps: 100_000_000,
} as const;

export type ExecutionLimits = {
  maxRuns: number;
  maxStepsPerRun: number;
  maxReturnedFramesPerRun: number;
  maxTotalReturnedFrames: number;
  maxTotalIntegrationSteps: number;
  maxInterventions: number;
  maxSweepCandidates: number;
  maxSweepValuesPerParameter: number;
  maxSweepParameters: number;
};

type ParameterLimit = {
  min: number;
  max: number;
  integer?: boolean;
  description: string;
};

export const PARAMETER_LIMITS: Record<keyof SimulationParameters, ParameterLimit> = {
  pressure: { min: 0, max: 3, description: "Optimization or deployment pressure." },
  error: { min: 0, max: 1, description: "Constraint misunderstanding or error rate." },
  feedback: { min: 0, max: 1, description: "Feedback fidelity." },
  correction: { min: 0, max: 1.5, description: "Correction capacity." },
  drift: { min: 0, max: 0.5, description: "Environmental drift." },
  irreversibleLoss: { min: 0, max: 0.35, description: "Irreversible loss rate." },
  initialDebt: { min: 0, max: 2, description: "Initial alignment debt." },
  kappa: { min: 0, max: 2, description: "Radial restoring coefficient." },
  chi: { min: 0, max: 2, description: "Debt-to-excursion coupling." },
  omegaTheta: { min: -2, max: 2, description: "Minor-cycle angular frequency." },
  omegaPhi: { min: -2, max: 2, description: "Major-cycle angular frequency." },
  couplingA: { min: -1, max: 1, description: "Major-to-minor phase coupling." },
  couplingB: { min: -1, max: 1, description: "Minor-to-major phase coupling." },
  rho0: { min: 0.03, max: 5, description: "Reference radial excursion." },
  rhoCrit: { min: 0.1, max: 10, description: "Critical radial viability boundary." },
  alpha: { min: 0, max: 2, description: "Debt accumulation coefficient." },
  beta: { min: 0, max: 2, description: "Debt repayment coefficient." },
  seed: { min: 0, max: 4_294_967_295, integer: true, description: "Unsigned deterministic seed." },
  steps: { min: 1, max: 10_000, integer: true, description: "Integration steps." },
  dt: { min: 0.001, max: 10, description: "Integration time step." },
};

export const PARAMETER_KEYS = Object.keys(PARAMETER_LIMITS) as (keyof SimulationParameters)[];
export const INTERVENTION_PARAMETER_KEYS = PARAMETER_KEYS.filter(
  (key) => !["seed", "steps", "dt"].includes(key),
);
export const SWEEPABLE_PARAMETER_KEYS = INTERVENTION_PARAMETER_KEYS;
