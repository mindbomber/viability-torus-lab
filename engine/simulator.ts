export type SimulationStatus =
  | "Stable"
  | "Warning"
  | "Fragile"
  | "Drifting"
  | "Expanding"
  | "Recovering"
  | "Debt accumulating"
  | "Rupture approaching"
  | "Ruptured";

export type PhaseRegime =
  | "Recurrent winding"
  | "Phase locked"
  | "Not identifiable";

export type PhaseDiagnosticReason =
  | "identified"
  | "insufficient-cycles"
  | "low-amplitude"
  | "low-spectral-concentration"
  | "undersampled";

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
  thetaUnwrapped: number;
  phiUnwrapped: number;
  rho: number;
  debt: number;
  alignment: number;
  divergence: number;
  correction: number;
  correctionMargin: number;
  irreversibleLoss: number;
  radialVelocity: number;
  debtVelocity: number;
  externalMismatch: number;
  estimatedPhi?: number;
  phaseIdentifiable: boolean;
  phaseConfidence: number;
  phaseRegime: PhaseRegime;
  status: SimulationStatus;
};

export type ScheduledIntervention = {
  id: string;
  label: string;
  step: number;
  effects: Partial<SimulationParameters>;
  cost: number;
};

export type PhaseDiagnostics = {
  identifiable: boolean;
  reason: PhaseDiagnosticReason;
  regime: PhaseRegime;
  spectralConcentration: number;
  amplitude: number;
  observedMajorCycles: number;
  estimatedMajorCycles: number;
  dominantAngularFrequency: number;
  phaseLockingValue: number;
  phaseLockingRatio?: string;
};

export type SimulationSummary = {
  stableFraction: number;
  maxRho: number;
  finalAlignment: number;
  finalDebt: number;
  finalStatus: SimulationStatus;
  firstWarningStep?: number;
  ruptureStep?: number;
  recovered: boolean;
  recoveryTime?: number;
  interventionCost: number;
  windingRatio: number;
  phase: PhaseDiagnostics;
};

export const MODEL_VERSION = "torus-1.1.0";
export const MAX_INTERNAL_DT = 0.25;
export const MIN_RHO = 0.03;

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
  steps: 960,
  dt: 0.25,
};

const TAU = Math.PI * 2;
const PHASE_AMPLITUDE_FLOOR = 0.02;
const PHASE_SPECTRAL_FLOOR = 0.2;
const PHASE_MIN_CYCLES = 2;
const PHASE_LOCKING_FLOOR = 0.985;

export function wrapAngle(value: number) {
  return ((value % TAU) + TAU) % TAU;
}

export function circularDistance(a: number, b: number) {
  const distance = wrapAngle(a - b);
  return Math.min(distance, TAU - distance);
}

export function integrationSubstepsPerStep(dt: number) {
  return Math.max(1, Math.ceil(dt / MAX_INTERNAL_DT));
}

function greatestCommonDivisor(a: number, b: number) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) [left, right] = [right, left % right];
  return left;
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
): SimulationStatus {
  if (rho >= rhoCrit) return "Ruptured";
  if (rho >= rhoCrit * 0.84) return "Rupture approaching";
  if (radialVelocity < -0.035 && (rho > rhoCrit * 0.34 || debt > 0.3))
    return "Recovering";
  if (radialVelocity > 0.055) return "Expanding";
  if (debtVelocity > 0.012 && debt > 0.28) return "Debt accumulating";
  if (correctionMargin < -0.025) return "Drifting";
  if (rho > rhoCrit * 0.5 || correctionMargin < 0.045) return "Fragile";
  if (rho > rhoCrit * 0.34 || debt > 0.55) return "Warning";
  return "Stable";
}

function syntheticExternalMismatch(phi: number) {
  return 0.5 + 0.28 * Math.cos(phi) + 0.04 * Math.cos(2 * phi);
}

function sampledIndices(length: number, maxSamples: number) {
  if (length <= maxSamples) return Array.from({ length }, (_, index) => index);
  const stride = Math.ceil((length - 1) / (maxSamples - 1));
  const indices = Array.from(
    { length: Math.floor((length - 1) / stride) + 1 },
    (_, index) => index * stride,
  );
  if (indices.at(-1) !== length - 1) indices.push(length - 1);
  return indices;
}

