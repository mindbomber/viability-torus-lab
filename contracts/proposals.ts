import { simulate, type SimulationSummary } from "../engine/simulator.ts";
import { scenarioById } from "../scenarios/catalog.ts";
import { CONTRACT_VERSION, LOCAL_EXECUTION_LIMITS, type ExecutionLimits } from "./constants.ts";
import { ContractError, summarizeRuns } from "./experiments.ts";
import { scenarioProposalSchema, type ParsedScenarioProposal } from "./schemas.ts";

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
  const totalIntegrationSteps = proposal.evidence.evaluations.reduce((sum, evaluation) => sum + evaluation.seeds.length * (evaluation.parameters.steps ?? proposal.scenario.defaults.steps), 0);
  if (totalIntegrationSteps > limits.maxTotalIntegrationSteps) throw new ContractError("Proposal evidence exceeds execution limits.", [{ path: "evidence.evaluations", message: `Evaluation runs exceed the ${limits.maxTotalIntegrationSteps} integration-step work budget.` }]);
  const issues: ProposalIssue[] = [];
  const existing = scenarioById[proposal.scenario.id];
  if (proposal.action === "create" && existing) issues.push({ severity: "error", path: "scenario.id", message: "A create proposal must use an unpublished scenario id." });
  if (proposal.action === "revise" && !existing) issues.push({ severity: "error", path: "scenario.id", message: "A revise proposal must reference a published scenario id." });
  if (proposal.scenario.cycles.minor.label === proposal.scenario.cycles.major.label) issues.push({ severity: "error", path: "scenario.cycles", message: "Minor and major cycles must be meaningfully distinct." });
  if (proposal.evidence.references.length === 0) issues.push({ severity: "warning", path: "evidence.references", message: "No external or project reference supports this mapping." });
  if (proposal.scenario.defaults.rho0 >= proposal.scenario.defaults.rhoCrit) issues.push({ severity: "error", path: "scenario.defaults", message: "rho0 must remain below rhoCrit." });

  const evaluations = proposal.evidence.evaluations.map((evaluation) => {
    const parameters = { ...proposal.scenario.defaults, ...evaluation.parameters };
    if (parameters.steps > limits.maxStepsPerRun) throw new ContractError("Proposal evidence exceeds execution limits.", [{ path: `evidence.evaluations.${evaluation.name}.parameters.steps`, message: `At most ${limits.maxStepsPerRun} steps per run are allowed.` }]);
    if (evaluation.interventions.length > limits.maxInterventions) throw new ContractError("Proposal evidence exceeds execution limits.", [{ path: `evidence.evaluations.${evaluation.name}.interventions`, message: `At most ${limits.maxInterventions} interventions are allowed.` }]);
    if (evaluation.interventions.some((event) => event.step >= parameters.steps)) throw new ContractError("Proposal evidence contains a late intervention.", [{ path: `evidence.evaluations.${evaluation.name}.interventions`, message: "Every intervention must occur before the final simulation step." }]);
    const summaries: SimulationSummary[] = evaluation.seeds.map((seed) => simulate({ ...parameters, seed }, evaluation.interventions).summary);
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
