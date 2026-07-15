import { PARAMETER_LIMITS } from "../contracts/constants.ts";
import type {
  ParameterTransform,
  ModelFamily,
  ScenarioModuleDefinition,
  ScenarioProtocolDefinition,
  SystemTemplateDefinition,
} from "../contracts/types.ts";
import type { SimulationParameters } from "../engine/simulator.ts";

export const scenarioModules: ScenarioModuleDefinition[] = [
  {
    id: "system-default",
    version: "1.0.0",
    title: "Default operating conditions",
    kind: "baseline",
    summary: "Uses the bounded system's independently declared illustrative starting conditions without adding a common stress transform.",
    conditions: ["The bounded system starts from its declared default state."],
    stressors: ["Only the system-specific pressures already represented by the default mapping are active."],
    learningObjective: "Establish the reference trajectory and explain why its default educational watchlist is derived.",
    transforms: [],
    compatibleTemplateIds: "all",
    provenance: "illustrative-scenario-module",
  },
  {
    id: "pressure-surge",
    version: "1.0.0",
    title: "Pressure surge",
    kind: "stress",
    summary: "Raises optimization or demand pressure and viable-region drift while carrying a modest amount of new debt.",
    conditions: ["Demand or optimization intensity rises before the system can redesign its operating capacity."],
    stressors: ["Higher pressure", "Faster environmental or requirement drift", "Additional initial debt"],
    learningObjective: "Isolate the scaling-law question: what changes when pressure grows faster than correction?",
    transforms: [
      { parameter: "pressure", operation: "add", value: 0.28 },
      { parameter: "drift", operation: "add", value: 0.02 },
      { parameter: "initialDebt", operation: "add", value: 0.12 },
    ],
    compatibleTemplateIds: "all",
    provenance: "illustrative-scenario-module",
  },
  {
    id: "feedback-blind-spot",
    version: "1.0.0",
    title: "Feedback blind spot",
    kind: "stress",
    summary: "Weakens constraint visibility while increasing the chance that the system optimizes against a mistaken representation.",
    conditions: ["Relevant consequences are delayed, filtered, or excluded from the operating feedback loop."],
    stressors: ["Lower feedback fidelity", "Higher misclassification error"],
    learningObjective: "Show why the same operating pressure can produce different outcomes when lower-layer constraints become less visible.",
    transforms: [
      { parameter: "error", operation: "add", value: 0.12 },
      { parameter: "feedback", operation: "add", value: -0.15 },
    ],
    compatibleTemplateIds: "all",
    provenance: "illustrative-scenario-module",
  },
  {
    id: "compound-stress",
    version: "1.0.0",
    title: "Compound stress",
    kind: "stress",
    summary: "Applies a common adverse transform: pressure, error, drift, debt, and irreversible loss rise while feedback and correction weaken.",
    conditions: ["Several adverse changes arrive within one response horizon."],
    stressors: ["Pressure and error increase", "Feedback and correction weaken", "Debt, drift, and irreversible loss increase"],
    learningObjective: "Compare stress sensitivity across system classes under a shared synthetic perturbation.",
    transforms: [
      { parameter: "pressure", operation: "add", value: 0.28 },
      { parameter: "error", operation: "add", value: 0.12 },
      { parameter: "feedback", operation: "add", value: -0.15 },
      { parameter: "correction", operation: "add", value: -0.16 },
      { parameter: "drift", operation: "add", value: 0.05 },
      { parameter: "initialDebt", operation: "add", value: 0.25 },
      { parameter: "irreversibleLoss", operation: "add", value: 0.03 },
    ],
    compatibleTemplateIds: "all",
    provenance: "illustrative-scenario-module",
  },
  {
    id: "reduced-stress-context",
    version: "1.0.0",
    title: "Reduced-stress context",
    kind: "recovery-context",
    summary: "Creates more favorable external conditions without scheduling a corrective intervention, keeping context and action conceptually separate.",
    conditions: ["External pressure and drift are lower before the run begins."],
    stressors: ["Residual pressure", "Existing system-specific debt"],
    learningObjective: "Distinguish a favorable environment from an operator intervention and test whether lower stress alone repays accumulated debt.",
    transforms: [
      { parameter: "pressure", operation: "add", value: -0.28 },
      { parameter: "error", operation: "add", value: -0.12 },
      { parameter: "feedback", operation: "add", value: 0.15 },
      { parameter: "correction", operation: "add", value: 0.16 },
      { parameter: "drift", operation: "add", value: -0.05 },
      { parameter: "initialDebt", operation: "add", value: -0.25 },
      { parameter: "irreversibleLoss", operation: "add", value: -0.03 },
    ],
    compatibleTemplateIds: "all",
    provenance: "illustrative-scenario-module",
  },
];