export function analyzePhaseDynamics(frames: SimulationFrame[]): PhaseDiagnostics {
  if (frames.length < 8) {
    return {
      identifiable: false,
      reason: "insufficient-cycles",
      regime: "Not identifiable",
      spectralConcentration: 0,
      amplitude: 0,
      observedMajorCycles: 0,
      estimatedMajorCycles: 0,
      dominantAngularFrequency: 0,
      phaseLockingValue: 0,
    };
  }

  const indices = sampledIndices(frames.length, 512);
  const values = indices.map((index) => frames[index].externalMismatch);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const centered = values.map((value) => value - mean);
  const amplitude = Math.sqrt(
    centered.reduce((sum, value) => sum + value * value, 0) /
      centered.length,
  );
  let totalPower = 0;
  let dominantPower = 0;
  let dominantBin = 0;
  for (let bin = 1; bin <= Math.floor(centered.length / 2); bin += 1) {
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < centered.length; index += 1) {
      const angle = (TAU * bin * index) / centered.length;
      real += centered[index] * Math.cos(angle);
      imaginary -= centered[index] * Math.sin(angle);
    }
    const power = real * real + imaginary * imaginary;
    totalPower += power;
    if (power > dominantPower) {
      dominantPower = power;
      dominantBin = bin;
    }
  }

  const spectralConcentration =
    totalPower > 0 ? dominantPower / totalPower : 0;
  const first = frames[0];
  const last = frames.at(-1)!;
  const duration = Math.max(last.time - first.time, Number.EPSILON);
  const observedMajorCycles =
    Math.abs(last.phiUnwrapped - first.phiUnwrapped) / TAU;
  const estimatedMajorCycles = dominantBin;
  const dominantAngularFrequency =
    dominantBin > 0 ? (TAU * dominantBin) / duration : 0;
  let maxObservedPhaseStep = 0;
  for (let index = 0; index < frames.length; index += 1) {
    if (index > 0) {
      maxObservedPhaseStep = Math.max(
        maxObservedPhaseStep,
        Math.abs(frames[index].phiUnwrapped - frames[index - 1].phiUnwrapped),
      );
    }
  }
  let phaseLockingValue = 0;
  let phaseLockingRatio: string | undefined;
  for (let numerator = -4; numerator <= 4; numerator += 1) {
    if (numerator === 0) continue;
    for (let denominator = 1; denominator <= 4; denominator += 1) {
      if (greatestCommonDivisor(numerator, denominator) !== 1) continue;
      let lockReal = 0;
      let lockImaginary = 0;
      for (const frame of frames) {
        const residual =
          denominator * frame.thetaUnwrapped -
          numerator * frame.phiUnwrapped;
        lockReal += Math.cos(residual);
        lockImaginary += Math.sin(residual);
      }
      const candidate = Math.hypot(lockReal, lockImaginary) / frames.length;
      if (candidate > phaseLockingValue) {
        phaseLockingValue = candidate;
        phaseLockingRatio = `${numerator}:${denominator}`;
      }
    }
  }

  let reason: PhaseDiagnosticReason = "identified";
  if (maxObservedPhaseStep >= Math.PI / 2) reason = "undersampled";
  else if (amplitude < PHASE_AMPLITUDE_FLOOR) reason = "low-amplitude";
  else if (estimatedMajorCycles < PHASE_MIN_CYCLES)
    reason = "insufficient-cycles";
  else if (spectralConcentration < PHASE_SPECTRAL_FLOOR)
    reason = "low-spectral-concentration";
  const identifiable = reason === "identified";
  const regime: PhaseRegime = !identifiable
    ? "Not identifiable"
    : phaseLockingValue >= PHASE_LOCKING_FLOOR
      ? "Phase locked"
      : "Recurrent winding";

  return {
    identifiable,
    reason,
    regime,
    spectralConcentration,
    amplitude,
    observedMajorCycles,
    estimatedMajorCycles,
    dominantAngularFrequency,
    phaseLockingValue,
    phaseLockingRatio,
  };
}

