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
  category: "AI" | "Organizations" | "Healthcare" | "Ecology";
  difficulty: "Introductory" | "Intermediate" | "Advanced";
  icon: string;
  accent: string;
  optimizedOutcome: string;
  viableRegion: string;
  hiddenConstraint: string;
  debtMechanism: string;
  irreversibleMechanism: string;
  interventionIds: string[];
  warningConditions: string[];
  ruptureCondition: string;
  recoveryCondition: string;
  plainLanguageInterpretation: string;
  evidence: ScenarioEvidence;
  cycles: {
    minor: { label: string; stages: string[]; description: string };
    major: { label: string; stages: string[]; description: string };
  };
  labels: Record<ParameterKey, string>;
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
