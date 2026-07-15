import type {
  InterventionDefinition,
  InterventionPlanDefinition,
  ModelFamily,
  ScenarioCategory,
} from "../contracts/types.ts";
import type { ScheduledIntervention, SimulationParameters } from "../engine/simulator.ts";
import { applyParameterTransforms } from "./protocols.ts";

const allTemplateIds: ModelFamily[] = [
  "regenerative-stock",
  "threshold-regime-shift",
  "resistance-contagion",
  "trust-legitimacy",
  "capability-correction",
  "network-cascade",
  "financial-leverage",
  "human-capacity",
];

const translations = (
  values: Record<ScenarioCategory, string>,
): Partial<Record<ScenarioCategory, string>> => values;

const commonEvidence = {
  status: "illustrative" as const,
  calibrationStatus: "Mechanism and magnitude are synthetic. Domain use requires empirical calibration, feasibility review, and measurement of side effects.",
};

/** Reusable corrective mechanisms expressed in canonical ATS variables. */
export const interventionDefinitions: InterventionDefinition[] = [
  {
    id: "increase-correction",
    version: "1.0.0",
    title: "Expand correction capacity",
    shortTitle: "Increase correction",
    icon: "♢",
    mechanism: "expand-correction-capacity",
    summary: "Adds capacity to detect, repair, gate, restore, or escalate failures.",
    transforms: [{ parameter: "correction", operation: "add", value: 0.14 }],
    compatibleTemplateIds: "all",
    timing: { onsetDelaySteps: 0, decay: "persistent" },
    cost: { base: 1, perIntensity: 1, unit: "illustrative-cost-points" },
    prerequisites: ["A correction pathway exists.", "Operators can act on detected failures."],
    tradeoffs: ["Consumes staffing, time, resources, or throughput.", "Correction may fail if feedback remains poor."],
    domainTranslations: translations({
      AI: "Add verification, review, rollback, escalation, or bounded tool controls.", Ecology: "Expand restoration, enforcement, adaptive management, or replenishment capacity.", Healthcare: "Add diagnostic, treatment-review, containment, staffing, or recovery capacity.", Organizations: "Fund redress, repair, appeals, and accountable decision revision.", Infrastructure: "Add maintenance crews, spares, redundancy, isolation, and restoration capacity.", Economy: "Increase buffers, restructuring capacity, relief, and corrective fiscal or market tools.", Society: "Expand services, safeguards, mediation, remediation, and community recovery capacity.",
    }),
    evidence: commonEvidence,
    provenance: "illustrative-intervention-module",
  },
  {
    id: "improve-feedback",
    version: "1.0.0",
    title: "Increase constraint visibility",
    shortTitle: "Improve feedback",
    icon: "▣",
    mechanism: "increase-constraint-visibility",
    summary: "Makes lower-layer consequences arrive sooner and more faithfully in the operating feedback loop.",
    transforms: [{ parameter: "feedback", operation: "add", value: 0.12 }],
    compatibleTemplateIds: "all",
    timing: { onsetDelaySteps: 0, decay: "persistent" },
    cost: { base: 1, perIntensity: 1, unit: "illustrative-cost-points" },
    prerequisites: ["Relevant outcomes can be observed.", "Feedback reaches a decision authority."],
    tradeoffs: ["Measurement and reporting add overhead.", "Visible signals can still be misclassified."],
    domainTranslations: translations({
      AI: "Improve telemetry, user-harm signals, verifier evidence, incident reporting, and audit visibility.", Ecology: "Increase monitoring coverage, ecological indicators, community reporting, and enforcement feedback.", Healthcare: "Improve surveillance, diagnostics, safety reporting, and patient or workforce feedback.", Organizations: "Strengthen transparency, appeals, outcome measurement, and whistleblower channels.", Infrastructure: "Increase inspection fidelity, telemetry, condition monitoring, and incident learning.", Economy: "Improve exposure, liquidity, distributional-impact, and balance-sheet transparency.", Society: "Improve access, wellbeing, trust, harm, and subgroup outcome feedback.",
    }),
    evidence: commonEvidence,
    provenance: "illustrative-intervention-module",
  },
  {
    id: "reduce-pressure",
    version: "1.0.0",
    title: "Reduce optimization pressure",
    shortTitle: "Reduce pressure",
    icon: "↓",
    mechanism: "reduce-optimization-pressure",
    summary: "Reduces the rate or intensity at which the system pursues its constructed objective.",
    transforms: [{ parameter: "pressure", operation: "add", value: -0.42 }],
    compatibleTemplateIds: "all",
    timing: { onsetDelaySteps: 0, decay: "persistent" },
    cost: { base: 0.5, perIntensity: 0.5, unit: "illustrative-cost-points" },
    prerequisites: ["The operator can change targets, demand, pace, quotas, load, or incentives."],
    tradeoffs: ["May reduce short-run output or service throughput.", "Does not automatically repay existing debt."],
    domainTranslations: translations({
      AI: "Slow rollout, reduce autonomy, narrow objectives, rate-limit actions, or lower engagement and release targets.", Ecology: "Reduce harvest, extraction, pollution, land conversion, or demand.", Healthcare: "Reduce unsafe workload, selection pressure, unnecessary use, or throughput targets.", Organizations: "Relax conflicting KPIs, deadlines, quotas, growth targets, or compliance load.", Infrastructure: "Shed noncritical load, reduce utilization, meter demand, or slow expansion.", Economy: "Deleverage, smooth refinancing, reduce extraction, or relax destabilizing growth pressure.", Society: "Reduce harmful exposure, administrative burden, displacement pressure, or competitive intensity.",
    }),
    evidence: commonEvidence,
    provenance: "illustrative-intervention-module",
  },
  {
    id: "add-audit",
    version: "1.0.0",
    title: "Reduce misclassification",
    shortTitle: "Add audit",
    icon: "⌕",
    mechanism: "reduce-misclassification",
    summary: "Tests the operating representation against external evidence and reduces a specific class of classification error.",
    transforms: [
      { parameter: "error", operation: "add", value: -0.09 },
      { parameter: "feedback", operation: "add", value: 0.05 },
    ],
    compatibleTemplateIds: "all",
    timing: { onsetDelaySteps: 2, decay: "persistent" },
    cost: { base: 1, perIntensity: 1, unit: "illustrative-cost-points" },
    prerequisites: ["An independent comparison or reference can challenge the internal model."],
    tradeoffs: ["Audits can be slow or gamed.", "An audit only reduces errors it is capable of detecting."],
    domainTranslations: translations({
      AI: "Use external evaluation, red teaming, grounding checks, independent review, and outcome audits.", Ecology: "Re-estimate stocks, validate models, inspect compliance, and compare remote and field observations.", Healthcare: "Review diagnoses, prescribing, incidents, outcomes, and surveillance definitions independently.", Organizations: "Audit outcome claims, incentives, procedures, complaints, and distributional effects.", Infrastructure: "Independently inspect asset condition, maintenance records, loads, and failure assumptions.", Economy: "Stress-test assumptions, reconcile exposures, audit valuation, and review distributional effects.", Society: "Validate indicators against lived outcomes, subgroup evidence, and independent longitudinal measures.",
    }),
    evidence: commonEvidence,
    provenance: "illustrative-intervention-module",
  },
  {
    id: "pause-optimization",
    version: "1.0.0",
    title: "Temporary containment and observation",
    shortTitle: "Pause optimization",
    icon: "Ⅱ",
    mechanism: "contain-and-observe",
    summary: "Temporarily lowers pressure so operators can observe, isolate, and prepare correction before normal operation resumes.",
    transforms: [
      { parameter: "pressure", operation: "add", value: -0.72 },
      { parameter: "correction", operation: "add", value: 0.04 },
    ],
    compatibleTemplateIds: "all",
    timing: { onsetDelaySteps: 0, defaultDurationSteps: 80, decay: "restore-at-end" },
    cost: { base: 0.5, perIntensity: 0.5, unit: "illustrative-cost-points" },
    prerequisites: ["The system can be paused, isolated, throttled, or placed in a safe operating mode."],
    tradeoffs: ["Service or output falls temporarily.", "Resuming without structural correction can recreate the problem."],
    domainTranslations: translations({
      AI: "Pause deployment or actions, restrict tools, isolate the model, and collect evidence.", Ecology: "Use a temporary closure, moratorium, emergency restriction, or protected recovery interval.", Healthcare: "Pause unsafe practice, isolate transmission, reduce elective load, or activate emergency staffing rules.", Organizations: "Freeze a harmful process, target, decision, or rollout while review proceeds.", Infrastructure: "Take an asset or segment out of service, shed load, isolate failure, and inspect.", Economy: "Use a temporary standstill, circuit breaker, capital control, or emergency liquidity window.", Society: "Pause a policy, displacement process, harmful exposure, or enforcement action for review.",
    }),
    evidence: commonEvidence,
    provenance: "illustrative-intervention-module",
  },
  {
    id: "repay-debt",
    version: "1.0.0",
    title: "Repay accumulated alignment debt",
    shortTitle: "Repay debt",
    icon: "↺",
    mechanism: "repay-alignment-debt",
    summary: "Prioritizes restoration and backlog reduction so past divergence contributes less to future instability.",
    transforms: [
      { parameter: "beta", operation: "add", value: 0.12 },
      { parameter: "correction", operation: "add", value: 0.08 },
    ],
    compatibleTemplateIds: "all",
    timing: { onsetDelaySteps: 0, decay: "persistent" },
    cost: { base: 1.5, perIntensity: 1.5, unit: "illustrative-cost-points" },
    prerequisites: ["The accumulated debt has an identifiable restoration or remediation pathway."],
    tradeoffs: ["Consumes resources without necessarily increasing current output.", "Some irreversible loss cannot be repaid."],
    domainTranslations: translations({
      AI: "Retire unsafe dependencies, remediate incidents, repair datasets, resolve backlogs, and redesign brittle controls.", Ecology: "Restore habitat, stocks, soil, water, or ecological connectivity and remove legacy contamination.", Healthcare: "Clear care, staffing, surveillance, training, and recovery backlogs.", Organizations: "Resolve grievances, technical debt, unpaid obligations, procedural failures, and trust damage.", Infrastructure: "Eliminate deferred maintenance, replace failed assets, rebuild spares, and restore redundancy.", Economy: "Restructure overhang, recapitalize buffers, repair household or public balance sheets, and fund transition costs.", Society: "Remediate displacement, learning, health, trust, access, and institutional backlogs.",
    }),
    evidence: commonEvidence,
    provenance: "illustrative-intervention-module",
  },
];

