import * as z from "zod/v4";
import {
  CONTRACT_VERSION,
  EMPIRICAL_EXECUTION_LIMITS,
  PARAMETER_LIMITS,
  PUBLIC_EXECUTION_LIMITS,
} from "./constants.ts";

const boundedNumber = (key: keyof typeof PARAMETER_LIMITS) => {
  const limit = PARAMETER_LIMITS[key];
  let schema = z.number().finite().min(limit.min).max(limit.max).describe(limit.description);
  if (limit.integer) schema = schema.int();
  return schema;
};

const simulationParametersObject = z.object({
  pressure: boundedNumber("pressure"),
  error: boundedNumber("error"),
  feedback: boundedNumber("feedback"),
  correction: boundedNumber("correction"),
  drift: boundedNumber("drift"),
  irreversibleLoss: boundedNumber("irreversibleLoss"),
  initialDebt: boundedNumber("initialDebt"),
  kappa: boundedNumber("kappa"),
  chi: boundedNumber("chi"),
  omegaTheta: boundedNumber("omegaTheta"),
  omegaPhi: boundedNumber("omegaPhi"),
  couplingA: boundedNumber("couplingA"),
  couplingB: boundedNumber("couplingB"),
  rho0: boundedNumber("rho0"),
  rhoCrit: boundedNumber("rhoCrit"),
  alpha: boundedNumber("alpha"),
  beta: boundedNumber("beta"),
  seed: boundedNumber("seed"),
  steps: boundedNumber("steps"),
  dt: boundedNumber("dt"),
}).strict();

export const simulationParametersSchema = simulationParametersObject.superRefine(
  (value, context) => {
    if (value.rho0 >= value.rhoCrit) {
      context.addIssue({
        code: "custom",
        path: ["rho0"],
        message: "rho0 must remain below rhoCrit.",
      });
    }
  },
);

export const parameterOverridesSchema = simulationParametersObject.partial().strict();
export const interventionEffectsSchema = simulationParametersObject
  .omit({ seed: true, steps: true, dt: true })
  .partial()
  .strict();

export const scheduledInterventionSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  step: z.number().int().min(0).max(9_999),
  effects: interventionEffectsSchema.refine((value) => Object.keys(value).length > 0, {
    message: "An intervention must change at least one parameter.",
  }),
  cost: z.number().finite().min(0).max(1_000_000),
}).strict();

export const experimentSpecSchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION).optional().default(CONTRACT_VERSION),
  name: z.string().min(1).max(160).optional(),
  scenarioId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parameters: parameterOverridesSchema.optional().default({}),
  interventions: z.array(scheduledInterventionSchema).max(PUBLIC_EXECUTION_LIMITS.maxInterventions).optional().default([]),
  seeds: z.array(boundedNumber("seed")).min(1).max(500).optional(),
  includeFrames: z.boolean().optional().default(false),
  frameStride: z.number().int().min(1).max(10_000).optional().default(1),
}).strict();

export const comparisonSpecSchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION).optional().default(CONTRACT_VERSION),
  left: experimentSpecSchema,
  right: experimentSpecSchema,
}).strict();

const sweepValues = (key: keyof typeof PARAMETER_LIMITS) => z
  .array(boundedNumber(key))
  .min(1)
  .max(PUBLIC_EXECUTION_LIMITS.maxSweepValuesPerParameter);

export const sweepGridSchema = z.object({
  pressure: sweepValues("pressure").optional(),
  error: sweepValues("error").optional(),
  feedback: sweepValues("feedback").optional(),
  correction: sweepValues("correction").optional(),
  drift: sweepValues("drift").optional(),
  irreversibleLoss: sweepValues("irreversibleLoss").optional(),
  initialDebt: sweepValues("initialDebt").optional(),
  kappa: sweepValues("kappa").optional(),
  chi: sweepValues("chi").optional(),
  omegaTheta: sweepValues("omegaTheta").optional(),
  omegaPhi: sweepValues("omegaPhi").optional(),
  couplingA: sweepValues("couplingA").optional(),
  couplingB: sweepValues("couplingB").optional(),
  rho0: sweepValues("rho0").optional(),
  rhoCrit: sweepValues("rhoCrit").optional(),
  alpha: sweepValues("alpha").optional(),
  beta: sweepValues("beta").optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "The sweep grid must include at least one parameter.",
});