export const scenarioModuleById = Object.fromEntries(
  scenarioModules.map((item) => [item.id, item]),
) as Record<string, ScenarioModuleDefinition>;

export function scenarioModuleAppliesTo(
  compatibleTemplateIds: ModelFamily[] | "all",
  templateId: ModelFamily,
) {
  return compatibleTemplateIds === "all" || compatibleTemplateIds.includes(templateId);
}

export function applyParameterTransforms(
  parameters: SimulationParameters,
  transforms: ParameterTransform[],
  intensity = 1,
): SimulationParameters {
  const result = { ...parameters };
  for (const transform of transforms) {
    const current = result[transform.parameter];
    const candidate = transform.operation === "set"
      ? transform.value
      : transform.operation === "multiply"
        ? current * (1 + (transform.value - 1) * intensity)
        : current + transform.value * intensity;
    const limit = PARAMETER_LIMITS[transform.parameter];
    result[transform.parameter] = Math.max(limit.min, Math.min(limit.max, candidate));
  }
  if (result.rho0 >= result.rhoCrit) result.rho0 = Math.max(PARAMETER_LIMITS.rho0.min, result.rhoCrit - 0.001);
  return result;
}

export function resolveScenarioProtocol(input: {
  systemId: string;
  template: SystemTemplateDefinition;
  baseParameters: SimulationParameters;
  module: ScenarioModuleDefinition;
  domainDefaultTitle: string;
  domainDefaultSummary: string;
  domainConditions: string[];
  domainStressors: string[];
  interventionMeanings: string[];
  version: string;
}): ScenarioProtocolDefinition {
  const { module } = input;
  if (!scenarioModuleAppliesTo(module.compatibleTemplateIds, input.template.id)) {
    throw new Error(`Scenario module '${module.id}' is not compatible with template '${input.template.id}'.`);
  }
  const isDefault = module.id === "system-default";
  const title = isDefault ? input.domainDefaultTitle : module.title;
  const summary = isDefault
    ? input.domainDefaultSummary
    : `${module.summary} Applied to this bounded system without changing its boundary, population, horizon, or aggregation rule.`;
  return {
    id: isDefault ? `${input.systemId}-default` : module.id === "reduced-stress-context" ? `${input.systemId}-early-correction` : `${input.systemId}-${module.id}`,
    systemId: input.systemId,
    templateId: input.template.id,
    moduleId: module.id,
    version: input.version,
    title,
    kind: module.kind,
    summary,
    conditions: [...input.domainConditions, ...module.conditions],
    stressors: isDefault ? input.domainStressors : module.stressors,
    interventions: input.interventionMeanings,
    parameterRationale: `The ${module.title.toLowerCase()} module applies a documented transform to the independently declared ${input.template.title.toLowerCase()} instance parameters. The watchlist classifier is run only after composition; it does not choose these values.`,
    learningObjective: module.learningObjective,
    parameters: module.transforms.length ? applyParameterTransforms(input.baseParameters, module.transforms) : input.baseParameters,
    provenance: "illustrative-system-protocol",
  };
}