export const interventionDefinitionById = Object.fromEntries(
  interventionDefinitions.map((item) => [item.id, item]),
) as Record<string, InterventionDefinition>;

export const interventionPlans: InterventionPlanDefinition[] = [
  { id: "no-action", version: "1.0.0", title: "No intervention", strategy: "none", summary: "Runs the selected system and scenario without operator action.", learningObjective: "Reveal the untreated trajectory and establish a comparison baseline.", items: [], compatibleTemplateIds: "all", provenance: "illustrative-intervention-plan" },
  { id: "visibility-first", version: "1.0.0", title: "Visibility first", strategy: "preventive", summary: "Improves feedback and then audits the operating representation before adding capacity.", learningObjective: "Test whether seeing the right constraints earlier changes the trajectory.", items: [{ interventionId: "improve-feedback", intensity: 1, startFraction: 0.08 }, { interventionId: "add-audit", intensity: 1, startFraction: 0.14 }], compatibleTemplateIds: "all", provenance: "illustrative-intervention-plan" },
  { id: "pressure-relief", version: "1.0.0", title: "Early pressure relief", strategy: "preventive", summary: "Reduces optimization pressure early without directly changing feedback or debt repayment.", learningObjective: "Separate pressure reduction from correction and test whether slowing alone is enough.", items: [{ interventionId: "reduce-pressure", intensity: 1, startFraction: 0.1 }], compatibleTemplateIds: "all", provenance: "illustrative-intervention-plan" },
  { id: "correction-surge", version: "1.0.0", title: "Correction surge", strategy: "corrective", summary: "Improves feedback and expands correction capacity early in the run.", learningObjective: "Test the correction-scaling condition C ≥ D before debt becomes dominant.", items: [{ interventionId: "improve-feedback", intensity: 1, startFraction: 0.08 }, { interventionId: "increase-correction", intensity: 1, startFraction: 0.12 }], compatibleTemplateIds: "all", provenance: "illustrative-intervention-plan" },
  { id: "debt-restoration", version: "1.0.0", title: "Debt restoration", strategy: "restorative", summary: "Expands correction and then increases modeled debt repayment.", learningObjective: "Show why lowering current pressure and repairing accumulated debt are different actions.", items: [{ interventionId: "increase-correction", intensity: 1, startFraction: 0.1 }, { interventionId: "repay-debt", intensity: 1, startFraction: 0.16 }], compatibleTemplateIds: "all", provenance: "illustrative-intervention-plan" },
  { id: "layered-correction", version: "1.0.0", title: "Layered correction", strategy: "corrective", summary: "Sequences audit, visibility, pressure relief, correction capacity, and debt repayment.", learningObjective: "Demonstrate that robust correction may require several mechanisms rather than one slider change.", items: [{ interventionId: "add-audit", intensity: 1, startFraction: 0.06 }, { interventionId: "improve-feedback", intensity: 1, startFraction: 0.1 }, { interventionId: "reduce-pressure", intensity: 1, startFraction: 0.16 }, { interventionId: "increase-correction", intensity: 1, startFraction: 0.22 }, { interventionId: "repay-debt", intensity: 1, startFraction: 0.3 }], compatibleTemplateIds: "all", provenance: "illustrative-intervention-plan" },
  { id: "delayed-correction", version: "1.0.0", title: "Delayed layered correction", strategy: "corrective", summary: "Applies the layered sequence after debt and excursion have had time to accumulate.", learningObjective: "Compare an identical mechanism mix at a later time and observe path dependence.", items: [{ interventionId: "add-audit", intensity: 1, startFraction: 0.5 }, { interventionId: "improve-feedback", intensity: 1, startFraction: 0.54 }, { interventionId: "reduce-pressure", intensity: 1, startFraction: 0.58 }, { interventionId: "increase-correction", intensity: 1, startFraction: 0.62 }, { interventionId: "repay-debt", intensity: 1, startFraction: 0.68 }], compatibleTemplateIds: "all", provenance: "illustrative-intervention-plan" },
  { id: "temporary-containment", version: "1.0.0", title: "Contain, observe, resume", strategy: "containment", summary: "Temporarily pauses optimization while an audit improves the operating representation, then resumes pressure.", learningObjective: "Show the difference between buying time and permanently reducing pressure.", items: [{ interventionId: "pause-optimization", intensity: 1, startFraction: 0.08, durationSteps: 80 }, { interventionId: "add-audit", intensity: 1, startFraction: 0.14 }], compatibleTemplateIds: allTemplateIds, provenance: "illustrative-intervention-plan" },
];

