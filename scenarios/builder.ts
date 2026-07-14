import { CONTRACT_VERSION } from "../contracts/constants.ts";
import {
  scenarioProposalSchema,
  type ParsedScenarioProposal,
} from "../contracts/schemas.ts";
import type { ScenarioCategory } from "../contracts/types.ts";
import {
  defaultParameters,
  type SimulationParameters,
} from "../engine/simulator.ts";

export type BuilderAnswerKey =
  | "systemName"
  | "category"
  | "objective"
  | "pressure"
  | "minorCycle"
  | "majorCycle"
  | "independentCycles"
  | "minorObservation"
  | "majorObservation"
  | "feedback"
  | "misclassification"
  | "correction"
  | "drift"
  | "debt"
  | "irreversibleLoss"
  | "viableRegion"
  | "shocks"
  | "falsification";

export type BuilderAnswer = {
  id: BuilderAnswerKey;
  question: string;
  hint: string;
  placeholder: string;
  kind?: "text" | "choice";
  options?: readonly string[];
};

export type BuilderAnswers = Record<BuilderAnswerKey, string>;

export const builderQuestions: readonly BuilderAnswer[] = [
  { id: "systemName", question: "What system are you modeling?", hint: "Use a short, recognizable name.", placeholder: "e.g. Regional emergency department" },
  { id: "category", question: "Which domain best fits the system?", hint: "This organizes the draft; it does not calibrate it.", placeholder: "Select a domain", kind: "choice", options: ["AI", "Ecology", "Healthcare", "Organizations", "Infrastructure", "Economy", "Society"] },
  { id: "objective", question: "What outcome is the system optimizing?", hint: "This is the objective, not optimization pressure π.", placeholder: "e.g. Treat urgent patients safely and promptly" },
  { id: "pressure", question: "What creates optimization pressure π?", hint: "Name the force that intensifies pursuit of the objective.", placeholder: "e.g. Rising arrivals, wait-time targets, and staffing scarcity" },
  { id: "minorCycle", question: "What fast internal correction cycle recurs?", hint: "Enter at least two observable stages separated by arrows or commas.", placeholder: "e.g. triage → diagnose → treat → reassess" },
  { id: "majorCycle", question: "What slower external adaptation cycle recurs?", hint: "Enter at least two stages through which context or policy changes.", placeholder: "e.g. review demand → revise staffing → evaluate outcomes" },
  { id: "independentCycles", question: "Do the two cycles recur independently?", hint: "A torus is warranted only when both phases are meaningful and neither is merely a relabeling of the other.", placeholder: "Choose the evidence status", kind: "choice", options: ["Yes — independently recurrent", "Uncertain — needs evidence", "No — one cycle depends entirely on the other"] },
  { id: "minorObservation", question: "How would you observe the internal phase θ?", hint: "Name an operational stage, timestamp, sensor, or event sequence.", placeholder: "e.g. workflow events identify triage, diagnosis, treatment, and reassessment" },
  { id: "majorObservation", question: "How would you estimate the external phase φ?", hint: "Name a measurable recurrent signal and how recurrence would be tested.", placeholder: "e.g. quarterly demand and policy telemetry with spectral and cycle-count gates" },
  { id: "feedback", question: "What real signal represents feedback fidelity γ?", hint: "Describe how consequences return to the system accurately and in time.", placeholder: "e.g. outcome audits, incident reports, and follow-up data" },
  { id: "misclassification", question: "What can the system misunderstand, ε?", hint: "Name an important constraint omitted or misclassified by the working representation.", placeholder: "e.g. acuity hidden by incomplete intake information" },
  { id: "correction", question: "What supplies correction capacity C?", hint: "Name the people, processes, reserves, or mechanisms that repair divergence.", placeholder: "e.g. escalation teams, senior review, and surge staffing" },
  { id: "drift", question: "What changes the viable region, Φ?", hint: "Describe environmental, policy, population, or technological drift.", placeholder: "e.g. seasonal disease patterns and changing care standards" },
  { id: "debt", question: "What accumulates as alignment debt Δ?", hint: "Name deferred correction that raises future recovery cost.", placeholder: "e.g. unresolved cases, staff fatigue, and audit backlog" },
  { id: "irreversibleLoss", question: "What damage is irreversible, Λ?", hint: "Name loss that ordinary feedback and correction cannot cheaply undo.", placeholder: "e.g. preventable death or permanent loss of public trust" },
  { id: "viableRegion", question: "What defines viable operation?", hint: "State the conditions that must remain true for recurrent operation and recovery.", placeholder: "e.g. safe outcomes, bounded queues, sustainable workload, and retained surge capacity" },
  { id: "shocks", question: "What shocks or interventions should a protocol test?", hint: "Separate multiple items with commas or new lines.", placeholder: "e.g. demand spike, staffing loss, early surge activation, improved feedback" },
  { id: "falsification", question: "What evidence would show this torus mapping is wrong?", hint: "State a concrete condition that would challenge two-phase recurrence or the proposed variable mappings.", placeholder: "e.g. the external signal does not recur, or correction and adaptation are not dynamically distinct" },
] as const;