function annotatePhaseEstimates(
  frames: SimulationFrame[],
  diagnostics: PhaseDiagnostics,
) {
  const meanMismatch =
    frames.reduce((sum, frame) => sum + frame.externalMismatch, 0) /
    frames.length;
  const tau =
    diagnostics.dominantAngularFrequency > 0
      ? 1 / diagnostics.dominantAngularFrequency
      : 0;
  frames.forEach((frame, index) => {
    let derivative = 0;
    if (frames.length <= 1) {
      derivative = 0;
    } else if (index === 0) {
      derivative =
        (frames[1].externalMismatch - frame.externalMismatch) /
        Math.max(frames[1].time - frame.time, Number.EPSILON);
    } else if (index === frames.length - 1) {
      derivative =
        (frame.externalMismatch - frames[index - 1].externalMismatch) /
        Math.max(frame.time - frames[index - 1].time, Number.EPSILON);
    } else if (index > 0) {
      derivative =
        (frames[index + 1].externalMismatch -
          frames[index - 1].externalMismatch) /
        Math.max(
          frames[index + 1].time - frames[index - 1].time,
          Number.EPSILON,
        );
    }
    frame.estimatedPhi = diagnostics.identifiable
      ? wrapAngle(
          Math.atan2(
            -tau * derivative,
            frame.externalMismatch - meanMismatch,
          ),
        )
      : undefined;
    frame.phaseIdentifiable = diagnostics.identifiable;
    frame.phaseConfidence = diagnostics.spectralConcentration;
    frame.phaseRegime = diagnostics.regime;
  });
}

