export type SimulationStatus =
  | "Stable"
  | "Warning"
  | "Fragile"
  | "Drifting"
  | "Expanding"
  | "Recovering"
  | "Debt accumulating"
  | "Phase locked"
  | "Phase not identifiable"
  | "Rupture approaching"
  | "Ruptured";

export type SimulationParameters = {
  pressure: number;
  error: number;
  feedback: number;
  correction: number;
  drift: number;
  irreversibleLoss: number;
  initialDebt: number;
  kappa: number;
  chi: number;
  omegaTheta: number;
  omegaPhi: number;
  couplingA: number;
  couplingB: number;
  rho0: number;
  rhoCrit: number;
  alpha: number;
  beta: number;
  seed: number;
  steps: number;
  dt: number;
};

export type SimulationFrame = {
  step: number;
  time: number;
  theta: number;
  phi: number;
  rho: number;
  debt: number;
  alignment: number;
  divergence: number;
  correction: number;
  correctionMargin: number;
  irreversibleLoss: number;
  radialVelocity: number;
  debtVelocity: number;
  status: SimulationStatus;
};

export type ScheduledIntervention = {
  id: string;
  label: string;
  step: number;
  effects: Partial<SimulationParameters>;
  cost: number;
};

export type SimulationSummary = {
  stableFraction: number;
  maxRho: number;
  finalAlignment: number;
  finalDebt: number;
  firstWarningStep?: number;
  ruptureStep?: number;
  recovered: boolean;
  recoveryTime?: number;
  interventionCost: number;
  windingRatio: number;
};

export const MODEL_VERSION = "torus-1.0.0";

export const defaultParameters: SimulationParameters = {
  pressure: 1.65,
  error: 0.32,
  feedback: 0.62,
  correction: 0.46,
  drift: 0.04,
  irreversibleLoss: 0.02,
  initialDebt: 0.18,
  kappa: 0.26,
  chi: 0.08,
  omegaTheta: 0.09,
  omegaPhi: 0.055,
  couplingA: 0.03,
  couplingB: 0.02,
  rho0: 0.35,
  rhoCrit: 2.5,
  alpha: 0.16,
  beta: 0.1,
  seed: 4217,
  steps: 720,
  dt: 0.25,
};

const TAU = Math.PI * 2;

