import type { ModelFamily, SystemTemplateDefinition } from "../contracts/types.ts";

const template = (
  definition: Omit<SystemTemplateDefinition, "id" | "modelFamily" | "version" | "provenance"> & { id: ModelFamily },
): SystemTemplateDefinition => ({
  ...definition,
  modelFamily: definition.id,
  version: "1.0.0",
  provenance: "illustrative-system-template",
});

/**
 * Reusable structural templates. Concrete bounded systems provide the domain
 * boundary and real-world meanings; these templates provide only the shared
 * synthetic dynamics and questions to investigate.
 */
export const systemTemplates: SystemTemplateDefinition[] = [
  template({
    id: "regenerative-stock",
    title: "Regenerative stock",
    summary: "A renewable stock is drawn down and replenished through recurrent operating and environmental cycles.",
    stateArchetype: "Finite stock with replenishment, extraction pressure, accumulated deficit, and slow or partial recovery.",
    structuralAssumptions: ["A recoverable stock can be observed.", "Extraction and replenishment recur.", "Past deficits influence future recovery."],
    learningQuestions: ["When does use outrun replenishment?", "Does early correction preserve the stock?", "How much debt remains after pressure falls?"],
    baseDynamics: { kappa: 0.12, chi: 0.3, beta: 0.06, omegaPhi: 0.035 },
    rupturePolicy: { cumulativeLossThreshold: 0.55, debtThreshold: 1.05, persistenceSteps: 14 },
  }),
  template({
    id: "threshold-regime-shift",
    title: "Threshold and regime shift",
    summary: "A system can absorb disturbance until reinforcing feedbacks move it toward a qualitatively different regime.",
    stateArchetype: "Metastable regime with nonlinear thresholds, coupled phases, hysteresis, and difficult restoration.",
    structuralAssumptions: ["A meaningful regime boundary exists.", "Crossing risk increases with accumulated pressure.", "Restoration can be slower than degradation."],
    learningQuestions: ["Which signals warn before the threshold?", "How does debt narrow recoverability?", "When is restoration too late?"],
    baseDynamics: { kappa: 0.08, chi: 0.4, beta: 0.04, couplingA: 0.055, couplingB: 0.045 },
    rupturePolicy: { cumulativeLossThreshold: 0.48, debtThreshold: 1, persistenceSteps: 12 },
  }),
  template({
    id: "resistance-contagion",
    title: "Resistance and contagion",
    summary: "Selection, transmission, or diffusion amplifies a resistant state while surveillance and containment attempt correction.",
    stateArchetype: "Distributed population state with selection pressure, propagation, detection lag, and containment capacity.",
    structuralAssumptions: ["The resistant or harmful state can propagate.", "Detection and correction operate with delay.", "Local failures can alter network conditions."],
    learningQuestions: ["Does surveillance keep pace with propagation?", "Which correction timing prevents lock-in?", "What hidden reservoir carries debt forward?"],
    baseDynamics: { kappa: 0.14, chi: 0.32, couplingA: 0.06, couplingB: 0.055 },
    rupturePolicy: { cumulativeLossThreshold: 0.5, debtThreshold: 1, persistenceSteps: 12 },
  }),
  template({
    id: "trust-legitimacy",
    title: "Trust and legitimacy",
    summary: "Cooperation depends on visible performance, fair correction, and repayment of unresolved grievance or credibility debt.",
    stateArchetype: "Relational stock shaped by service outcomes, feedback integrity, redress, historical debt, and repeated public cycles.",
    structuralAssumptions: ["Trust changes through repeated observable interactions.", "Unresolved failures accumulate.", "Correction quality matters separately from output."],
    learningQuestions: ["Can correction rebuild cooperation?", "What happens when performance rises but redress fails?", "How persistent is grievance debt?"],
    baseDynamics: { kappa: 0.12, chi: 0.34, beta: 0.055, omegaPhi: 0.04 },
    rupturePolicy: { cumulativeLossThreshold: 0.58, debtThreshold: 1.1, persistenceSteps: 14 },
  }),
  template({
    id: "capability-correction",
    title: "Capability and correction",
    summary: "Fast task capability is bounded by grounding, verification, correction, escalation, and rollback capacity.",
    stateArchetype: "Optimizing service with rapid local cycles, changing deployment conditions, explicit verifier feedback, and correction gates.",
    structuralAssumptions: ["Outputs can be checked against constraints.", "Errors can be revised or contained.", "Optimization pressure can scale faster than correction."],
    learningQuestions: ["Does correction scale with capability?", "How does feedback fidelity change debt?", "Which failures require refusal, rollback, or deferral?"],
    baseDynamics: { kappa: 0.22, chi: 0.18, omegaTheta: 0.12, omegaPhi: 0.055 },
    rupturePolicy: { cumulativeLossThreshold: 0.42, debtThreshold: 0.9, persistenceSteps: 10 },
  }),
  template({
    id: "network-cascade",
    title: "Network cascade",
    summary: "Interdependent nodes share service, load, and failure risk; local degradation can cascade through the network.",
    stateArchetype: "Coupled service network with capacity limits, telemetry, redundancy, repair, and cascading failure paths.",
    structuralAssumptions: ["Nodes are operationally interdependent.", "Load or failure can propagate.", "Isolation, redundancy, or repair can interrupt cascades."],
    learningQuestions: ["Which feedback prevents a cascade?", "How much redundancy buys recovery time?", "Does deferred maintenance amplify shocks?"],
    baseDynamics: { kappa: 0.18, chi: 0.3, couplingA: 0.05, couplingB: 0.05 },
    rupturePolicy: { cumulativeLossThreshold: 0.45, debtThreshold: 0.95, persistenceSteps: 10 },
  }),
  template({
    id: "financial-leverage",
    title: "Leverage and refinancing",
    summary: "Commitments amplify gains and losses while liquidity, transparency, buffers, and restructuring preserve recoverability.",
    stateArchetype: "Leveraged balance system with maturity cycles, correlated exposure, refinancing pressure, buffers, and path dependence.",
    structuralAssumptions: ["Claims and resources can become temporally mismatched.", "Leverage amplifies shocks.", "Buffers and restructuring alter recoverability."],
    learningQuestions: ["When does refinancing pressure dominate correction?", "How do opacity and correlated exposure interact?", "Which buffers reduce terminal risk?"],
    baseDynamics: { kappa: 0.15, chi: 0.34, beta: 0.065, omegaPhi: 0.045 },
    rupturePolicy: { cumulativeLossThreshold: 0.5, debtThreshold: 1, persistenceSteps: 12 },
  }),
  template({
    id: "human-capacity",
    title: "Human capacity and recovery",
    summary: "Finite human attention, health, skill, or service capacity is consumed under demand and restored through support and recovery.",
    stateArchetype: "Finite adaptive capacity with workload, delayed human feedback, backlog, recovery, and subgroup viability floors.",
    structuralAssumptions: ["Human capacity is finite and recoverable only within limits.", "Backlog and stress carry forward.", "Population floors matter before averages."],
    learningQuestions: ["When does demand become unsustainable?", "Can rest and support repay accumulated debt?", "Which averages hide subgroup failure?"],
    baseDynamics: { kappa: 0.2, chi: 0.25, beta: 0.075, omegaPhi: 0.04 },
    rupturePolicy: { cumulativeLossThreshold: 0.6, debtThreshold: 1.15, persistenceSteps: 15 },
  }),
];

export const systemTemplateById = Object.fromEntries(
  systemTemplates.map((item) => [item.id, item]),
) as Record<ModelFamily, SystemTemplateDefinition>;

