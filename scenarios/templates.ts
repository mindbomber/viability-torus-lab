import type {
  MaintenancePatternDefinition,
  MaintenancePatternId,
  SystemTemplateDefinition,
} from "../contracts/types.ts";

const pattern = (
  definition: Omit<MaintenancePatternDefinition, "id" | "modelFamily" | "version" | "provenance"> & { id: MaintenancePatternId },
): MaintenancePatternDefinition => ({
  ...definition,
  modelFamily: definition.id,
  version: "2.0.0",
  provenance: "illustrative-maintenance-pattern",
});

/**
 * Mechanism-level classifications for recurrent maintenance. A pattern says
 * what must be restored and what kind of debt carries forward. It is not a
 * domain, a watchlist result, or a claim that two systems share calibration.
 */
export const maintenancePatterns: MaintenancePatternDefinition[] = [
  pattern({
    id: "regeneration-depletion",
    title: "Regeneration and depletion",
    summary: "A renewable stock is consumed and replenished while deficits can reduce future recovery.",
    stateArchetype: "Finite renewable stock with recurrent use, replenishment, accumulated deficit, and slow or partial recovery.",
    structuralAssumptions: ["A recoverable stock can be observed.", "Use and replenishment recur.", "Past deficits can influence future recovery."],
    learningQuestions: ["When does use outrun regeneration?", "Does early restraint preserve recovery?", "How much depletion debt remains after pressure falls?"],
    typicalDynamicTraits: ["delayed-feedback", "threshold-crossing", "hysteresis", "irreversible-loss", "multi-timescale"],
    baseDynamics: { kappa: 0.12, chi: 0.3, beta: 0.06, omegaPhi: 0.035 },
    rupturePolicy: { cumulativeLossThreshold: 0.55, debtThreshold: 1.05, persistenceSteps: 14 },
  }),
  pattern({
    id: "flow-backlog",
    title: "Flow and backlog",
    summary: "Demand moves through limited service stages while queues and unfinished work carry strain into later cycles.",
    stateArchetype: "Capacity-limited flow with arrivals, processing, handoffs, backlog, delayed service, and recovery after congestion.",
    structuralAssumptions: ["Demand and throughput can be distinguished.", "Unserved work carries forward.", "Congestion can degrade later correction capacity."],
    learningQuestions: ["When does backlog become self-reinforcing?", "Which bottleneck controls recovery?", "Can added throughput repay service debt safely?"],
    typicalDynamicTraits: ["capacity-saturation", "delayed-feedback", "phase-coupling", "multi-timescale"],
    baseDynamics: { kappa: 0.2, chi: 0.25, beta: 0.075, omegaPhi: 0.04 },
    rupturePolicy: { cumulativeLossThreshold: 0.56, debtThreshold: 1.08, persistenceSteps: 14 },
  }),
  pattern({
    id: "detection-correction",
    title: "Detection and correction",
    summary: "Outputs or claims are checked against constraints, then revised, contained, escalated, or rolled back.",
    stateArchetype: "Fast production cycle bounded by observation, verification, correction gates, escalation, and explicit rollback paths.",
    structuralAssumptions: ["Outputs can be checked against declared constraints.", "Errors can be revised or contained.", "Production pressure can scale faster than correction."],
    learningQuestions: ["Does verification keep pace with output?", "How does feedback fidelity change debt?", "Which failures require rollback or deferral?"],
    typicalDynamicTraits: ["delayed-feedback", "capacity-saturation", "phase-coupling", "irreversible-loss"],
    baseDynamics: { kappa: 0.22, chi: 0.18, omegaTheta: 0.12, omegaPhi: 0.055 },
    rupturePolicy: { cumulativeLossThreshold: 0.42, debtThreshold: 0.9, persistenceSteps: 10 },
  }),
  pattern({
    id: "maintenance-renewal",
    title: "Maintenance and renewal",
    summary: "Assets or skilled capacity deliver service while inspection, repair, replacement, and renewal prevent hidden deterioration.",
    stateArchetype: "Service capacity with wear, inspection lag, deferred-maintenance debt, repair, replacement, and long renewal cycles.",
    structuralAssumptions: ["Condition changes under repeated use.", "Inspection only partially reveals deterioration.", "Repair and renewal restore capacity at different rates."],
    learningQuestions: ["When does deferred maintenance narrow recovery?", "Which signals reveal hidden wear?", "How should repair and renewal be balanced?"],
    typicalDynamicTraits: ["delayed-feedback", "capacity-saturation", "threshold-crossing", "irreversible-loss", "multi-timescale"],
    baseDynamics: { kappa: 0.18, chi: 0.3, beta: 0.065, couplingA: 0.05, couplingB: 0.05 },
    rupturePolicy: { cumulativeLossThreshold: 0.48, debtThreshold: 1, persistenceSteps: 12 },
  }),
  pattern({
    id: "propagation-containment",
    title: "Propagation and containment",
    summary: "A harmful state spreads through a population or network while surveillance, isolation, and response attempt to contain it.",
    stateArchetype: "Distributed state with transmission or diffusion, detection lag, local reservoirs, network exposure, and containment capacity.",
    structuralAssumptions: ["The harmful state can propagate.", "Detection and containment operate with delay.", "Local failures can alter shared exposure."],
    learningQuestions: ["Does surveillance keep pace with propagation?", "Which intervention timing prevents lock-in?", "What reservoir carries risk forward?"],
    typicalDynamicTraits: ["network-propagation", "delayed-feedback", "threshold-crossing", "hysteresis", "phase-coupling"],
    baseDynamics: { kappa: 0.14, chi: 0.32, couplingA: 0.06, couplingB: 0.055 },
    rupturePolicy: { cumulativeLossThreshold: 0.5, debtThreshold: 1, persistenceSteps: 12 },
  }),
  pattern({
    id: "trust-redress",
    title: "Trust and redress",
    summary: "Cooperation depends on visible performance, fair procedure, meaningful appeals, and repair of unresolved grievance.",
    stateArchetype: "Relational capacity shaped by repeated service outcomes, feedback integrity, redress, historical debt, and public adaptation cycles.",
    structuralAssumptions: ["Trust changes through repeated observable interactions.", "Unresolved failures accumulate.", "Redress quality matters separately from output."],
    learningQuestions: ["Can redress rebuild cooperation?", "What happens when performance rises but appeals fail?", "How persistent is grievance debt?"],
    typicalDynamicTraits: ["delayed-feedback", "hysteresis", "phase-coupling", "multi-timescale"],
    baseDynamics: { kappa: 0.12, chi: 0.34, beta: 0.055, omegaPhi: 0.04 },
    rupturePolicy: { cumulativeLossThreshold: 0.58, debtThreshold: 1.1, persistenceSteps: 14 },
  }),
  pattern({
    id: "reserves-solvency",
    title: "Reserves and solvency",
    summary: "Commitments come due across cycles while liquidity, transparent risk, buffers, and restructuring preserve the ability to meet them.",
    stateArchetype: "Balance system with mismatched claims and resources, correlated exposure, maturity pressure, buffers, and path-dependent recovery.",
    structuralAssumptions: ["Claims and resources can become temporally mismatched.", "Concentrated exposure amplifies shocks.", "Buffers and restructuring alter recoverability."],
    learningQuestions: ["When do obligations outrun available reserves?", "How do opacity and correlated exposure interact?", "Which buffers preserve recovery time?"],
    typicalDynamicTraits: ["capacity-saturation", "threshold-crossing", "hysteresis", "irreversible-loss", "multi-timescale"],
    baseDynamics: { kappa: 0.15, chi: 0.34, beta: 0.065, omegaPhi: 0.045 },
    rupturePolicy: { cumulativeLossThreshold: 0.5, debtThreshold: 1, persistenceSteps: 12 },
  }),
];

/** v1 compatibility export; prefer maintenancePatterns in new integrations. */
export const systemTemplates: SystemTemplateDefinition[] = maintenancePatterns;

export const maintenancePatternById = Object.fromEntries(
  maintenancePatterns.map((item) => [item.id, item]),
) as Record<MaintenancePatternId, MaintenancePatternDefinition>;

/** v1 compatibility export; prefer maintenancePatternById. */
export const systemTemplateById = maintenancePatternById;