export const interventionPlanById = Object.fromEntries(
  interventionPlans.map((item) => [item.id, item]),
) as Record<string, InterventionPlanDefinition>;

export function interventionAppliesTo(
  compatibleTemplateIds: ModelFamily[] | "all",
  templateId: ModelFamily,
) {
  return compatibleTemplateIds === "all" || compatibleTemplateIds.includes(templateId);
}

function selectedEffects(
  before: SimulationParameters,
  after: SimulationParameters,
  definition: InterventionDefinition,
) {
  return Object.fromEntries(
    definition.transforms.map((transform) => [transform.parameter, after[transform.parameter]]),
  ) as Partial<SimulationParameters>;
}

export function compileIntervention(input: {
  definition: InterventionDefinition;
  parameters: SimulationParameters;
  step: number;
  planId?: string;
  intensity?: number;
  durationSteps?: number;
  occurrenceId?: string;
}): { events: ScheduledIntervention[]; activeParameters: SimulationParameters } {
  const intensity = input.intensity ?? 1;
  const definition = input.definition;
  const step = Math.max(0, Math.min(input.parameters.steps - 1, Math.round(input.step + definition.timing.onsetDelaySteps)));
  const activeParameters = applyParameterTransforms(input.parameters, definition.transforms, intensity);
  const occurrenceId = input.occurrenceId ?? `${definition.id}-${step}`;
  const durationSteps = input.durationSteps ?? definition.timing.defaultDurationSteps;
  const cost = definition.cost.base + definition.cost.perIntensity * intensity;
  const start: ScheduledIntervention = {
    id: occurrenceId,
    label: definition.shortTitle,
    step,
    effects: selectedEffects(input.parameters, activeParameters, definition),
    cost,
    definitionId: definition.id,
    planId: input.planId,
    intensity,
    durationSteps,
    phase: "start",
    mechanism: definition.mechanism,
  };
  if (definition.timing.decay !== "restore-at-end" || !durationSteps) return { events: [start], activeParameters };
  const endStep = Math.min(input.parameters.steps - 1, step + durationSteps);
  if (endStep <= step) return { events: [start], activeParameters };
  const restoreEffects = Object.fromEntries(
    definition.transforms.map((transform) => [transform.parameter, input.parameters[transform.parameter]]),
  ) as Partial<SimulationParameters>;
  return {
    events: [start, {
      id: `${occurrenceId}-end`,
      label: `${definition.shortTitle} ends`,
      step: endStep,
      effects: restoreEffects,
      cost: 0,
      definitionId: definition.id,
      planId: input.planId,
      intensity,
      durationSteps,
      phase: "end",
      mechanism: definition.mechanism,
    }],
    activeParameters,
  };
}

export function compileInterventionPlan(
  plan: InterventionPlanDefinition,
  parameters: SimulationParameters,
): ScheduledIntervention[] {
  const events: ScheduledIntervention[] = [];
  let activeParameters = { ...parameters };
  const items = [...plan.items].sort((left, right) => left.startFraction - right.startFraction);
  items.forEach((item, index) => {
    const definition = interventionDefinitionById[item.interventionId];
    if (!definition) throw new Error(`Unknown intervention definition '${item.interventionId}'.`);
    const compiled = compileIntervention({
      definition,
      parameters: activeParameters,
      step: Math.round((parameters.steps - 1) * item.startFraction) + (item.onsetDelaySteps ?? 0),
      planId: plan.id,
      intensity: item.intensity,
      durationSteps: item.durationSteps,
      occurrenceId: `${plan.id}-${index + 1}-${definition.id}`,
    });
    events.push(...compiled.events);
    activeParameters = compiled.activeParameters;
  });
  return events.sort((left, right) => left.step - right.step || left.id.localeCompare(right.id));
}