export const sweepSpecSchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION).optional().default(CONTRACT_VERSION),
  base: experimentSpecSchema,
  grid: sweepGridSchema,
  objective: z.literal("minimize-rupture-then-maximize-alignment").optional().default("minimize-rupture-then-maximize-alignment"),
  topK: z.number().int().min(1).max(50).optional().default(10),
}).strict();

const cycleSchema = z.object({
  label: z.string().min(3).max(120),
  stages: z.array(z.string().min(1).max(80)).min(2).max(20),
  description: z.string().min(10).max(500),
  defaultFrequency: z.number().finite().min(-2).max(2).default(0.05),
  phaseSource: z.enum(["operational-stage", "seasonal", "market-cycle", "policy-cycle", "estimated", "synthetic"]).default("synthetic"),
}).strict();

const parameterLabelsSchema = z.object({
  pressure: z.string().min(2).max(80),
  error: z.string().min(2).max(80),
  feedback: z.string().min(2).max(80),
  correction: z.string().min(2).max(80),
  drift: z.string().min(2).max(80),
  irreversibleLoss: z.string().min(2).max(80),
  initialDebt: z.string().min(2).max(80),
  restoration: z.string().min(2).max(120).default("Restoring strength"),
  debtCoupling: z.string().min(2).max(120).default("Debt pressure"),
  radialExcursion: z.string().min(2).max(160).default("Distance from viable recurrent operation"),
}).strict();

const parameterRangeSchema = z.object({
  min: z.number().finite(),
  max: z.number().finite(),
  step: z.number().finite().positive(),
}).strict().refine((value) => value.min < value.max, {
  message: "A scenario parameter range must have min below max.",
});

const parameterRangesSchema = z.object({
  pressure: parameterRangeSchema,
  error: parameterRangeSchema,
  feedback: parameterRangeSchema,
  correction: parameterRangeSchema,
  drift: parameterRangeSchema,
  irreversibleLoss: parameterRangeSchema,
  initialDebt: parameterRangeSchema,
}).strict();

const scenarioEvidenceSchema = z.object({
  status: z.enum(["illustrative", "calibrated"]),
  calibrationStatus: z.string().min(10).max(500),
  parameterUnits: z.string().min(10).max(500),
  assumptions: z.array(z.string().min(10).max(500)).min(1).max(30),
  falsificationCriteria: z.array(z.string().min(10).max(500)).min(1).max(30),
  references: z.array(z.object({
    title: z.string().min(3).max(300),
    url: z.string().min(1).max(1_000).optional(),
  }).strict()).min(1).max(30),
}).strict();

