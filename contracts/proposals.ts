import { integrationSubstepsPerStep, simulate, type SimulationParameters, type SimulationSummary } from "../engine/simulator.ts";
import { scenarioById } from "../scenarios/catalog.ts";
import { interventionAppliesTo, interventionDefinitionById } from "../scenarios/interventions.ts";
import { scenarioModuleAppliesTo, scenarioModuleById } from "../scenarios/protocols.ts";
import { systemTemplateById } from "../scenarios/templates.ts";
import { CONTRACT_VERSION, LOCAL_EXECUTION_LIMITS, type ExecutionLimits } from "./constants.ts";
import { ContractError, summarizeRuns } from "./experiments.ts";
import { scenarioProposalSchema, simulationParametersSchema, type ParsedScenarioProposal } from "./schemas.ts";

type ProposalIssue = { severity: "error" | "warning"; path: string; message: string };

function parseProposal(value: unknown): ParsedScenarioProposal {
  const parsed = scenarioProposalSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new ContractError("Scenario proposal failed contract validation.", parsed.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  })));
}

function checkAssertion(summary: ReturnType<typeof summarizeRuns>, assertions: ParsedScenarioProposal["evidence"]["evaluations"][number]["assertions"]) {
  const failures: string[] = [];
  if (assertions.maxRuptureRate !== undefined && summary.ruptureRate > assertions.maxRuptureRate) failures.push(`ruptureRate ${summary.ruptureRate.toFixed(4)} exceeds ${assertions.maxRuptureRate}`);
  if (assertions.minRuptureRate !== undefined && summary.ruptureRate < assertions.minRuptureRate) failures.push(`ruptureRate ${summary.ruptureRate.toFixed(4)} is below ${assertions.minRuptureRate}`);
  if (assertions.minFinalAlignment !== undefined && summary.meanFinalAlignment < assertions.minFinalAlignment) failures.push(`meanFinalAlignment ${summary.meanFinalAlignment.toFixed(4)} is below ${assertions.minFinalAlignment}`);
  if (assertions.maxFinalAlignment !== undefined && summary.meanFinalAlignment > assertions.maxFinalAlignment) failures.push(`meanFinalAlignment ${summary.meanFinalAlignment.toFixed(4)} exceeds ${assertions.maxFinalAlignment}`);
  if (assertions.maxFinalDebt !== undefined && summary.meanFinalDebt > assertions.maxFinalDebt) failures.push(`meanFinalDebt ${summary.meanFinalDebt.toFixed(4)} exceeds ${assertions.maxFinalDebt}`);
  if (assertions.maxMaxRho !== undefined && summary.meanMaxRho > assertions.maxMaxRho) failures.push(`meanMaxRho ${summary.meanMaxRho.toFixed(4)} exceeds ${assertions.maxMaxRho}`);
  if (assertions.minStableFraction !== undefined && summary.meanStableFraction < assertions.minStableFraction) failures.push(`meanStableFraction ${summary.meanStableFraction.toFixed(4)} is below ${assertions.minStableFraction}`);
  return failures;
}

