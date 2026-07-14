import * as z from "zod/v4";
import {
  CONTRACT_VERSION,
  PARAMETER_LIMITS,
  PUBLIC_EXECUTION_LIMITS,
} from "./constants.ts";

const boundedNumber = (key: keyof typeof PARAMETER_LIMITS) => {
  const limit = PARAMETER_LIMITS[key];
  let schema = z.number().finite().min(limit.min).max(limit.max).describe(limit.description);
  if (limit.integer) schema = schema.int();
  return schema;
};

export const simulationParametersSchema = z.object({
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

export const parameterOverridesSchema = simulationParametersSchema.partial().strict();
export const interventionEffectsSchema = simulationParametersSchema
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
}).strict();

const parameterLabelsSchema = z.object({
  pressure: z.string().min(2).max(80),
  error: z.string().min(2).max(80),
  feedback: z.string().min(2).max(80),
  correction: z.string().min(2).max(80),
  drift: z.string().min(2).max(80),
  irreversibleLoss: z.string().min(2).max(80),
  initialDebt: z.string().min(2).max(80),
}).strict();

export const scenarioDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string().min(4).max(160),
  shortTitle: z.string().min(2).max(80),
  summary: z.string().min(20).max(500),
  category: z.enum(["AI", "Organizations", "Healthcare", "Ecology"]),
  difficulty: z.enum(["Introductory", "Intermediate", "Advanced"]),
  icon: z.string().min(1).max(12),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  optimizedOutcome: z.string().min(5).max(300),
  viableRegion: z.string().min(10).max(500),
  hiddenConstraint: z.string().min(10).max(500),
  debtMechanism: z.string().min(10).max(500),
  irreversibleMechanism: z.string().min(10).max(500),
  interventionIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1).max(30),
  warningConditions: z.array(z.string().min(5).max(300)).min(1).max(20),
  ruptureCondition: z.string().min(10).max(500),
  recoveryCondition: z.string().min(10).max(500),
  plainLanguageInterpretation: z.string().min(20).max(1_000),
  cycles: z.object({ minor: cycleSchema, major: cycleSchema }).strict(),
  labels: parameterLabelsSchema,
  defaults: simulationParametersSchema,
  presets: z.array(z.object({
    name: z.string().min(2).max(80),
    description: z.string().min(10).max(300),
    values: parameterOverridesSchema.refine((value) => Object.keys(value).length > 0),
  }).strict()).min(1).max(20),
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