export const scenarioDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string().min(4).max(160),
  shortTitle: z.string().min(2).max(80),
  summary: z.string().min(20).max(500),
  category: z.enum(["AI", "Ecology", "Healthcare", "Organizations", "Infrastructure", "Economy", "Society"]),
  watchlistTier: z.enum(["red", "orange", "yellow", "featured"]).default("featured"),
  modelFamily: z.enum(["regenerative-stock", "threshold-regime-shift", "resistance-contagion", "trust-legitimacy", "capability-correction", "network-cascade", "financial-leverage", "human-capacity"]).default("capability-correction"),
  calibration: z.enum(["illustrative", "literature-informed", "empirically-calibrated", "externally-validated"]).default("illustrative"),
  difficulty: z.enum(["Introductory", "Intermediate", "Advanced"]),
  icon: z.string().min(1).max(12),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  optimizedOutcome: z.string().min(5).max(300),
  viableRegion: z.string().min(10).max(500),
  hiddenConstraint: z.string().min(10).max(500),
  debtMechanism: z.string().min(10).max(500),
  irreversibleMechanism: z.string().min(10).max(500),
  interventionIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1).max(30),
  events: z.array(z.string().min(3).max(200)).max(30).default([]),
  interventions: z.array(z.string().min(3).max(200)).min(1).max(30).default(["Expand correction capacity"]),
  warningConditions: z.array(z.string().min(5).max(300)).min(1).max(20),
  ruptureCondition: z.string().min(10).max(500),
  recoveryCondition: z.string().min(10).max(500),
  plainLanguageInterpretation: z.string().min(20).max(1_000),
  evidence: scenarioEvidenceSchema.optional(),
  cycles: z.object({ minor: cycleSchema, major: cycleSchema }).strict(),
  labels: parameterLabelsSchema,
  aixLabels: z.object({
    physical: z.string().min(3).max(160),
    biological: z.string().min(3).max(160),
    constructed: z.string().min(3).max(160),
    feedback: z.string().min(3).max(160),
  }).strict().default({ physical: "Physical and factual validity", biological: "Human and ecological viability", constructed: "Task and institutional coherence", feedback: "Feedback and audit integrity" }),
  ranges: parameterRangesSchema.default({
    pressure: { min: 0, max: 2, step: 0.01 }, error: { min: 0, max: 1, step: 0.01 }, feedback: { min: 0, max: 1, step: 0.01 }, correction: { min: 0, max: 2, step: 0.01 }, drift: { min: 0, max: 0.5, step: 0.01 }, irreversibleLoss: { min: 0, max: 0.5, step: 0.01 }, initialDebt: { min: 0, max: 2, step: 0.01 },
  }),
  thresholds: z.object({
    warningRho: z.number().finite().min(0).max(10),
    criticalRho: z.number().finite().min(0.1).max(10),
    irreversibleRho: z.number().finite().min(0.1).max(20),
    phaseConfidenceMinimum: z.number().finite().min(0).max(1),
  }).strict().superRefine((value, context) => {
    if (value.warningRho >= value.criticalRho) context.addIssue({ code: "custom", path: ["warningRho"], message: "warningRho must be below criticalRho." });
    if (value.criticalRho >= value.irreversibleRho) context.addIssue({ code: "custom", path: ["irreversibleRho"], message: "irreversibleRho must be above criticalRho." });
  }).default({ warningRho: 1.6, criticalRho: 2.5, irreversibleRho: 3.4, phaseConfidenceMinimum: 0.2 }),
  rupturePolicy: z.object({
    irreversibleRho: z.number().finite().min(0.1).max(20),
    cumulativeLossThreshold: z.number().finite().min(0).max(100),
    debtThreshold: z.number().finite().min(0).max(100),
    persistenceSteps: z.number().int().min(1).max(10_000),
    provenance: z.literal("illustrative-scenario-policy"),
    rationale: z.string().min(20).max(1_000),
  }).strict(),
  defaults: simulationParametersSchema,
  presets: z.array(z.object({
    name: z.string().min(2).max(80),
    description: z.string().min(10).max(300),
    values: parameterOverridesSchema.refine((value) => Object.keys(value).length > 0),
  }).strict()).min(1).max(20),
}).strict();

export const externalTelemetrySchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION).optional().default(CONTRACT_VERSION),
  source: z.object({
    name: z.string().min(1).max(160),
    units: z.string().min(1).max(120),
    provenance: z.string().min(5).max(1_000),
  }).strict(),
  samples: z.array(z.object({
    time: z.number().finite(),
    mismatch: z.number().finite(),
  }).strict()).min(8).max(5_000),
}).strict();

const empiricalRoleSchema = z.enum(["time", "thetaSignal", "phiSignal", "pressure", "error", "feedback", "correction", "drift", "irreversibleLoss", "debt", "rho", "outcome", "intervention"]);

