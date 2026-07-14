import type {
  ScheduledIntervention,
  SimulationFrame,
  SimulationParameters,
  SimulationSummary,
} from "../engine/simulator.ts";

export type ParameterKey = keyof Pick<
  SimulationParameters,
  | "pressure"
  | "error"
  | "feedback"
  | "correction"
  | "drift"
  | "irreversibleLoss"
  | "initialDebt"
>;

export type ScenarioCategory =
  | "AI"
  | "Ecology"
  | "Healthcare"
  | "Organizations"
  | "Infrastructure"
  | "Economy"
  | "Society";

export type WatchlistTier = "red" | "orange" | "yellow" | "featured";

export type CalibrationLevel =
  | "illustrative"
  | "literature-informed"
  | "empirically-calibrated"
  | "externally-validated";

export type ModelFamily =
  | "regenerative-stock"
  | "threshold-regime-shift"
  | "resistance-contagion"
  | "trust-legitimacy"
  | "capability-correction"
  | "network-cascade"
  | "financial-leverage"
  | "human-capacity";

export type PhaseSource =
  | "operational-stage"
  | "seasonal"
  | "market-cycle"
  | "policy-cycle"
  | "estimated"
  | "synthetic";

export type ScenarioParameterRange = { min: number; max: number; step: number };

export type ScenarioEvidence = {
  status: "illustrative" | "calibrated";
  calibrationStatus: string;
  parameterUnits: string;
  assumptions: string[];
  falsificationCriteria: string[];
  references: { title: string; url?: string }[];
};

export type ScenarioDefinition = {
  id: string;
  version: string;
  title: string;
  shortTitle: string;
  summary: string;
  category: ScenarioCategory;
  watchlistTier: WatchlistTier;
  modelFamily: ModelFamily;
  calibration: CalibrationLevel;
  difficulty: "Introductory" | "Intermediate" | "Advanced";
  icon: string;
  accent: string;
  optimizedOutcome: string;
  viableRegion: string;
  hiddenConstraint: string;
  debtMechanism: string;
  irreversibleMechanism: string;
  interventionIds: string[];
  events: string[];
  interventions: string[];
  warningConditions: string[];
  ruptureCondition: string;
  recoveryCondition: string;
  plainLanguageInterpretation: string;
  evidence: ScenarioEvidence;
  cycles: {
    minor: { label: string; stages: string[]; description: string; defaultFrequency: number; phaseSource: PhaseSource };
    major: { label: string; stages: string[]; description: string; defaultFrequency: number; phaseSource: PhaseSource };
  };
  labels: Record<ParameterKey, string> & {
    restoration: string;
    debtCoupling: string;
    radialExcursion: string;
  };
  aixLabels: {
    physical: string;
    biological: string;
    constructed: string;
    feedback: string;
  };
  ranges: Record<ParameterKey, ScenarioParameterRange>;
  thresholds: {
    warningRho: number;
    criticalRho: number;
    irreversibleRho: number;
    phaseConfidenceMinimum: number;
  };
  defaults: SimulationParameters;
  presets: { name: string; description: string; values: Partial<SimulationParameters> }[];
};

export type ExperimentSpec = {
  schemaVersion?: string;
  name?: string;
  scenarioId: string;
  parameters?: Partial<SimulationParameters>;
  interventions?: ScheduledIntervention[];
  seeds?: number[];
  includeFrames?: boolean;
  frameStride?: number;
};

export type ExperimentRun = {
  seed: number;
  summary: SimulationSummary;
  frames?: SimulationFrame[];
  returnedFrameStride?: number;
};

export type EnsembleSummary = {
  runCount: number;
  ruptureRate: number;
  recoveryRate: number;
  meanStableFraction: number;
  meanFinalAlignment: number;
  meanFinalDebt: number;
  meanMaxRho: number;
};

export type ExperimentResult = {
  schemaVersion: string;
  modelVersion: string;
  experimentId: string;
  scenario: { id: string; version: string; title: string };
  configuration: {
    parameters: SimulationParameters;
    interventions: ScheduledIntervention[];
    seeds: number[];
  };
  runs: ExperimentRun[];
  ensemble: EnsembleSummary;
  evidence: {
    kind: "synthetic-model";
    empiricalValidation: false;
    calibrationStatus: string;
    warnings: string[];
  };
};

export type SweepSpec = {
  schemaVersion?: string;
  base: ExperimentSpec;
  grid: Partial<Record<keyof SimulationParameters, number[]>>;
  objective?: "minimize-rupture-then-maximize-alignment";
  topK?: number;
};

export type ScenarioProposal = {
  schemaVersion?: string;
  status: "draft";
  action: "create" | "revise";
  proposedBy: { kind: "agent" | "human"; name: string };
  rationale: string;
  scenario: ScenarioDefinition;
  evidence: {
    hypothesis: string;
    assumptions: string[];
    references: string[];
    evaluations: ProposalEvaluation[];
  };
};

export type ProposalEvaluation = {
  name: string;
  parameters?: Partial<SimulationParameters>;
  interventions?: ScheduledIntervention[];
  seeds?: number[];
  assertions: {
    maxRuptureRate?: number;
    minRuptureRate?: number;
    minFinalAlignment?: number;
    maxFinalAlignment?: number;
    maxFinalDebt?: number;
    maxMaxRho?: number;
    minStableFraction?: number;
  };
};
