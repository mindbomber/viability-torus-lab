import type {
  RupturePolicy,
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

export type WatchlistTier = "red" | "orange" | "yellow";

export type CalibrationLevel =
  | "illustrative"
  | "literature-informed"
  | "empirically-calibrated"
  | "externally-validated";

export type MaintenancePatternId =
  | "regeneration-depletion"
  | "flow-backlog"
  | "detection-correction"
  | "maintenance-renewal"
  | "propagation-containment"
  | "trust-redress"
  | "reserves-solvency";

/** Compatibility name retained for v1 machine clients. */
export type ModelFamily = MaintenancePatternId;

export type DynamicTrait =
  | "delayed-feedback"
  | "capacity-saturation"
  | "threshold-crossing"
  | "hysteresis"
  | "network-propagation"
  | "irreversible-loss"
  | "phase-coupling"
  | "multi-timescale";

export type PhaseSource =
  | "operational-stage"
  | "seasonal"
  | "market-cycle"
  | "policy-cycle"
  | "estimated"
  | "synthetic";

export type ScenarioParameterRange = { min: number; max: number; step: number };

export type ComposableParameterKey = Exclude<
  keyof SimulationParameters,
  "seed" | "steps" | "dt"
>;

export type ParameterObservationProxy = {
  observable: string;
  normalization: string;
  updateCadence: string;
  sourceStatus: "proposed-observable-proxy" | "documented-observable-proxy";
};

/**
 * Provenance for the default parameter snapshot shown in the laboratory.
 * Published systems use this to distinguish a dated present-state hypothesis
 * from a calibrated measurement or a future scenario transform.
 */
export type CurrentStateEstimate = {
  asOfDate: string;
  observationWindow: string;
  observationCadence: string;
  candidateTimeAnchor: string;
  reviewCadence: string;
  confidence: "low" | "medium" | "high";
  basis: "illustrative-current-state-hypothesis" | "literature-informed-current-state-estimate" | "empirically-fitted-current-state-estimate";
  allModelParametersRevisable: true;
  parameterProxies: Record<ComposableParameterKey, ParameterObservationProxy>;
  limitations: string[];
};

export type ParameterTransform = {
  parameter: ComposableParameterKey;
  operation: "add" | "multiply" | "set";
  value: number;
};

export type ScenarioEvidence = {
  status: "illustrative" | "calibrated";
  calibrationStatus: string;
  parameterUnits: string;
  assumptions: string[];
  falsificationCriteria: string[];
  references: { title: string; url?: string }[];
};

export type RecurrentPhaseDefinition = {
  label: string;
  stages: string[];
  description: string;
  defaultFrequency: number;
  phaseSource: PhaseSource;
};

/**
 * A reusable structural archetype. It describes how a class of systems stores
 * debt, restores viable recurrence, and approaches terminal conditions without
 * claiming that any one real-world system has already been calibrated.
 */
export type SystemTemplateDefinition = {
  id: ModelFamily;
  version: string;
  title: string;
  summary: string;
  modelFamily: ModelFamily;
  stateArchetype: string;
  structuralAssumptions: string[];
  learningQuestions: string[];
  typicalDynamicTraits: DynamicTrait[];
  baseDynamics: Partial<SimulationParameters>;
  rupturePolicy: {
    cumulativeLossThreshold: number;
    debtThreshold: number;
    persistenceSteps: number;
  };
  provenance: "illustrative-maintenance-pattern";
};

export type MaintenancePatternDefinition = SystemTemplateDefinition;

export type BoundedSystemDefinition = {
  id: string;
  version: string;
  templateId: ModelFamily;
  maintenancePatternId: MaintenancePatternId;
  title: string;
  shortTitle: string;
  category: ScenarioCategory;
  domain: ScenarioCategory;
  dynamicTraits: DynamicTrait[];
  operator: string;
  boundary: string;
  objective: string;
  population: string;
  horizon: string;
  aggregation: string;
  viableRegion: string;
  stateVariables: string[];
  constraints: {
    physical: string[];
    biological: string[];
    constructed: string[];
  };
  cycles: {
    minor: RecurrentPhaseDefinition;
    major: RecurrentPhaseDefinition;
  };
  phaseEvidence: {
    thetaSource: string;
    phiSource: string;
    independenceClaim: string;
  };
};

export type ScenarioModuleKind = "baseline" | "stress" | "recovery-context";

/** A scenario is a reusable exogenous condition module, not the system itself. */
export type ScenarioModuleDefinition = {
  id: string;
  version: string;
  title: string;
  kind: ScenarioModuleKind;
  summary: string;
  conditions: string[];
  stressors: string[];
  learningObjective: string;
  transforms: ParameterTransform[];
  compatibleTemplateIds: ModelFamily[] | "all";
  provenance: "illustrative-scenario-module";
};

export type ScenarioProtocolDefinition = {
  id: string;
  systemId: string;
  templateId: ModelFamily;
  moduleId: string;
  version: string;
  title: string;
  kind: ScenarioModuleKind;
  summary: string;
  conditions: string[];
  stressors: string[];
  interventions: string[];
  parameterRationale: string;
  learningObjective: string;
  parameters: SimulationParameters;
  provenance: "illustrative-system-protocol";
};

export type InterventionMechanism =
  | "increase-constraint-visibility"
  | "reduce-misclassification"
  | "reduce-optimization-pressure"
  | "expand-correction-capacity"
  | "contain-and-observe"
  | "repay-alignment-debt";

export type InterventionDefinition = {
  id: string;
  version: string;
  title: string;
  shortTitle: string;
  icon: string;
  mechanism: InterventionMechanism;
  summary: string;
  transforms: ParameterTransform[];
  compatibleTemplateIds: ModelFamily[] | "all";
  timing: {
    onsetDelaySteps: number;
    defaultDurationSteps?: number;
    decay: "persistent" | "restore-at-end";
  };
  cost: {
    base: number;
    perIntensity: number;
    unit: "illustrative-cost-points";
  };
  prerequisites: string[];
  tradeoffs: string[];
  domainTranslations: Partial<Record<ScenarioCategory, string>>;
  evidence: {
    status: "illustrative";
    calibrationStatus: string;
  };
  provenance: "illustrative-intervention-module";
};

export type InterventionPlanItem = {
  interventionId: string;
  intensity: number;
  startFraction: number;
  onsetDelaySteps?: number;
  durationSteps?: number;
};

export type InterventionPlanDefinition = {
  id: string;
  version: string;
  title: string;
  strategy: "none" | "preventive" | "corrective" | "restorative" | "containment";
  summary: string;
  learningObjective: string;
  items: InterventionPlanItem[];
  compatibleTemplateIds: ModelFamily[] | "all";
  provenance: "illustrative-intervention-plan";
};

export type LaboratoryComposition = {
  maintenancePattern: MaintenancePatternDefinition;
  /** @deprecated Prefer maintenancePattern; retained for v1 clients. */
  template: SystemTemplateDefinition;
  system: BoundedSystemDefinition;
  protocol: ScenarioProtocolDefinition;
  interventionPlan: InterventionPlanDefinition;
  parameters: SimulationParameters;
  interventions: ScheduledIntervention[];
};

export type ScenarioDefinition = {
  id: string;
  version: string;
  title: string;
  shortTitle: string;
  summary: string;
  category: ScenarioCategory;
  watchlistTier: WatchlistTier;
  featured: boolean;
  modelFamily: ModelFamily;
  maintenancePatternId: MaintenancePatternId;
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
  currentStateEstimate?: CurrentStateEstimate;
  system: BoundedSystemDefinition;
  defaultProtocolId: string;
  protocols: ScenarioProtocolDefinition[];
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
  rupturePolicy: RupturePolicy & {
    provenance: "illustrative-scenario-policy";
    rationale: string;
  };
  defaults: SimulationParameters;
  presets: { name: string; description: string; values: Partial<SimulationParameters> }[];
};

export type ExperimentSpec = {
  schemaVersion?: string;
  name?: string;
  /** @deprecated Prefer systemId; retained for v1 clients. */
  scenarioId?: string;
  systemId?: string;
  protocolId?: string;
  interventionPlanId?: string;
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
  boundaryCrossingRate: number;
  irreversibleRuptureRate: number;
  /** @deprecated Retained as the v1 alias for boundaryCrossingRate. */
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
  maintenancePattern: { id: string; version: string; title: string };
  /** @deprecated Prefer maintenancePattern; retained for v1 clients. */
  template: { id: string; version: string; title: string };
  system: { id: string; version: string; title: string };
  protocol: { id: string; version: string; title: string };
  interventionPlan: { id: string; version: string; title: string };
  configuration: {
    protocolId: string;
    interventionPlanId: string;
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