export const empiricalStudyDefinitionSchema = z.object({
  name: z.string().min(3).max(200),
  objective: z.string().min(5).max(1_000),
  population: z.string().min(8).max(1_000),
  horizon: z.string().min(8).max(1_000),
  aggregation: z.string().min(8).max(1_000),
  viableRegion: z.string().min(8).max(1_000),
  internalCycle: z.string().min(3).max(500),
  externalCycle: z.string().min(3).max(500),
  falsification: z.string().min(8).max(2_000),
  provenance: z.string().min(8).max(2_000),
}).strict();

export const empiricalModelAssumptionsSchema = z.object({
  kappa: boundedNumber("kappa"),
  rho0: boundedNumber("rho0"),
  chi: boundedNumber("chi"),
  rhoCrit: boundedNumber("rhoCrit"),
}).strict().superRefine((value, context) => {
  if (value.rho0 >= value.rhoCrit) context.addIssue({ code: "custom", path: ["rho0"], message: "rho0 must remain below rhoCrit." });
});

const empiricalMappingEntrySchema = z.object({
  column: z.string().max(200),
  unit: z.string().min(1).max(160),
  evidence: z.enum(["uploaded-observation", "declared-proxy", "not-mapped"]),
}).strict();

export const empiricalColumnMappingSchema = z.object({
  time: empiricalMappingEntrySchema,
  thetaSignal: empiricalMappingEntrySchema,
  phiSignal: empiricalMappingEntrySchema,
  pressure: empiricalMappingEntrySchema,
  error: empiricalMappingEntrySchema,
  feedback: empiricalMappingEntrySchema,
  correction: empiricalMappingEntrySchema,
  drift: empiricalMappingEntrySchema,
  irreversibleLoss: empiricalMappingEntrySchema,
  debt: empiricalMappingEntrySchema,
  rho: empiricalMappingEntrySchema,
  outcome: empiricalMappingEntrySchema,
  intervention: empiricalMappingEntrySchema,
}).strict();

const empiricalScalarSchema = z.union([z.string().max(20_000), z.number().finite(), z.boolean(), z.null()]);
const empiricalRowsDataSchema = z.object({
  format: z.literal("rows"),
  columns: z.array(z.string().min(1).max(200)).min(2).max(EMPIRICAL_EXECUTION_LIMITS.maxColumns),
  rows: z.array(z.record(z.string().min(1).max(200), empiricalScalarSchema)).min(8).max(EMPIRICAL_EXECUTION_LIMITS.maxRows),
}).strict();
const empiricalCsvDataSchema = z.object({
  format: z.literal("csv"),
  csv: z.string().min(1).max(EMPIRICAL_EXECUTION_LIMITS.maxCsvBytes),
}).strict();

export const empiricalResearchRequestSchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION).optional().default(CONTRACT_VERSION),
  scenarioId: z.string().min(1).max(160),
  study: empiricalStudyDefinitionSchema,
  source: z.object({
    name: z.string().min(1).max(200),
    resourceUri: z.string().min(3).max(2_000).optional(),
    dataClassification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
    preprocessing: z.array(z.string().min(3).max(500)).max(100).optional().default([]),
  }).strict(),
  privacy: z.object({
    dataUseAuthorized: z.literal(true),
    remoteProcessingAuthorized: z.boolean().optional().default(false),
    containsSensitiveData: z.boolean().optional().default(false),
    deidentified: z.boolean().optional().default(false),
    retention: z.literal("request-only"),
  }).strict(),
  data: z.discriminatedUnion("format", [empiricalRowsDataSchema, empiricalCsvDataSchema]),
  mapping: empiricalColumnMappingSchema,
  assumptions: empiricalModelAssumptionsSchema,
  options: z.object({
    includeReplayPoints: z.boolean().optional().default(true),
    replayStride: z.number().int().min(1).max(1_000).optional().default(1),
  }).strict().optional().default({ includeReplayPoints: true, replayStride: 1 }),
}).strict();

export const empiricalResearchResourceRequestSchema = empiricalResearchRequestSchema.omit({ data: true }).extend({
  filePath: z.string().min(1).max(2_000),
}).strict();

