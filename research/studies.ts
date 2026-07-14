import {
  analyzePhaseOccupancy,
  defaultParameters,
  rupturePolicyFor,
  seededRandom,
  simulate,
  simulateCoupledTori,
  type CoupledToriResult,
  type SimulationParameters,
} from "../engine/simulator.ts";

export type ResearchModuleId =
  | "paper"
  | "topology"
  | "hysteresis"
  | "coupled"
  | "navigation"
  | "telemetry";

export const researchModules = [
  { id: "paper", icon: "▤", title: "Archived Companion Reproduction", subtitle: "Legacy protocol and archived fixtures", asset: "/research/core/figures_contact_sheet.png" },
  { id: "topology", icon: "◎", title: "Topology & Phase", subtitle: "Occupancy, winding, Poincare, spectrum", asset: "/research/core/fig_25_topology_betti_summary.png" },
  { id: "hysteresis", icon: "↝", title: "Hysteresis", subtitle: "Prevention versus recovery threshold", asset: "/research/core/fig_12_hysteresis_recovery_threshold.png" },
  { id: "coupled", icon: "⛓", title: "Coupled Tori", subtitle: "Coordination and collective risk", asset: "/research/core/fig_26_coupled_network_order_vs_risk.png" },
  { id: "navigation", icon: "⌁", title: "Navigation & Early Warning", subtitle: "Lead time, observation, OOD and policy", asset: "/research/navigation/figures_contact_sheet.png" },
  { id: "telemetry", icon: "⇧", title: "Telemetry Import", subtitle: "Estimate external phase from observations", asset: "/research/phi/figures/phase_identifiability_gate.png" },
] as const satisfies readonly { id: ResearchModuleId; icon: string; title: string; subtitle: string; asset: string }[];

export const archivedResearchFindings = {
  topology: {
    quasiperiodicBetti: [1, 2, 1] as const,
    periodicBetti: [1, 1, 0] as const,
    provenance: "Archived toroidal_lab_results.zip cubical phase-grid homology",
  },
  phase: {
    phasePlaneMeanCircularError: 0.185,
    recurrentGateQuality: 0.4578,
    provenance: "Archived toroidal_phi_revision_lab.zip synthetic revision tests",
  },
  navigation: {
    scalarRocAuc: 0.968,
    dynamicRocAuc: 0.986,
    fullTelemetryRocAuc: 0.991,
    scalarBrier: 0.083,
    dynamicBrier: 0.037,
    fullTelemetryBrier: 0.037,
    radialWarningLeadSteps: 18.5,
    lowAlignmentLeadSteps: 8,
    provenance: "Archived toroidal_navigation_lab.zip; 260 synthetic base episodes and six OOD families",
  },
} as const;

export type HysteresisStudyResult = {
  divergence: number;
  preventionCorrection: number;
  rows: { duration: number; minimumRecoveryCorrection?: number; hysteresisGap?: number }[];
  provenance: "live-synthetic-rerun";
};

export function runHysteresisStudy(seed = 420): HysteresisStudyResult {
  const divergence = 1 * 0.3 * (1 - 0.65) + 0.02 + 0.02;
  const preventionCorrection = divergence + 0.025;
  const durations = [20, 60, 100, 140, 180, 220];
  const candidates = Array.from({ length: 12 }, (_, index) => divergence - 0.02 + index * (0.24 / 11));
  const rows = durations.map((duration) => {
    let minimumRecoveryCorrection: number | undefined;
    for (const correction of candidates) {
      const steps = 90 + duration + 260;
      const parameters: SimulationParameters = {
        ...defaultParameters,
        pressure: 1,
        error: 0.3,
        feedback: 0.65,
        irreversibleLoss: 0.02,
        drift: 0.02,
        correction: preventionCorrection,
        kappa: 0.055,
        rho0: 0.22,
        rhoCrit: 1.2,
        chi: 0.025,
        alpha: 0.08,
        beta: 0.045,
        initialDebt: 0,
        steps,
        dt: 1,
        seed: seed + duration,
      };
      const result = simulate(parameters, [
        { id: "stress", label: "Stress interval", step: 90, cost: 0, effects: { correction: divergence - 0.055 } },
        { id: "recovery", label: "Recovery correction", step: 90 + duration, cost: 0, effects: { correction } },
      ], { rupturePolicy: rupturePolicyFor(parameters, { cumulativeLossThreshold: 10, debtThreshold: 10 }) });
      const tail = result.frames.slice(-100);
      const meanRho = tail.reduce((sum, frame) => sum + frame.rho, 0) / tail.length;
      const meanDebt = tail.reduce((sum, frame) => sum + frame.debt, 0) / tail.length;
      if (meanRho < parameters.rhoCrit * 0.65 && meanDebt < 0.25) {
        minimumRecoveryCorrection = correction;
        break;
      }
    }
    return {
      duration,
      minimumRecoveryCorrection,
      hysteresisGap: minimumRecoveryCorrection === undefined ? undefined : minimumRecoveryCorrection - preventionCorrection,
    };
  });
  return { divergence, preventionCorrection, rows, provenance: "live-synthetic-rerun" };
}