export function simulate(
  base: SimulationParameters,
  interventions: ScheduledIntervention[] = [],
): { frames: SimulationFrame[]; summary: SimulationSummary } {
  const params = { ...base };
  if (params.rho0 >= params.rhoCrit) {
    throw new RangeError("rho0 must remain below rhoCrit.");
  }
  const random = seededRandom(params.seed);
  const steps = Math.max(1, Math.min(10000, Math.round(params.steps)));
  const events = [...interventions].sort((a, b) => a.step - b.step);
  let eventIndex = 0;
  let theta = 0.7;
  let phi = 0.22;
  let thetaUnwrapped = theta;
  let phiUnwrapped = phi;
  let rho = params.rho0;
  let debt = Math.max(0, params.initialDebt);
  const frames: SimulationFrame[] = [];
  let maximumRho = rho;
  let ruptureStep: number | undefined;

  for (let step = 0; step < steps; step += 1) {
    while (eventIndex < events.length && events[eventIndex].step === step) {
      Object.assign(params, events[eventIndex].effects);
      eventIndex += 1;
    }
    if (params.rho0 >= params.rhoCrit) {
      throw new RangeError(
        `Intervention at step ${step} made rho0 greater than or equal to rhoCrit.`,
      );
    }

    const divergence =
      params.pressure * params.error * (1 - params.feedback) +
      params.irreversibleLoss +
      params.drift;
    const correction = params.correction;
    const correctionMargin = correction - divergence;
    let radialVelocity = 0;
    let debtVelocity = 0;

    if (step > 0) {
      const startRho = rho;
      const startDebt = debt;
      const substeps = integrationSubstepsPerStep(params.dt);
      const internalDt = params.dt / substeps;
      const noiseScale = Math.sqrt(internalDt * MAX_INTERNAL_DT);
      for (let substep = 0; substep < substeps; substep += 1) {
        const priorDebt = debt;
        const alignmentBeforeCorrection = Math.exp(-rho);
        const debtRate =
          params.alpha * Math.max(divergence - correction, 0) -
          params.beta *
            Math.max(correction - divergence, 0) *
            alignmentBeforeCorrection;
        debt = Math.max(0, debt + debtRate * internalDt);

        const priorTheta = theta;
        const priorPhi = phi;
        const thetaIncrement =
          (params.omegaTheta + params.couplingA * Math.sin(priorPhi)) *
            internalDt +
          (random() - 0.5) * 0.012 * noiseScale;
        const phiIncrement =
          (params.omegaPhi + params.couplingB * Math.sin(priorTheta)) * internalDt +
          (random() - 0.5) * 0.01 * noiseScale;
        thetaUnwrapped += thetaIncrement;
        phiUnwrapped += phiIncrement;
        theta = wrapAngle(thetaUnwrapped);
        phi = wrapAngle(phiUnwrapped);

        const radialRate =
          -params.kappa * (rho - params.rho0) +
          divergence -
          correction +
          params.chi * priorDebt;
        rho = Math.max(
          MIN_RHO,
          rho +
            radialRate * internalDt +
            (random() - 0.5) * 0.012 * noiseScale,
        );
        maximumRho = Math.max(maximumRho, rho);
        if (ruptureStep === undefined && rho >= params.rhoCrit)
          ruptureStep = step;
      }
      radialVelocity = (rho - startRho) / params.dt;
      debtVelocity = (debt - startDebt) / params.dt;
    } else if (rho >= params.rhoCrit) {
      ruptureStep = 0;
    }

    const alignment = Math.exp(-rho);
    const status = classifyStatus(
      rho,
      debt,
      correctionMargin,
      radialVelocity,
      debtVelocity,
      params.rhoCrit,
    );
    frames.push({
      step,
      time: step * params.dt,
      theta,
      phi,
      thetaUnwrapped,
      phiUnwrapped,
      rho,
      debt,
      alignment,
      divergence,
      correction,
      correctionMargin,
      irreversibleLoss: params.irreversibleLoss,
      radialVelocity,
      debtVelocity,
      externalMismatch: syntheticExternalMismatch(phi),
      estimatedPhi: undefined,
      phaseIdentifiable: false,
      phaseConfidence: 0,
      phaseRegime: "Not identifiable",
      status,
    });
  }

  const phase = analyzePhaseDynamics(frames);
  annotatePhaseEstimates(frames, phase);
  const warningIndex = frames.findIndex((frame) => frame.status !== "Stable");
  const stableCount = frames.filter((frame) => frame.status === "Stable").length;
  const final = frames.at(-1)!;
  let stableTailStart = frames.length;
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    if (frames[index].status !== "Stable") break;
    stableTailStart = index;
  }
  const recoveryIndex =
    warningIndex >= 0 &&
    stableTailStart > warningIndex &&
    stableTailStart < frames.length &&
    ruptureStep === undefined
      ? stableTailStart
      : -1;
  const thetaTravel = Math.abs(
    final.thetaUnwrapped - frames[0].thetaUnwrapped,
  );
  const phiTravel = Math.abs(final.phiUnwrapped - frames[0].phiUnwrapped);

  return {
    frames,
    summary: {
      stableFraction: stableCount / frames.length,
      maxRho: maximumRho,
      finalAlignment: final.alignment,
      finalDebt: final.debt,
      finalStatus: final.status,
      firstWarningStep: warningIndex >= 0 ? warningIndex : undefined,
      ruptureStep,
      recovered: recoveryIndex >= 0,
      recoveryTime:
        recoveryIndex >= 0
          ? frames[recoveryIndex].time - frames[warningIndex].time
          : undefined,
      interventionCost: interventions.reduce((sum, event) => sum + event.cost, 0),
      windingRatio: phiTravel > 0.001 ? thetaTravel / phiTravel : 0,
      phase,
    },
  };
}

export function deterministicExplanation(
  frames: SimulationFrame[],
  summary: SimulationSummary,
  options: { complete?: boolean } = {},
) {
  const final = frames.at(-1)!;
  const complete = options.complete ?? true;
  const pressureStory =
    final.correctionMargin < 0
      ? "Divergence pressure exceeded correction capacity"
      : "Correction capacity remained above divergence pressure";
  const debtStory =
    final.debt > frames[0].debt + 0.08
      ? "Alignment debt accumulated and pushed the equilibrium radius outward"
      : "Debt remained contained or was repaid";
  const outcome =
    summary.ruptureStep !== undefined && summary.ruptureStep <= final.step
      ? `The viable boundary was crossed at step ${summary.ruptureStep}.`
      : !complete
        ? `At the selected time, the system is in a ${final.status.toLowerCase()} regime; the final outcome is not yet shown.`
      : summary.recovered
        ? "The system returned to a sustained stable regime before rupture."
        : summary.finalStatus === "Stable"
          ? "The system finished inside the modeled viable tube."
          : `The system finished in a ${summary.finalStatus.toLowerCase()} regime without crossing the rupture boundary.`;
  return `${pressureStory}. ${debtStory}. ${outcome}`;
}