export const empiricalResearchExplanationRequestSchema = empiricalResearchRequestSchema.extend({
  observationIndex: z.number().int().min(0).max(EMPIRICAL_EXECUTION_LIMITS.maxRows - 1),
}).strict();

const empiricalValidationReceiptSchema = z.object({
  evidenceLevel: z.literal("observed-descriptive"),
  modelSupport: z.enum(["insufficient-data", "not-supported", "provisional"]),
  torusReplayReady: z.boolean(),
  issues: z.array(z.string().min(1).max(1_000)).max(30),
  gates: z.array(z.object({
    id: z.enum(["data-quality", "internal-recurrence", "external-recurrence", "phase-independence", "holdout"]),
    label: z.string().min(3).max(100),
    passed: z.boolean(),
    state: z.enum(["pass", "fail", "ready", "blocked"]),
    detail: z.string().min(3).max(1_000),
  }).strict()).length(5),
  internalPhase: z.object({ identifiable: z.boolean(), reason: z.string(), spectralConcentration: z.number().finite(), estimatedCycles: z.number().finite() }).strict(),
  externalPhase: z.object({ identifiable: z.boolean(), reason: z.string(), spectralConcentration: z.number().finite(), estimatedCycles: z.number().finite() }).strict(),
  phaseRelationship: z.object({ lockingValue: z.number().finite().min(0).max(1), lockingRatio: z.string().max(20).optional(), jointCoverage: z.number().finite().min(0).max(1), interpretation: z.string().min(3).max(1_000) }).strict(),
}).strict();

const empiricalReplayReceiptSchema = z.object({
  method: z.literal("one-step-observed-driver-replay"),
  uncertaintyMethod: z.literal("calibration-residual-90-percent"),
  calibrationRows: z.number().int().min(2).max(4_999),
  holdoutRows: z.number().int().min(1).max(1_500),
  holdoutRmse: z.number().finite().min(0),
  holdoutMae: z.number().finite().min(0),
  holdoutIntervalCoverage: z.number().finite().min(0).max(1),
  finalStatus: z.string().min(2).max(100),
}).strict();

export const empiricalResearchReceiptSchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION),
  kind: z.literal("empirical-research-receipt"),
  modelVersion: z.string().min(3).max(80),
  scenarioId: z.string().min(1).max(160),
  scenarioVersion: z.string().min(1).max(40),
  analyzedAt: z.string().datetime(),
  processing: z.object({
    mode: z.enum(["local-mcp", "remote-mcp", "http-api"]),
    retention: z.literal("request-only"),
    remoteProcessingAuthorized: z.boolean(),
    sensitiveDataDeclared: z.boolean(),
    deidentified: z.boolean(),
    tokenAuthenticated: z.boolean(),
    rawInputLogged: z.literal(false),
  }).strict(),
  source: z.object({
    name: z.string().min(1).max(200),
    resourceUri: z.string().min(3).max(2_000).optional(),
    dataClassification: z.enum(["public", "internal", "confidential", "restricted"]),
    preprocessing: z.array(z.string().min(3).max(500)).max(100),
    rows: z.number().int().min(8).max(EMPIRICAL_EXECUTION_LIMITS.maxRows),
    columns: z.number().int().min(2).max(EMPIRICAL_EXECUTION_LIMITS.maxColumns),
    canonicalTableSha256: z.string().regex(/^[a-f0-9]{64}$/),
    rawDataIncluded: z.literal(false),
  }).strict(),
  study: empiricalStudyDefinitionSchema,
  mapping: z.array(z.object({
    role: empiricalRoleSchema,
    symbol: z.string().min(1).max(20),
    column: z.string().max(200),
    unit: z.string().min(1).max(160),
    evidence: z.enum(["uploaded-observation", "declared-proxy", "not-mapped"]),
  }).strict()).length(13),
  assumptions: empiricalModelAssumptionsSchema.extend({ provenance: z.literal("declared-not-fitted") }).strict(),
  evidence: z.object({
    level: z.literal("observed-descriptive"),
    empiricalValidation: z.literal(false),
    modelSupport: z.enum(["insufficient-data", "not-supported", "provisional"]),
    interpretationBoundary: z.string().min(20).max(1_000),
  }).strict(),
  validation: empiricalValidationReceiptSchema,
  replay: empiricalReplayReceiptSchema.nullable(),
  limitations: z.array(z.string().min(10).max(1_000)).min(4).max(20),
}).strict();

export const empiricalEvidenceBundleSchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION).optional().default(CONTRACT_VERSION),
  kind: z.literal("browser-local-empirical-study"),
  modelVersion: z.string().min(3).max(80),
  scenarioId: z.string().min(1).max(160),
  scenarioVersion: z.string().min(1).max(40),
  exportedAt: z.string().datetime(),
  study: z.object({
    name: z.string().min(3).max(200),
    objective: z.string().min(5).max(1_000),
    population: z.string().min(8).max(1_000),
    horizon: z.string().min(8).max(1_000),
    aggregation: z.string().min(8).max(1_000),
    viableRegion: z.string().min(8).max(1_000),
    internalCycle: z.string().min(3).max(500),
    externalCycle: z.string().min(3).max(500),
    falsification: z.string().min(8).max(2_000),
    provenance: z.string().min(8).max(2_000),
  }).strict(),
  source: z.object({
    name: z.string().min(1).max(200),
    kind: z.enum(["imported-observation", "bundled-observed-form-demo"]),
    preprocessing: z.array(z.string().min(3).max(500)).max(100).optional(),
    rows: z.number().int().min(8).max(5_000),
    columns: z.number().int().min(2).max(64),
    datasetSha256: z.string().regex(/^[a-f0-9]{64}$/),
    localOnly: z.literal(true),
    rawDataIncluded: z.literal(false),
  }).strict(),
  mapping: z.array(z.object({
    role: z.enum(["time", "thetaSignal", "phiSignal", "pressure", "error", "feedback", "correction", "drift", "irreversibleLoss", "debt", "rho", "outcome", "intervention"]),
    symbol: z.string().min(1).max(20),
    column: z.string().max(200),
    unit: z.string().min(1).max(160),
    evidence: z.enum(["uploaded-observation", "declared-proxy", "not-mapped"]),
  }).strict()).min(11).max(13),
  assumptions: z.object({
    kappa: boundedNumber("kappa"),
    rho0: boundedNumber("rho0"),
    chi: boundedNumber("chi"),
    rhoCrit: boundedNumber("rhoCrit"),
    provenance: z.literal("declared-not-fitted"),
  }).strict().superRefine((value, context) => {
    if (value.rho0 >= value.rhoCrit) context.addIssue({ code: "custom", path: ["rho0"], message: "rho0 must remain below rhoCrit." });
  }),
  validation: z.object({
    evidenceLevel: z.literal("observed-descriptive"),
    modelSupport: z.enum(["insufficient-data", "not-supported", "provisional"]),
    torusReplayReady: z.boolean(),
    gates: z.array(z.object({
      id: z.enum(["data-quality", "internal-recurrence", "external-recurrence", "phase-independence", "holdout"]),
      label: z.string().min(3).max(100),
      passed: z.boolean(),
      state: z.enum(["pass", "fail", "ready", "blocked"]),
      detail: z.string().min(3).max(1_000),
    }).strict()).length(5),
    internalPhase: z.object({ identifiable: z.boolean(), reason: z.string(), spectralConcentration: z.number().finite(), estimatedCycles: z.number().finite() }).strict(),
    externalPhase: z.object({ identifiable: z.boolean(), reason: z.string(), spectralConcentration: z.number().finite(), estimatedCycles: z.number().finite() }).strict(),
    phaseRelationship: z.object({ lockingValue: z.number().finite().min(0).max(1), lockingRatio: z.string().max(20).optional(), jointCoverage: z.number().finite().min(0).max(1), interpretation: z.string().min(3).max(1_000) }).strict(),
  }).strict(),
  replay: z.object({
    method: z.literal("one-step-observed-driver-replay"),
    uncertaintyMethod: z.literal("calibration-residual-90-percent"),
    calibrationRows: z.number().int().min(2).max(4_999),
    holdoutRows: z.number().int().min(1).max(1_500),
    holdoutRmse: z.number().finite().min(0),
    holdoutMae: z.number().finite().min(0),
    holdoutIntervalCoverage: z.number().finite().min(0).max(1),
    finalStatus: z.string().min(2).max(100),
  }).strict().nullable(),
  limitations: z.array(z.string().min(10).max(1_000)).min(3).max(20),
}).strict();