export function runCoupledToriSweep(seed = 84): CoupledToriResult[] {
  return [0, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2].map((coupling) => simulateCoupledTori(coupling, seed));
}

export type NavigationStudyResult = {
  episodes: number;
  radialWarningMeanLead: number;
  alignmentWarningMeanLead: number;
  radialWarningAdvantage: number;
  detectedBoundaryCrossings: number;
  provenance: "live-synthetic-rerun";
  limitation: string;
};

export function runNavigationStudy(seed = 920, episodes = 24): NavigationStudyResult {
  const random = seededRandom(seed);
  const radialLeads: number[] = [];
  const alignmentLeads: number[] = [];
  let detectedBoundaryCrossings = 0;
  for (let episode = 0; episode < episodes; episode += 1) {
    const shockStep = 90 + Math.floor(random() * 50);
    const parameters: SimulationParameters = {
      ...defaultParameters,
      steps: 520,
      seed: seed + episode,
      pressure: 1.15 + random() * 0.45,
      error: 0.25 + random() * 0.2,
      feedback: 0.55 + random() * 0.2,
      correction: 0.48 + random() * 0.2,
      initialDebt: random() * 0.45,
    };
    const result = simulate(parameters, [{
      id: "distribution-shift",
      label: "Distribution shift",
      step: shockStep,
      cost: 0,
      effects: {
        pressure: Math.min(3, parameters.pressure + 0.85 + random() * 0.55),
        feedback: Math.max(0, parameters.feedback - 0.25 - random() * 0.18),
        drift: 0.12 + random() * 0.16,
      },
    }]);
    const crossing = result.summary.boundaryCrossingStep;
    if (crossing === undefined) continue;
    detectedBoundaryCrossings += 1;
    const radialWarning = result.frames.findIndex((frame) => frame.step >= shockStep && (frame.radialVelocity > 0.04 || frame.debtAdjustedMargin < 0));
    const alignmentWarning = result.frames.findIndex((frame) => frame.step >= shockStep && frame.alignment < 0.7);
    if (radialWarning >= 0 && radialWarning < crossing) radialLeads.push(crossing - radialWarning);
    if (alignmentWarning >= 0 && alignmentWarning < crossing) alignmentLeads.push(crossing - alignmentWarning);
  }
  const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const radialWarningMeanLead = mean(radialLeads);
  const alignmentWarningMeanLead = mean(alignmentLeads);
  return {
    episodes,
    radialWarningMeanLead,
    alignmentWarningMeanLead,
    radialWarningAdvantage: radialWarningMeanLead - alignmentWarningMeanLead,
    detectedBoundaryCrossings,
    provenance: "live-synthetic-rerun",
    limitation: "This compact live rerun demonstrates the warning logic only. ROC/Brier, OOD, ablation, observer, policy, and change-point results remain archived-study evidence.",
  };
}

export function topologyForCurrentRun(frames: Parameters<typeof analyzePhaseOccupancy>[0]) {
  return analyzePhaseOccupancy(frames, 32);
}