export function wrapAngle(value: number) {
  return ((value % TAU) + TAU) % TAU;
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function classifyStatus(
  rho: number,
  debt: number,
  correctionMargin: number,
  radialVelocity: number,
  debtVelocity: number,
  rhoCrit: number,
  theta: number,
  phi: number,
  omegaTheta: number,
  omegaPhi: number,
): SimulationStatus {
  if (rho >= rhoCrit) return "Ruptured";
  if (rho >= rhoCrit * 0.84) return "Rupture approaching";
  if (Math.abs(omegaTheta) + Math.abs(omegaPhi) < 0.015)
    return "Phase not identifiable";
  if (radialVelocity < -0.035 && (rho > rhoCrit * 0.34 || debt > 0.3))
    return "Recovering";
  if (radialVelocity > 0.055) return "Expanding";
  if (debtVelocity > 0.012 && debt > 0.28) return "Debt accumulating";
  if (Math.abs(wrapAngle(theta - 2 * phi)) < 0.055 && rho < rhoCrit * 0.5)
    return "Phase locked";
  if (correctionMargin < -0.025) return "Drifting";
  if (rho > rhoCrit * 0.5 || correctionMargin < 0.045) return "Fragile";
  if (rho > rhoCrit * 0.34 || debt > 0.55) return "Warning";
  return "Stable";
}

export function simulate(
  base: SimulationParameters,
  interventions: ScheduledIntervention[] = [],
): { frames: SimulationFrame[]; summary: SimulationSummary } {
  const params = { ...base };
  const random = seededRandom(params.seed);
  const steps = Math.max(1, Math.min(10000, Math.round(params.steps)));
  const events = [...interventions].sort((a, b) => a.step - b.step);
  let eventIndex = 0;
  let theta = 0.7;
  let phi = 0.22;
  let rho = params.rho0;
  let debt = Math.max(0, params.initialDebt);
  const frames: SimulationFrame[] = [];

  for (let step = 0; step < steps; step += 1) {
    while (eventIndex < events.length && events[eventIndex].step === step) {
      Object.assign(params, events[eventIndex].effects);
      eventIndex += 1;
    }

    const noiseTheta = (random() - 0.5) * 0.012;
    const noisePhi = (random() - 0.5) * 0.01;
    const noiseRho = (random() - 0.5) * 0.012;
    const divergence =
      params.pressure * params.error * (1 - params.feedback) +
      params.irreversibleLoss +
      params.drift;
    const correction = params.correction;
    const correctionMargin = correction - divergence;
    const debtVelocity =
      params.alpha * Math.max(divergence - correction, 0) -
      params.beta * Math.max(correction - divergence, 0) +
      params.irreversibleLoss * 0.018;
    debt = Math.max(0, debt + debtVelocity * params.dt);
    const radialVelocity =
      -params.kappa * (rho - params.rho0) +
      divergence -
      correction +
      params.chi * debt +
      noiseRho;
    rho = Math.max(0.03, rho + radialVelocity * params.dt);
    theta = wrapAngle(
      theta +
        (params.omegaTheta + params.couplingA * Math.sin(phi) + noiseTheta) *
          params.dt,
    );
    phi = wrapAngle(
      phi +
        (params.omegaPhi + params.couplingB * Math.sin(theta) + noisePhi) *
          params.dt,
    );
    const alignment = Math.exp(-rho);
    const status = classifyStatus(
      rho,
      debt,
      correctionMargin,
      radialVelocity,
      debtVelocity,
      params.rhoCrit,
      theta,
      phi,
      params.omegaTheta,
      params.omegaPhi,
    );
    frames.push({
      step,
      time: step * params.dt,
      theta,
      phi,
      rho,
      debt,
      alignment,
      divergence,
      correction,
      correctionMargin,
      irreversibleLoss: params.irreversibleLoss,
      radialVelocity,
      debtVelocity,
      status,
    });
  }

  const warningIndex = frames.findIndex(
    (frame) => !["Stable", "Phase locked"].includes(frame.status),
  );
  const ruptureIndex = frames.findIndex((frame) => frame.status === "Ruptured");
  const stableCount = frames.filter((frame) =>
    ["Stable", "Phase locked"].includes(frame.status),
  ).length;
  const final = frames[frames.length - 1];
  const thetaTurns = (frames.at(-1)!.theta - frames[0].theta + TAU) % TAU;
  const phiTurns = (frames.at(-1)!.phi - frames[0].phi + TAU) % TAU;
  const recoveryIndex =
    ruptureIndex < 0
      ? frames.findIndex(
          (frame, index) => index > warningIndex && frame.status === "Recovering",
        )
      : -1;

  return {
    frames,
    summary: {
      stableFraction: stableCount / frames.length,
      maxRho: Math.max(...frames.map((frame) => frame.rho)),
      finalAlignment: final.alignment,
      finalDebt: final.debt,
      firstWarningStep: warningIndex >= 0 ? warningIndex : undefined,
      ruptureStep: ruptureIndex >= 0 ? ruptureIndex : undefined,
      recovered: recoveryIndex >= 0 && ruptureIndex < 0,
      recoveryTime:
        recoveryIndex >= 0 ? frames[recoveryIndex].time - frames[warningIndex].time : undefined,
      interventionCost: interventions.reduce((sum, event) => sum + event.cost, 0),
      windingRatio: phiTurns > 0.001 ? thetaTurns / phiTurns : 0,
    },
  };
}

export function deterministicExplanation(
  frames: SimulationFrame[],
  summary: SimulationSummary,
) {
  const final = frames.at(-1)!;
  const pressureStory =
    final.correctionMargin < 0
      ? "Divergence pressure exceeded correction capacity"
      : "Correction capacity remained above divergence pressure";
  const debtStory =
    summary.finalDebt > frames[0].debt + 0.08
      ? "Alignment debt accumulated and pushed the equilibrium radius outward"
      : "Debt remained contained or was repaid";
  const outcome = summary.ruptureStep
    ? `The viable boundary was crossed at step ${summary.ruptureStep}.`
    : summary.recovered
      ? "The system re-entered a contracting regime before rupture."
      : "The system finished inside the modeled viable tube.";
  return `${pressureStory}. ${debtStory}. ${outcome}`;
}