export function emptyBuilderAnswers(): BuilderAnswers {
  return Object.fromEntries(builderQuestions.map((question) => [question.id, ""])) as BuilderAnswers;
}

export type TorusEligibility = {
  eligible: boolean;
  complete: number;
  total: number;
  issues: { field: BuilderAnswerKey; message: string }[];
};

export function assessTorusEligibility(answers: BuilderAnswers): TorusEligibility {
  const complete = builderQuestions.filter((question) => answers[question.id].trim()).length;
  const issues: TorusEligibility["issues"] = [];
  const minorStages = cycleStages(answers.minorCycle);
  const majorStages = cycleStages(answers.majorCycle);
  if (minorStages.length < 2) issues.push({ field: "minorCycle", message: "The internal cycle needs at least two observable recurrent stages." });
  if (majorStages.length < 2) issues.push({ field: "majorCycle", message: "The external cycle needs at least two observable recurrent stages." });
  if (!answers.independentCycles.startsWith("Yes")) issues.push({ field: "independentCycles", message: "Two independently recurrent phases have not been established, so a torus is not yet warranted." });
  if (!answers.minorObservation.trim()) issues.push({ field: "minorObservation", message: "An observation source for θ is required." });
  if (!answers.majorObservation.trim()) issues.push({ field: "majorObservation", message: "An observation and identifiability plan for φ is required." });
  if (answers.minorCycle.trim().toLowerCase() === answers.majorCycle.trim().toLowerCase() && answers.minorCycle.trim()) issues.push({ field: "majorCycle", message: "The two phase descriptions must be meaningfully distinct." });
  if (!answers.falsification.trim()) issues.push({ field: "falsification", message: "A falsification condition is required before the mapping can be tested." });
  return { eligible: complete === builderQuestions.length && issues.length === 0, complete, total: builderQuestions.length, issues };
}

