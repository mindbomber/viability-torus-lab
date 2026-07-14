import {
  MODEL_VERSION,
  MAX_INTERNAL_DT,
  integrationSubstepsPerStep,
  simulate,
  type ScheduledIntervention,
  type SimulationFrame,
  type SimulationParameters,
  type SimulationSummary,
} from "../engine/simulator.ts";
import { scenarioById } from "../scenarios/catalog.ts";
import {
  CONTRACT_VERSION,
  LOCAL_EXECUTION_LIMITS,
  type ExecutionLimits,
} from "./constants.ts";
import {
  comparisonSpecSchema,
  experimentSpecSchema,
  simulationParametersSchema,
  sweepSpecSchema,
  type ParsedExperimentSpec,
} from "./schemas.ts";
import type { EnsembleSummary, ExperimentResult } from "./types.ts";

export class ContractError extends Error {
  readonly issues: { path: string; message: string }[];

  constructor(message: string, issues: { path: string; message: string }[] = []) {
    super(message);
    this.name = "ContractError";
    this.issues = issues;
  }
}

function parseWith<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new ContractError(`${label} failed contract validation.`, parsed.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  })));
}

function enforceExecutionLimits(
  parameters: SimulationParameters,
  seeds: number[],
  interventions: ScheduledIntervention[],
  limits: ExecutionLimits,
) {
  const issues: { path: string; message: string }[] = [];
  if (seeds.length > limits.maxRuns) issues.push({ path: "seeds", message: `At most ${limits.maxRuns} runs are allowed.` });
  if (parameters.steps > limits.maxStepsPerRun) issues.push({ path: "parameters.steps", message: `At most ${limits.maxStepsPerRun} steps per run are allowed.` });
  const integrationWork =
    seeds.length *
    parameters.steps *
    integrationSubstepsPerStep(parameters.dt);
  if (integrationWork > limits.maxTotalIntegrationSteps) issues.push({ path: "seeds", message: `This ensemble exceeds the ${limits.maxTotalIntegrationSteps} internal integration-step work budget.` });
  if (interventions.length > limits.maxInterventions) issues.push({ path: "interventions", message: `At most ${limits.maxInterventions} interventions are allowed.` });
  interventions.forEach((event, index) => {
    if (event.step >= parameters.steps) issues.push({ path: `interventions.${index}.step`, message: "Intervention step must occur before the final simulation step." });
  });
  const activeParameters = { ...parameters };
  [...interventions]
    .sort((left, right) => left.step - right.step)
    .forEach((event, index) => {
      Object.assign(activeParameters, event.effects);
      const parsed = simulationParametersSchema.safeParse(activeParameters);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => issues.push({
          path: `interventions.${index}.effects.${issue.path.map(String).join(".")}`,
          message: issue.message,
        }));
      }
    });
  if (issues.length) throw new ContractError("Experiment exceeds execution limits.", issues);
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deterministicFingerprint(value: unknown) {
  const input = canonicalJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `vtl-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function sampleFrames(frames: SimulationFrame[], requestedStride: number, maxFrames: number) {
  const strideForLimit = maxFrames <= 1
    ? frames.length
    : Math.ceil((frames.length - 1) / (maxFrames - 1));
  const stride = Math.max(requestedStride, strideForLimit);
  const sampled = frames.filter((_, index) => index % stride === 0 || index === frames.length - 1);
  return { frames: sampled, stride };
}

export function summarizeRuns(summaries: SimulationSummary[]): EnsembleSummary {
  const mean = (pick: (summary: SimulationSummary) => number) => summaries.reduce((sum, item) => sum + pick(item), 0) / summaries.length;
  const boundaryCrossingRate = summaries.filter((item) => item.boundaryCrossingStep !== undefined).length / summaries.length;
  return {
    runCount: summaries.length,
    boundaryCrossingRate,
    irreversibleRuptureRate: summaries.filter((item) => item.irreversibleRuptureStep !== undefined).length / summaries.length,
    ruptureRate: boundaryCrossingRate,
    recoveryRate: summaries.filter((item) => item.recovered).length / summaries.length,
    meanStableFraction: mean((item) => item.stableFraction),
    meanFinalAlignment: mean((item) => item.finalAlignment),
    meanFinalDebt: mean((item) => item.finalDebt),
    meanMaxRho: mean((item) => item.maxRho),
  };
}

export function runExperiment(input: unknown, limits: ExecutionLimits = LOCAL_EXECUTION_LIMITS): ExperimentResult {
  const spec = parseWith<ParsedExperimentSpec>(experimentSpecSchema, input, "Experiment");
  const scenario = scenarioById[spec.scenarioId];
  if (!scenario) throw new ContractError("Experiment references an unknown scenario.", [{ path: "scenarioId", message: `Unknown scenario '${spec.scenarioId}'.` }]);
  const parameters = parseWith<SimulationParameters>(simulationParametersSchema, { ...scenario.defaults, ...spec.parameters }, "Simulation parameters");
  const seeds = spec.seeds ?? [parameters.seed];
  enforceExecutionLimits(parameters, seeds, spec.interventions, limits);

  const runs = seeds.map((seed) => {
    const result = simulate(
      { ...parameters, seed },
      spec.interventions,
      { rupturePolicy: scenario.rupturePolicy },
    );
    if (!spec.includeFrames) return { seed, summary: result.summary };
    const perRunFrameLimit = Math.max(1, Math.min(limits.maxReturnedFramesPerRun, Math.floor(limits.maxTotalReturnedFrames / seeds.length)));
    const sampled = sampleFrames(result.frames, spec.frameStride, perRunFrameLimit);
    return { seed, summary: result.summary, frames: sampled.frames, returnedFrameStride: sampled.stride };
  });

  const experimentId = deterministicFingerprint({
    modelVersion: MODEL_VERSION,
    scenario: { id: scenario.id, version: scenario.version },
    parameters,
    interventions: spec.interventions,
    seeds,
  });

  return {
    schemaVersion: CONTRACT_VERSION,
    modelVersion: MODEL_VERSION,
    experimentId,
    scenario: { id: scenario.id, version: scenario.version, title: scenario.title },
    configuration: { parameters, interventions: spec.interventions, seeds },
    runs,
    ensemble: summarizeRuns(runs.map((run) => run.summary)),
    evidence: {
      kind: "synthetic-model",
      empiricalValidation: false,
      calibrationStatus: scenario.evidence.calibrationStatus,
      warnings: [
        "Results demonstrate behavior of the declared synthetic model only.",
        "Parameter rankings are conditional on the selected scenario mapping, horizon, seeds, and objective.",
        "Do not use this result as an operational recommendation without external calibration and domain review.",
      ],
    },
  };
}

export function compareExperiments(input: unknown, limits: ExecutionLimits = LOCAL_EXECUTION_LIMITS) {
  const spec = parseWith(comparisonSpecSchema, input, "Comparison");
  const left = runExperiment(spec.left, limits);
  const right = runExperiment(spec.right, limits);
  return {
    schemaVersion: CONTRACT_VERSION,
    modelVersion: MODEL_VERSION,
    left,
    right,
    difference: {
      boundaryCrossingRate: left.ensemble.boundaryCrossingRate - right.ensemble.boundaryCrossingRate,
      irreversibleRuptureRate: left.ensemble.irreversibleRuptureRate - right.ensemble.irreversibleRuptureRate,
      ruptureRate: left.ensemble.ruptureRate - right.ensemble.ruptureRate,
      meanStableFraction: left.ensemble.meanStableFraction - right.ensemble.meanStableFraction,
      meanFinalAlignment: left.ensemble.meanFinalAlignment - right.ensemble.meanFinalAlignment,
      meanFinalDebt: left.ensemble.meanFinalDebt - right.ensemble.meanFinalDebt,
      meanMaxRho: left.ensemble.meanMaxRho - right.ensemble.meanMaxRho,
    },
  };
}

function cartesianGrid(grid: Record<string, number[]>, limit: number) {
  const entries = Object.entries(grid);
  let combinations: Record<string, number>[] = [{}];
  for (const [key, values] of entries) {
    combinations = combinations.flatMap((combination) => values.map((value) => ({ ...combination, [key]: value })));
    if (combinations.length > limit) throw new ContractError("Sweep exceeds the candidate limit.", [{ path: "grid", message: `The grid expands to more than ${limit} candidates.` }]);
  }
  return combinations;
}

export function sweepParameters(input: unknown, limits: ExecutionLimits = LOCAL_EXECUTION_LIMITS) {
  const spec = parseWith(sweepSpecSchema, input, "Parameter sweep");
  const parameterNames = Object.keys(spec.grid);
  if (parameterNames.length > limits.maxSweepParameters) {
    throw new ContractError("Sweep exceeds the parameter limit.", [{ path: "grid", message: `At most ${limits.maxSweepParameters} parameters may vary in one sweep.` }]);
  }
  const combinations = cartesianGrid(spec.grid as Record<string, number[]>, limits.maxSweepCandidates);
  const scenario = scenarioById[spec.base.scenarioId];
  const steps = spec.base.parameters.steps ?? scenario?.defaults.steps ?? 0;
  const runCount = spec.base.seeds?.length ?? 1;
  const dt = spec.base.parameters.dt ?? scenario?.defaults.dt ?? MAX_INTERNAL_DT;
  const totalIntegrationWork =
    combinations.length *
    runCount *
    steps *
    integrationSubstepsPerStep(dt);
  if (totalIntegrationWork > limits.maxTotalIntegrationSteps) {
    throw new ContractError("Sweep exceeds the integration-step work budget.", [{ path: "grid", message: `Candidate count × seeds × steps × internal substeps must not exceed ${limits.maxTotalIntegrationSteps}.` }]);
  }
  const ranked = combinations.map((parameterOverrides) => {
    const experiment = runExperiment({
      ...spec.base,
      includeFrames: false,
      parameters: { ...spec.base.parameters, ...parameterOverrides },
    }, limits);
    return { parameterOverrides, ensemble: experiment.ensemble };
  }).sort((a, b) =>
    a.ensemble.irreversibleRuptureRate - b.ensemble.irreversibleRuptureRate ||
    a.ensemble.boundaryCrossingRate - b.ensemble.boundaryCrossingRate ||
    b.ensemble.meanFinalAlignment - a.ensemble.meanFinalAlignment ||
    a.ensemble.meanFinalDebt - b.ensemble.meanFinalDebt ||
    b.ensemble.meanStableFraction - a.ensemble.meanStableFraction ||
    JSON.stringify(a.parameterOverrides).localeCompare(JSON.stringify(b.parameterOverrides))
  );

  return {
    schemaVersion: CONTRACT_VERSION,
    modelVersion: MODEL_VERSION,
    objective: spec.objective,
    candidatesTested: ranked.length,
    results: ranked.slice(0, spec.topK).map((result, index) => ({ rank: index + 1, ...result })),
  };
}

export function formatContractError(error: unknown) {
  if (error instanceof ContractError) return { error: error.message, issues: error.issues };
  return { error: error instanceof Error ? error.message : "Unexpected error", issues: [] };
}