export function validateScenarioProposal(input: unknown, limits: ExecutionLimits = LOCAL_EXECUTION_LIMITS) {
  const proposal = parseProposal(input);
  const totalRuns = proposal.evidence.evaluations.reduce((sum, evaluation) => sum + evaluation.seeds.length, 0);
  if (totalRuns > limits.maxRuns) throw new ContractError("Proposal evidence exceeds execution limits.", [{ path: "evidence.evaluations", message: `At most ${limits.maxRuns} seeded evaluation runs are allowed.` }]);
  const totalIntegrationSteps = proposal.evidence.evaluations.reduce((sum, evaluation) => {
    const parameters = { ...proposal.scenario.defaults, ...evaluation.parameters };
    return sum + evaluation.seeds.length * parameters.steps * integrationSubstepsPerStep(parameters.dt);
  }, 0);
  if (totalIntegrationSteps > limits.maxTotalIntegrationSteps) throw new ContractError("Proposal evidence exceeds execution limits.", [{ path: "evidence.evaluations", message: `Evaluation runs exceed the ${limits.maxTotalIntegrationSteps} integration-step work budget.` }]);
  const issues: ProposalIssue[] = [];
  const existing = scenarioById[proposal.scenario.id];
  if (proposal.action === "create" && existing) issues.push({ severity: "error", path: "scenario.id", message: "A create proposal must use an unpublished scenario id." });
  if (proposal.action === "revise" && !existing) issues.push({ severity: "error", path: "scenario.id", message: "A revise proposal must reference a published scenario id." });
  if (!proposal.scenario.system) issues.push({ severity: "error", path: "scenario.system", message: "A publishable draft must define the bounded system, operator, boundary, objective, population, horizon, aggregation rule, and phase evidence." });
  if (proposal.scenario.system) {
    if (!systemTemplateById[proposal.scenario.system.templateId]) issues.push({ severity: "error", path: "scenario.system.templateId", message: "A publishable bounded system must reference a registered reusable system template." });
    if (proposal.scenario.system.templateId !== proposal.scenario.modelFamily) issues.push({ severity: "error", path: "scenario.modelFamily", message: "The compatibility modelFamily must match the bounded system's reusable template id." });
  }
  if (!proposal.scenario.defaultProtocolId || !proposal.scenario.protocols?.length) {
    issues.push({ severity: "error", path: "scenario.protocols", message: "A publishable draft must attach at least one complete scenario protocol and name its default protocol." });
  } else {
    if (!proposal.scenario.protocols.some((protocol) => protocol.id === proposal.scenario.defaultProtocolId)) issues.push({ severity: "error", path: "scenario.defaultProtocolId", message: "The default protocol id must reference an attached protocol." });
    if (proposal.scenario.protocols.some((protocol) => protocol.systemId !== proposal.scenario.id)) issues.push({ severity: "error", path: "scenario.protocols", message: "Every protocol must reference the bounded system id." });
    if (proposal.scenario.protocols.some((protocol) => protocol.templateId !== proposal.scenario.system?.templateId)) issues.push({ severity: "error", path: "scenario.protocols", message: "Every protocol must reference the bounded system's reusable template." });
    if (proposal.scenario.protocols.some((protocol) => !scenarioModuleById[protocol.moduleId])) issues.push({ severity: "error", path: "scenario.protocols", message: "Every protocol must resolve from a registered scenario module." });
    if (proposal.scenario.protocols.some((protocol) => {
      const scenarioModule = scenarioModuleById[protocol.moduleId];
      return scenarioModule && proposal.scenario.system && !scenarioModuleAppliesTo(scenarioModule.compatibleTemplateIds, proposal.scenario.system.templateId);
    })) issues.push({ severity: "error", path: "scenario.protocols", message: "Every scenario module must be compatible with the bounded system's reusable template." });
  }
  if (proposal.scenario.interventionIds.some((id) => !interventionDefinitionById[id])) issues.push({ severity: "error", path: "scenario.interventionIds", message: "Every intervention id must reference a registered reusable intervention definition." });
  if (proposal.scenario.system && proposal.scenario.interventionIds.some((id) => {
    const definition = interventionDefinitionById[id];
    return definition && !interventionAppliesTo(definition.compatibleTemplateIds, proposal.scenario.system!.templateId);
  })) issues.push({ severity: "error", path: "scenario.interventionIds", message: "Every intervention definition must be compatible with the bounded system's reusable template." });
  if (proposal.scenario.cycles.minor.label === proposal.scenario.cycles.major.label) issues.push({ severity: "error", path: "scenario.cycles", message: "Minor and major cycles must be meaningfully distinct." });
  if (proposal.evidence.references.length === 0) issues.push({ severity: "warning", path: "evidence.references", message: "No external or project reference supports this mapping." });
  if (!proposal.scenario.evidence) issues.push({ severity: "warning", path: "scenario.evidence", message: "Publication requires an explicit calibration status, units, assumptions, falsification criteria, and references." });
  if (proposal.scenario.defaults.rho0 >= proposal.scenario.defaults.rhoCrit) issues.push({ severity: "error", path: "scenario.defaults", message: "rho0 must remain below rhoCrit." });

  const evaluations = proposal.evidence.evaluations.map((evaluation) => {
    const parsedParameters = simulationParametersSchema.safeParse({ ...proposal.scenario.defaults, ...evaluation.parameters });
    if (!parsedParameters.success) throw new ContractError("Proposal evaluation contains invalid parameters.", parsedParameters.error.issues.map((issue) => ({ path: `evidence.evaluations.${evaluation.name}.parameters.${issue.path.map(String).join(".")}`, message: issue.message })));
    const parameters = parsedParameters.data as SimulationParameters;
    if (parameters.steps > limits.maxStepsPerRun) throw new ContractError("Proposal evidence exceeds execution limits.", [{ path: `evidence.evaluations.${evaluation.name}.parameters.steps`, message: `At most ${limits.maxStepsPerRun} steps per run are allowed.` }]);
    if (evaluation.interventions.length > limits.maxInterventions) throw new ContractError("Proposal evidence exceeds execution limits.", [{ path: `evidence.evaluations.${evaluation.name}.interventions`, message: `At most ${limits.maxInterventions} interventions are allowed.` }]);
    if (evaluation.interventions.some((event) => event.step >= parameters.steps)) throw new ContractError("Proposal evidence contains a late intervention.", [{ path: `evidence.evaluations.${evaluation.name}.interventions`, message: "Every intervention must occur before the final simulation step." }]);
    const activeParameters = { ...parameters };
    [...evaluation.interventions].sort((left, right) => left.step - right.step).forEach((event, index) => {
      Object.assign(activeParameters, event.effects);
      const parsed = simulationParametersSchema.safeParse(activeParameters);
      if (!parsed.success) throw new ContractError("Proposal intervention creates an invalid parameter state.", parsed.error.issues.map((issue) => ({ path: `evidence.evaluations.${evaluation.name}.interventions.${index}.effects.${issue.path.map(String).join(".")}`, message: issue.message })));
    });
    const summaries: SimulationSummary[] = evaluation.seeds.map((seed) => simulate(
      { ...parameters, seed },
      evaluation.interventions,
      { rupturePolicy: proposal.scenario.rupturePolicy },
    ).summary);
    const ensemble = summarizeRuns(summaries);
    const failures = checkAssertion(ensemble, evaluation.assertions);
    failures.forEach((message) => issues.push({ severity: "error", path: `evidence.evaluations.${evaluation.name}`, message }));
    return { name: evaluation.name, seeds: evaluation.seeds, assertions: evaluation.assertions, passed: failures.length === 0, failures, ensemble };
  });

  return {
    schemaVersion: CONTRACT_VERSION,
    status: "draft" as const,
    valid: issues.every((issue) => issue.severity !== "error"),
    publishable: false,
    publicationRequirement: "A human-reviewed pull request must add the validated definition to scenarios/catalog.ts and its reference cases to the test suite.",
    issues,
    evaluations,
  };
}