export const empiricalReceiptSchema = z.union([
  empiricalEvidenceBundleSchema,
  empiricalResearchReceiptSchema,
]);

export const empiricalEvidenceRegistryRequestSchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION).optional().default(CONTRACT_VERSION),
  receipts: z.array(empiricalReceiptSchema).min(1).max(EMPIRICAL_EXECUTION_LIMITS.maxRegistryReceipts),
  anchorReceiptId: z.string().min(3).max(160).optional(),
}).strict();

const empiricalCompatibilityDimensionSchema = z.object({
  id: z.enum(["evidence-kind", "model-version", "scenario-version", "population", "horizon", "aggregation", "viable-region", "phase-definition", "units", "preprocessing", "assumptions"]),
  label: z.string().min(3).max(120),
  status: z.enum(["match", "differs", "unknown", "excluded"]),
  severity: z.enum(["none", "partial", "critical"]),
  explanation: z.string().min(3).max(1_000),
}).strict();

export const empiricalRegistrySummarySchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION),
  kind: z.literal("empirical-evidence-registry-summary"),
  anchorReceiptId: z.string().min(3).max(160),
  receipts: z.array(z.object({
    id: z.string().min(3).max(160),
    receiptKind: z.enum(["browser-local-empirical-study", "empirical-research-receipt"]),
    studyName: z.string().min(3).max(200),
    sourceName: z.string().min(1).max(200),
    scenarioId: z.string().min(1).max(160),
    scenarioVersion: z.string().min(1).max(40),
    modelVersion: z.string().min(3).max(80),
    evidenceKind: z.enum(["observed", "synthetic"]),
    modelSupport: z.enum(["insufficient-data", "not-supported", "provisional"]),
    phaseResult: z.enum(["pass", "fail", "blocked"]),
    negative: z.boolean(),
    compatibility: z.enum(["anchor", "compatible", "partially-comparable", "non-comparable", "excluded"]),
    rows: z.number().int().min(8).max(EMPIRICAL_EXECUTION_LIMITS.maxRows),
    replay: empiricalReplayReceiptSchema.nullable(),
    dimensions: z.array(empiricalCompatibilityDimensionSchema).length(11),
  }).strict()).min(1).max(500),
  counts: z.object({
    totalReceipts: z.number().int().min(1).max(500),
    observedStudies: z.number().int().min(0).max(500),
    syntheticStudies: z.number().int().min(0).max(500),
    negativeStudies: z.number().int().min(0).max(500),
    compatibleWithAnchor: z.number().int().min(0).max(500),
    partiallyComparable: z.number().int().min(0).max(500),
    nonComparable: z.number().int().min(0).max(500),
    deduplicatedReceipts: z.number().int().min(0).max(500),
  }).strict(),
  cohort: z.object({
    receiptIds: z.array(z.string().min(3).max(160)).max(500),
    compatibleObservedStudies: z.number().int().min(0).max(500),
    phaseGatePassRate: z.number().finite().min(0).max(1).nullable(),
    negativeStudiesPreserved: z.number().int().min(0).max(500),
    replayStudies: z.number().int().min(0).max(500),
    meanHoldoutRmse: z.number().finite().min(0).nullable(),
    minHoldoutRmse: z.number().finite().min(0).nullable(),
    maxHoldoutRmse: z.number().finite().min(0).nullable(),
    meanIntervalCoverage: z.number().finite().min(0).max(1).nullable(),
    assumptionRanges: z.object({
      kappa: z.object({ min: z.number().finite(), max: z.number().finite() }).strict().nullable(),
      chi: z.object({ min: z.number().finite(), max: z.number().finite() }).strict().nullable(),
      rho0: z.object({ min: z.number().finite(), max: z.number().finite() }).strict().nullable(),
      rhoCrit: z.object({ min: z.number().finite(), max: z.number().finite() }).strict().nullable(),
    }).strict(),
  }).strict(),
  interpretationBoundary: z.string().min(20).max(2_000),
}).strict();

export const empiricalEvidenceRegistryBundleSchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION),
  kind: z.literal("empirical-evidence-registry"),
  exportedAt: z.string().datetime(),
  privacy: z.object({
    browserLocal: z.literal(true),
    rawObservationsIncluded: z.literal(false),
    aggregation: z.literal("descriptive-compatible-receipts-only"),
  }).strict(),
  receipts: z.array(empiricalReceiptSchema).min(1).max(EMPIRICAL_EXECUTION_LIMITS.maxRegistryReceipts),
  anchorReceiptId: z.string().min(3).max(160),
  summary: empiricalRegistrySummarySchema,
}).strict();

export const proposalAssertionsSchema = z.object({
  maxRuptureRate: z.number().min(0).max(1).optional(),
  minRuptureRate: z.number().min(0).max(1).optional(),
  minFinalAlignment: z.number().min(0).max(1).optional(),
  maxFinalAlignment: z.number().min(0).max(1).optional(),
  maxFinalDebt: z.number().min(0).max(1_000).optional(),
  maxMaxRho: z.number().min(0).max(1_000).optional(),
  minStableFraction: z.number().min(0).max(1).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "Each evaluation needs at least one assertion.",
});

export const scenarioProposalSchema = z.object({
  schemaVersion: z.literal(CONTRACT_VERSION).optional().default(CONTRACT_VERSION),
  status: z.literal("draft"),
  action: z.enum(["create", "revise"]),
  proposedBy: z.object({
    kind: z.enum(["agent", "human"]),
    name: z.string().min(2).max(120),
  }).strict(),
  rationale: z.string().min(30).max(5_000),
  scenario: scenarioDefinitionSchema,
  evidence: z.object({
    hypothesis: z.string().min(20).max(2_000),
    assumptions: z.array(z.string().min(5).max(500)).min(1).max(50),
    references: z.array(z.string().min(3).max(1_000)).max(50),
    evaluations: z.array(z.object({
      name: z.string().min(3).max(160),
      parameters: parameterOverridesSchema.optional().default({}),
      interventions: z.array(scheduledInterventionSchema).max(PUBLIC_EXECUTION_LIMITS.maxInterventions).optional().default([]),
      seeds: z.array(boundedNumber("seed")).min(1).max(100).optional().default([101, 211, 307, 401, 503]),
      assertions: proposalAssertionsSchema,
    }).strict()).min(1).max(20),
  }).strict(),
}).strict();

export type ParsedExperimentSpec = z.infer<typeof experimentSpecSchema>;
export type ParsedSweepSpec = z.infer<typeof sweepSpecSchema>;
export type ParsedScenarioProposal = z.infer<typeof scenarioProposalSchema>;
export type ParsedEmpiricalEvidenceBundle = z.infer<typeof empiricalEvidenceBundleSchema>;
export type ParsedEmpiricalResearchRequest = z.infer<typeof empiricalResearchRequestSchema>;
export type ParsedEmpiricalResearchResourceRequest = z.infer<typeof empiricalResearchResourceRequestSchema>;
export type ParsedEmpiricalResearchReceipt = z.infer<typeof empiricalResearchReceiptSchema>;
export type ParsedEmpiricalReceipt = z.infer<typeof empiricalReceiptSchema>;
export type ParsedEmpiricalEvidenceRegistryRequest = z.infer<typeof empiricalEvidenceRegistryRequestSchema>;
export type ParsedEmpiricalEvidenceRegistryBundle = z.infer<typeof empiricalEvidenceRegistryBundleSchema>;