export function buildScenarioProposal(
  answers: BuilderAnswers,
  defaults: SimulationParameters = defaultParameters,
): ParsedScenarioProposal {
  const eligibility = assessTorusEligibility(answers);
  if (!eligibility.eligible) throw new Error(eligibility.issues[0]?.message ?? "Complete every builder field before creating a torus proposal.");
  const minorStages = cycleStages(answers.minorCycle);
  const majorStages = cycleStages(answers.majorCycle);
  const systemName = bounded(answers.systemName, 80);
  const pressure = bounded(answers.pressure, 160);
  const id = slugify(systemName);
  const stress = {
    pressure: Math.min(3, defaults.pressure + 0.6),
    error: Math.min(1, defaults.error + 0.2),
    feedback: Math.max(0, defaults.feedback - 0.2),
    correction: Math.max(0, defaults.correction - 0.2),
    drift: Math.min(0.5, defaults.drift + 0.05),
  };
  const recovery = {
    pressure: Math.max(0, defaults.pressure - 0.35),
    error: Math.max(0, defaults.error - 0.12),
    feedback: Math.min(1, defaults.feedback + 0.18),
    correction: Math.min(2, defaults.correction + 0.28),
  };
  const criticalRho = defaults.rhoCrit;
  const proposal = {
    schemaVersion: CONTRACT_VERSION,
    status: "draft" as const,
    action: "create" as const,
    proposedBy: { kind: "human" as const, name: "Viability Torus Lab builder user" },
    rationale: bounded(`This draft tests whether ${systemName} can be represented by two independently recurrent, observable phases while keeping the domain mapping explicitly illustrative and falsifiable.`, 5_000),
    scenario: {
      id,
      version: "0.1.0",
      title: bounded(`${systemName} Under ${pressure}`, 160),
      shortTitle: systemName,
      summary: bounded(`${systemName} is modeled as a synthetic two-cycle system pursuing ${answers.objective.trim()} while ${answers.pressure.trim()} creates optimization pressure.`, 500),
      category: answers.category as ScenarioCategory,
      watchlistTier: "featured" as const,
      modelFamily: "capability-correction" as const,
      calibration: "illustrative" as const,
      difficulty: "Advanced" as const,
      icon: "◇",
      accent: "#7168ff",
      optimizedOutcome: bounded(answers.objective, 300),
      viableRegion: bounded(answers.viableRegion, 500),
      hiddenConstraint: bounded(answers.misclassification, 500),
      debtMechanism: bounded(answers.debt, 500),
      irreversibleMechanism: bounded(answers.irreversibleLoss, 500),
      interventionIds: ["increase-correction", "improve-feedback", "reduce-pressure", "add-audit", "pause-optimization", "repay-debt"],
      events: splitItems(answers.shocks, 30, 200),
      interventions: [
        bounded(`Increase ${answers.correction.trim()}`, 200),
        bounded(`Improve ${answers.feedback.trim()}`, 200),
        bounded(`Reduce ${answers.pressure.trim()}`, 200),
      ],
      warningConditions: [
        bounded(`${answers.pressure.trim()} grows faster than ${answers.correction.trim()}.`, 300),
        bounded(`${answers.debt.trim()} accumulates while radial excursion expands.`, 300),
        "The modeled state approaches the illustrative radial viability boundary.",
      ],
      ruptureCondition: bounded(`${answers.irreversibleLoss.trim()} combines with persistent boundary excursion and accumulated ${answers.debt.trim()}.`, 500),
      recoveryCondition: bounded(`${answers.correction.trim()} and ${answers.feedback.trim()} restore a positive debt-adjusted margin long enough for radial contraction.`, 500),
      plainLanguageInterpretation: bounded(`This draft asks whether ${systemName} stays viable when its fast correction cycle and slower adaptation cycle both remain observable, recurrent, and supported by enough correction capacity to offset pressure, error, drift, debt, and irreversible loss.`, 1_000),
      evidence: {
        status: "illustrative" as const,
        calibrationStatus: "Builder-generated draft; no empirical calibration or external validation has been supplied.",
        parameterUnits: "All defaults are dimensionless illustrative values until domain evidence supplies operational units and measurement scales.",
        assumptions: [
          "The internal and external cycles are meaningfully distinct and independently recurrent.",
          bounded(`Internal phase observation: ${answers.minorObservation.trim()}`, 500),
          bounded(`External phase observation and identifiability plan: ${answers.majorObservation.trim()}`, 500),
          "The canonical parameter mappings are hypotheses rather than measured quantities.",
        ],
        falsificationCriteria: [bounded(answers.falsification, 500)],
        references: [{ title: "Sori (2026), Toroidal Geometry in ATS/AANA/AIx, revised phase-coordinate edition" }],
      },
      cycles: {
        minor: {
          label: bounded(minorStages.join(" → "), 120),
          stages: minorStages,
          description: bounded(`Fast internal correction cycle observed through ${answers.minorObservation.trim()}.`, 500),
          defaultFrequency: defaults.omegaTheta,
          phaseSource: "operational-stage" as const,
        },
        major: {
          label: bounded(majorStages.join(" → "), 120),
          stages: majorStages,
          description: bounded(`Slower external adaptation cycle estimated through ${answers.majorObservation.trim()}.`, 500),
          defaultFrequency: defaults.omegaPhi,
          phaseSource: "estimated" as const,
        },
      },
      labels: {
        pressure: bounded(answers.pressure, 80),
        error: bounded(answers.misclassification, 80),
        feedback: bounded(answers.feedback, 80),
        correction: bounded(answers.correction, 80),
        drift: bounded(answers.drift, 80),
        irreversibleLoss: bounded(answers.irreversibleLoss, 80),
        initialDebt: bounded(answers.debt, 80),
        restoration: "Return toward recurrent viable operation",
        debtCoupling: "Effect of deferred correction on excursion",
        radialExcursion: "Modeled distance from the proposed viable recurrent tube",
      },
      aixLabels: {
        physical: "Physical and factual feasibility for the proposed system",
        biological: "Human or ecological viability for affected populations",
        constructed: "Coherence with the stated objective and operating rules",
        feedback: bounded(answers.feedback, 160),
      },
      ranges: {
        pressure: { min: 0, max: 3, step: 0.01 },
        error: { min: 0, max: 1, step: 0.01 },
        feedback: { min: 0, max: 1, step: 0.01 },
        correction: { min: 0, max: 2, step: 0.01 },
        drift: { min: 0, max: 0.5, step: 0.01 },
        irreversibleLoss: { min: 0, max: 0.5, step: 0.01 },
        initialDebt: { min: 0, max: 2, step: 0.01 },
      },
      thresholds: {
        warningRho: Math.max(0.01, criticalRho * 0.64),
        criticalRho,
        irreversibleRho: Math.min(20, criticalRho + 0.9),
        phaseConfidenceMinimum: 0.2,
      },
      rupturePolicy: {
        irreversibleRho: Math.min(20, criticalRho + 0.9),
        cumulativeLossThreshold: 0.5,
        debtThreshold: 1,
        persistenceSteps: 12,
        provenance: "illustrative-scenario-policy" as const,
        rationale: "This terminal rule is an illustrative product policy requiring persistent excursion and accumulated loss; it is not a threshold supplied by the paper or domain evidence.",
      },
      defaults: { ...defaults },
      presets: [
        { name: "Draft baseline", description: "Use the builder's current illustrative default values.", values: { pressure: defaults.pressure, feedback: defaults.feedback, correction: defaults.correction } },
        { name: "Compound stress", description: "Raise pressure and error while reducing feedback and correction.", values: stress },
        { name: "Early recovery", description: "Reduce pressure while improving feedback and correction capacity.", values: recovery },
      ],
    },
    evidence: {
      hypothesis: bounded(`${systemName} remains viable when its independently recurrent correction and adaptation cycles remain observable and correction capacity offsets modeled divergence and debt pressure.`, 2_000),
      assumptions: [
        bounded(`Phase independence claim: ${answers.independentCycles}`, 500),
        bounded(`θ observation source: ${answers.minorObservation}`, 500),
        bounded(`φ observation and identifiability plan: ${answers.majorObservation}`, 500),
        "The initial protocol values and thresholds are illustrative rather than empirically calibrated.",
      ],
      references: ["Sori, A. (2026). Toroidal Geometry in ATS/AANA/AIx, revised phase-coordinate edition."],
      evaluations: [
        { name: "Executable baseline protocol", seeds: [101, 211, 307], assertions: { maxMaxRho: 1_000 } },
        { name: "Executable compound-stress protocol", parameters: stress, seeds: [101, 211, 307], assertions: { maxMaxRho: 1_000 } },
        {
          name: "Executable early-correction protocol",
          parameters: stress,
          interventions: [{ id: "early-draft-correction", label: "Apply the draft recovery levers", step: 20, effects: recovery, cost: 3 }],
          seeds: [101, 211, 307],
          assertions: { maxMaxRho: 1_000 },
        },
      ],
    },
  };
  return scenarioProposalSchema.parse(proposal);
}

function cycleStages(value: string) {
  return value
    .split(/(?:→|->|,|;|\n)/)
    .map((item) => bounded(item.trim(), 80))
    .filter(Boolean)
    .slice(0, 20);
}

function splitItems(value: string, maxItems: number, maxLength: number) {
  const items = value.split(/(?:,|;|\n)/).map((item) => bounded(item.trim(), maxLength)).filter(Boolean).slice(0, maxItems);
  return items.length ? items : ["Illustrative stress event"];
}

function slugify(value: string) {
  const slug = value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "custom-system";
}

function bounded(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}
