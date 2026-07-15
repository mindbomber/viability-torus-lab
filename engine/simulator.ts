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

export type ViabilityState =
  | "Viable recurrence"
  | "Viability-boundary crossing"
  | "Recoverable excursion"
  | "Irreversible rupture";

export type RupturePolicy = {
  irreversibleRho: number;
  cumulativeLossThreshold: number;
  debtThreshold: number;
  persistenceSteps: number;
};

export type SimulationOptions = {
  rupturePolicy?: Partial<RupturePolicy>;
};

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
  debtAdjustedMargin: number;
  irreversibleLoss: number;
  cumulativeIrreversibleLoss: number;
  radialVelocity: number;
  debtVelocity: number;
  externalMismatch: number;
  estimatedPhi?: number;
  phaseIdentifiable: boolean;
  phaseConfidence: number;
  phaseRegime: PhaseRegime;
  viabilityState: ViabilityState;
  ruptureProgress: number;
  status: SimulationStatus;
};

export type ScheduledIntervention = {
  id: string;
  label: string;
  step: number;
  effects: Partial<SimulationParameters>;
  cost: number;
  /** Reusable module provenance. Legacy callers may omit these fields. */
  definitionId?: string;
  planId?: string;
  intensity?: number;
  durationSteps?: number;
  phase?: "start" | "end";
  mechanism?: string;
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
  boundaryCrossingStep?: number;
  irreversibleRuptureStep?: number;
  finalViabilityState: ViabilityState;
  recoveredAfterCrossing: boolean;
  /** @deprecated Use boundaryCrossingStep. Retained for v1 contract compatibility. */
  ruptureStep?: number;
  recovered: boolean;
  recoveryTime?: number;
  interventionCost: number;
  windingRatio: number;
  phase: PhaseDiagnostics;
  aix: AixAssessment;
};

export type AixComponentKey = "P" | "B" | "C" | "F" | "M" | "G" | "R" | "Pi";

export type AixAssessment = {
  framework: "ATS-4.0";
  score: number;
  normalizedScore: number;
  components: Record<AixComponentKey, { score: number; weight: number; evidence: string }>;
  beta: number;
  riskTier: "standard" | "elevated" | "high" | "strict";
  thresholds: { accept: number; revise: number; defer: number };
  decision: "accept" | "revise" | "defer" | "refuse";
  recommendedAction: "accept" | "revise" | "defer" | "refuse";
  hardBlockers: string[];
  calibrationStatus: string;
};

export type ExternalTelemetrySample = { time: number; mismatch: number };
export type ExternalTelemetryPoint = ExternalTelemetrySample & { estimatedPhase?: number };
export type ExternalTelemetryAnalysis = {
  diagnostics: PhaseDiagnostics;
  samples: ExternalTelemetryPoint[];
  provenance: "imported-observation";
  establishesToroidalGeometry: false;
  warnings: string[];
};

export type SimulationExplanationTone = "stable" | "warning" | "danger" | "recovering" | "neutral";

export type SimulationAttributionContext = {
  system: {
    templateTitle: string;
    systemTitle: string;
    structureSummary: string;
    baselineParameters: SimulationParameters;
    structuralParameterKeys?: (keyof SimulationParameters)[];
  };
  scenario: {
    title: string;
    kind: string;
    parameters: SimulationParameters;
  };
  configuredParameters: SimulationParameters;
  interventionPlan: {
    title: string;
    strategy: string;
  };
};

export type SimulationExplanationSource = {
  id: "system-structure" | "scenario-pressure" | "user-overrides" | "intervention-activity" | "system-memory";
  title: string;
  state: string;
  tone: SimulationExplanationTone;
  summary: string;
  detail: string;
};

export type SimulationExplanation = {
  statusLabel: string;
  tone: SimulationExplanationTone;
  classification: string;
  sources: SimulationExplanationSource[];
  attributionBoundary: string;
  balanceSummary: string;
  balance: {
    label: string;
    symbol: string;
    value: number;
    tone: "positive" | "negative" | "neutral";
  }[];
  activeControls: {
    label: string;
    symbol: string;
    value: number;
  }[];
  trajectory: {
    label: "Improving" | "Worsening" | "Holding";
    tone: SimulationExplanationTone;
    detail: string;
    radialDirection: "Contraction" | "Neutral" | "Expansion";
    neutralCorrection: number;
    neutralGap: number;
    neutralDetail: string;
  };
  threshold: {
    label: string;
    value: string;
    tone: SimulationExplanationTone;
    detail: string;
  };
  history: string[];
  outcome: string;
};

export const MODEL_VERSION = "torus-1.2.0";
export const MAX_INTERNAL_DT = 0.25;
export const MIN_RHO = 0.03;
export const DEFAULT_RUPTURE_POLICY = {
  cumulativeLossThreshold: 0.5,
  debtThreshold: 1,
  persistenceSteps: 12,
} as const;

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

const AIX_WEIGHTS: Record<AixComponentKey, number> = {
  P: 0.16,
  B: 0.16,
  C: 0.12,
  F: 0.12,
  M: 0.12,
  G: 0.1,
  R: 0.11,
  Pi: 0.11,
};

const AIX_THRESHOLDS = {
  standard: { accept: 0.78, revise: 0.6, defer: 0.42 },
  elevated: { accept: 0.82, revise: 0.66, defer: 0.48 },
  high: { accept: 0.86, revise: 0.72, defer: 0.55 },
  strict: { accept: 0.9, revise: 0.78, defer: 0.62 },
} as const;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function rupturePolicyFor(
  params: SimulationParameters,
  overrides: Partial<RupturePolicy> = {},
): RupturePolicy {
  return {
    irreversibleRho: params.rhoCrit * 1.35,
    cumulativeLossThreshold: DEFAULT_RUPTURE_POLICY.cumulativeLossThreshold,
    debtThreshold: DEFAULT_RUPTURE_POLICY.debtThreshold,
    persistenceSteps: DEFAULT_RUPTURE_POLICY.persistenceSteps,
    ...overrides,
  };
}

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

export type RadialBalanceInput = {
  pressure: number;
  error: number;
  feedback: number;
  drift: number;
  irreversibleLoss: number;
  correction: number;
  debt: number;
  rho: number;
  kappa: number;
  rho0: number;
  chi: number;
};

/**
 * Canonical paper-aligned radial balance shared by the synthetic simulator and
 * browser-local observational replay. This is an equation evaluation, not a
 * claim that any supplied proxy is empirically calibrated.
 */
export function evaluateRadialBalance(input: RadialBalanceInput) {
  const pressureWeightedError = input.pressure * input.error * (1 - input.feedback);
  const driftAndLoss = input.drift + input.irreversibleLoss;
  const divergence = pressureWeightedError + driftAndLoss;
  const restoration = -input.kappa * (input.rho - input.rho0);
  const debtPressure = input.chi * input.debt;
  const correctionMargin = input.correction - divergence;
  const radialRate = restoration + divergence - input.correction + debtPressure;
  return {
    pressureWeightedError,
    driftAndLoss,
    divergence,
    restoration,
    correction: input.correction,
    debtPressure,
    correctionMargin,
    debtAdjustedMargin: correctionMargin - debtPressure,
    radialRate,
  };
}

/**
 * Minimum non-negative correction capacity needed to prevent deterministic
 * radial expansion at the supplied frame. A negative algebraic threshold
 * means restoration already outweighs divergence and debt pressure, so the
 * physically displayed correction threshold is zero.
 */
export function neutralCorrectionFor(
  frame: Pick<SimulationFrame, "rho" | "debt">,
  parameters: SimulationParameters,
) {
  const balance = evaluateRadialBalance({
    pressure: parameters.pressure,
    error: parameters.error,
    feedback: parameters.feedback,
    drift: parameters.drift,
    irreversibleLoss: parameters.irreversibleLoss,
    correction: 0,
    debt: frame.debt,
    rho: frame.rho,
    kappa: parameters.kappa,
    rho0: parameters.rho0,
    chi: parameters.chi,
  });
  return Math.max(0, balance.restoration + balance.divergence + balance.debtPressure);
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

export function analyzeExternalTelemetry(
  input: ExternalTelemetrySample[],
): ExternalTelemetryAnalysis {
  if (input.length < 8) {
    throw new RangeError("At least eight telemetry samples are required.");
  }
  if (input.length > 5_000) {
    throw new RangeError("At most 5,000 telemetry samples may be analyzed at once.");
  }
  const samples = input.map((sample) => ({
    time: Number(sample.time),
    mismatch: Number(sample.mismatch),
  }));
  samples.forEach((sample, index) => {
    if (!Number.isFinite(sample.time) || !Number.isFinite(sample.mismatch)) {
      throw new RangeError(`Telemetry sample ${index} must contain finite time and mismatch values.`);
    }
    if (index > 0 && sample.time <= samples[index - 1].time) {
      throw new RangeError("Telemetry time values must be strictly increasing.");
    }
  });

  const indices = sampledIndices(samples.length, 512);
  const sampled = indices.map((index) => samples[index]);
  const mean = sampled.reduce((sum, sample) => sum + sample.mismatch, 0) / sampled.length;
  const centered = sampled.map((sample) => sample.mismatch - mean);
  const amplitude = Math.sqrt(centered.reduce((sum, value) => sum + value * value, 0) / centered.length);
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
  const spectralConcentration = totalPower > 0 ? dominantPower / totalPower : 0;
  const duration = samples.at(-1)!.time - samples[0].time;
  const dominantAngularFrequency = dominantBin > 0 ? (TAU * dominantBin) / duration : 0;
  let largestGap = 0;
  for (let index = 1; index < samples.length; index += 1) {
    largestGap = Math.max(largestGap, samples[index].time - samples[index - 1].time);
  }
  let reason: PhaseDiagnosticReason = "identified";
  if (dominantAngularFrequency * largestGap >= Math.PI / 2) reason = "undersampled";
  else if (amplitude < PHASE_AMPLITUDE_FLOOR) reason = "low-amplitude";
  else if (dominantBin < PHASE_MIN_CYCLES) reason = "insufficient-cycles";
  else if (spectralConcentration < PHASE_SPECTRAL_FLOOR) reason = "low-spectral-concentration";
  const identifiable = reason === "identified";
  const diagnostics: PhaseDiagnostics = {
    identifiable,
    reason,
    regime: identifiable ? "Recurrent winding" : "Not identifiable",
    spectralConcentration,
    amplitude,
    observedMajorCycles: dominantBin,
    estimatedMajorCycles: dominantBin,
    dominantAngularFrequency,
    phaseLockingValue: 0,
  };
  const tau = dominantAngularFrequency > 0 ? 1 / dominantAngularFrequency : 0;
  const annotated: ExternalTelemetryPoint[] = samples.map((sample, index) => {
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const derivative = next === previous
      ? 0
      : (next.mismatch - previous.mismatch) / Math.max(next.time - previous.time, Number.EPSILON);
    return {
      ...sample,
      estimatedPhase: identifiable
        ? wrapAngle(Math.atan2(-tau * derivative, sample.mismatch - mean))
        : undefined,
    };
  });
  return {
    diagnostics,
    samples: annotated,
    provenance: "imported-observation",
    establishesToroidalGeometry: false,
    warnings: [
      "Imported telemetry is not treated as calibrated evidence unless its provenance, units, and measurement process are independently documented.",
      "An identifiable external phase does not establish toroidal geometry by itself; a distinct internal recurrent phase and joint-state test are still required.",
    ],
  };
}

export function evaluateAix(
  frame: SimulationFrame,
  params: SimulationParameters,
): AixAssessment {
  const radialRatio = frame.rho / params.rhoCrit;
  const debtRatio = frame.debt / Math.max(1, frame.debt + 1);
  const totalRadialPressure = frame.divergence + params.chi * frame.debt;
  const correctionCoverage = frame.correction / Math.max(frame.correction + totalRadialPressure, Number.EPSILON);
  const gracefulDegradation = frame.viabilityState === "Irreversible rupture"
    ? 0
    : clamp01(1 - Math.max(0, radialRatio - 0.35) / 1.15);
  const components: AixAssessment["components"] = {
    P: { score: clamp01(frame.alignment), weight: AIX_WEIGHTS.P, evidence: `illustrative P heuristic uses toy A=exp(-rho)=${frame.alignment.toFixed(3)}; no physical observation supplied` },
    B: { score: clamp01(1 - 0.55 * debtRatio - 0.45 * clamp01(radialRatio)), weight: AIX_WEIGHTS.B, evidence: `debt ${frame.debt.toFixed(3)}; radial ratio ${radialRatio.toFixed(3)}` },
    C: { score: clamp01(correctionCoverage), weight: AIX_WEIGHTS.C, evidence: `correction coverage ${correctionCoverage.toFixed(3)}` },
    F: { score: clamp01(params.feedback), weight: AIX_WEIGHTS.F, evidence: `feedback fidelity gamma=${params.feedback.toFixed(3)}` },
    M: { score: clamp01(1 - params.error), weight: AIX_WEIGHTS.M, evidence: `misclassification control 1-epsilon=${(1 - params.error).toFixed(3)}` },
    G: { score: gracefulDegradation, weight: AIX_WEIGHTS.G, evidence: `viability state ${frame.viabilityState}; radial velocity ${frame.radialVelocity.toFixed(3)}` },
    R: { score: clamp01(correctionCoverage * params.feedback), weight: AIX_WEIGHTS.R, evidence: `feedback-adjusted correction ${(correctionCoverage * params.feedback).toFixed(3)}` },
    Pi: { score: clamp01(1 - params.pressure / 3), weight: AIX_WEIGHTS.Pi, evidence: `normalized pressure control ${(1 - params.pressure / 3).toFixed(3)}` },
  };
  const normalizedScore = (Object.keys(components) as AixComponentKey[])
    .reduce((sum, key) => sum + components[key].score * components[key].weight, 0);
  const beta = clamp01(
    clamp01(frame.debt / 2) *
    clamp01(radialRatio) *
    (1 - params.feedback) /
    (1 + frame.cumulativeIrreversibleLoss),
  );
  const riskTier: AixAssessment["riskTier"] = frame.viabilityState === "Irreversible rupture" || params.irreversibleLoss >= 0.25
    ? "strict"
    : params.irreversibleLoss >= 0.12 || frame.debt >= 1
      ? "high"
      : params.irreversibleLoss >= 0.05 || radialRatio >= 0.65
        ? "elevated"
        : "standard";
  const thresholds = AIX_THRESHOLDS[riskTier];
  const hardBlockers: string[] = [];
  if (frame.viabilityState === "Irreversible rupture") hardBlockers.push("irreversible-rupture");
  if (frame.alignment < 0.05 && frame.radialVelocity > 0) hardBlockers.push("unbounded-low-alignment-expansion");
  const decision: AixAssessment["decision"] = hardBlockers.length
    ? "refuse"
    : normalizedScore >= thresholds.accept
      ? "accept"
      : normalizedScore >= thresholds.revise
        ? "revise"
        : normalizedScore >= thresholds.defer
          ? "defer"
          : "refuse";
  return {
    framework: "ATS-4.0",
    score: normalizedScore * 100,
    normalizedScore,
    components,
    beta,
    riskTier,
    thresholds,
    decision,
    recommendedAction: decision,
    hardBlockers,
    calibrationStatus: "Illustrative verifier-grounded synthetic diagnostic; component mappings are transparent model heuristics, not empirically calibrated domain scores.",
  };
}

export function simulate(
  base: SimulationParameters,
  interventions: ScheduledIntervention[] = [],
  options: SimulationOptions = {},
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
  let cumulativeIrreversibleLoss = 0;
  const frames: SimulationFrame[] = [];
  let maximumRho = rho;
  let boundaryCrossingStep: number | undefined;
  let irreversibleRuptureStep: number | undefined;
  let outsideStreak = 0;
  let wasOutside = rho >= params.rhoCrit;
  const policy = rupturePolicyFor(params, options.rupturePolicy);

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

    const divergence = evaluateRadialBalance({
      ...params,
      debt,
      rho,
    }).divergence;
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
        cumulativeIrreversibleLoss += params.irreversibleLoss * internalDt;

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

        const radialRate = evaluateRadialBalance({
          ...params,
          debt: priorDebt,
          rho,
        }).radialRate;
        rho = Math.max(
          MIN_RHO,
          rho +
            radialRate * internalDt +
            (random() - 0.5) * 0.012 * noiseScale,
        );
        maximumRho = Math.max(maximumRho, rho);
      }
      radialVelocity = (rho - startRho) / params.dt;
      debtVelocity = (debt - startDebt) / params.dt;
    }

    const outside = rho >= params.rhoCrit;
    const crossingNow = outside && !wasOutside;
    if (boundaryCrossingStep === undefined && (outside || crossingNow)) boundaryCrossingStep = step;
    outsideStreak = outside ? outsideStreak + 1 : 0;
    if (
      irreversibleRuptureStep === undefined &&
      outsideStreak >= policy.persistenceSteps &&
      cumulativeIrreversibleLoss >= policy.cumulativeLossThreshold &&
      (rho >= policy.irreversibleRho || debt >= policy.debtThreshold)
    ) {
      irreversibleRuptureStep = step;
    }
    wasOutside = outside;

    const viabilityState: ViabilityState = irreversibleRuptureStep !== undefined
      ? "Irreversible rupture"
      : crossingNow || (step === 0 && outside)
        ? "Viability-boundary crossing"
        : outside
          ? "Recoverable excursion"
          : "Viable recurrence";
    const ruptureProgress = viabilityState === "Irreversible rupture"
      ? clamp01(0.32 + 0.23 * Math.max(
          rho / Math.max(policy.irreversibleRho, Number.EPSILON) - 1,
          cumulativeIrreversibleLoss / Math.max(policy.cumulativeLossThreshold, Number.EPSILON) - 1,
          debt / Math.max(policy.debtThreshold, Number.EPSILON) - 1,
        ))
      : 0;

    const alignment = Math.exp(-rho);
    const status = irreversibleRuptureStep !== undefined
      ? "Ruptured"
      : classifyStatus(
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
      debtAdjustedMargin: correctionMargin - params.chi * debt,
      irreversibleLoss: params.irreversibleLoss,
      cumulativeIrreversibleLoss,
      radialVelocity,
      debtVelocity,
      externalMismatch: syntheticExternalMismatch(phi),
      estimatedPhi: undefined,
      phaseIdentifiable: false,
      phaseConfidence: 0,
      phaseRegime: "Not identifiable",
      viabilityState,
      ruptureProgress,
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
    irreversibleRuptureStep === undefined
      ? stableTailStart
      : -1;
  const recoveredAfterCrossing =
    boundaryCrossingStep !== undefined &&
    recoveryIndex > boundaryCrossingStep &&
    irreversibleRuptureStep === undefined;
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
      boundaryCrossingStep,
      irreversibleRuptureStep,
      finalViabilityState: final.viabilityState,
      recoveredAfterCrossing,
      ruptureStep: boundaryCrossingStep,
      recovered: recoveryIndex >= 0,
      recoveryTime:
        recoveryIndex >= 0
          ? frames[recoveryIndex].time - frames[warningIndex].time
          : undefined,
      interventionCost: interventions.reduce((sum, event) => sum + event.cost, 0),
      windingRatio: phiTravel > 0.001 ? thetaTravel / phiTravel : 0,
      phase,
      aix: evaluateAix(final, params),
    },
  };
}

export type PaperLegacyCaseId =
  | "stable-periodic"
  | "stable-quasiperiodic"
  | "neutral-tube"
  | "rupture-low-correction";

export type PaperLegacyMetrics = {
  meanRhoLast: number;
  maxRho: number;
  outsideFraction: number;
  finalDebt: number;
  meanAlignmentLast: number;
  windingTheta: number;
  windingPhi: number;
  windingRatio: number;
  correctionMargin: number;
};

export type PaperLegacyResult = {
  engineVersion: "paper-2026-legacy";
  caseId: PaperLegacyCaseId;
  title: string;
  protocol: string;
  steps: number;
  seed: number;
  metrics: PaperLegacyMetrics;
  expected: PaperLegacyMetrics;
  maximumAbsoluteError: number;
  matchesArchive: boolean;
  verificationPayload: string;
  frames: Pick<SimulationFrame, "step" | "time" | "theta" | "phi" | "thetaUnwrapped" | "phiUnwrapped" | "rho" | "debt" | "alignment" | "divergence" | "correction" | "correctionMargin">[];
};

type PaperLegacyCase = {
  id: PaperLegacyCaseId;
  title: string;
  steps: number;
  seed: number;
  theta0: number;
  phi0: number;
  omegaTheta: number;
  omegaPhi: number;
  couplingA: number;
  couplingB: number;
  correction: number;
  expected: PaperLegacyMetrics;
};

const PAPER_LEGACY_CASES: Record<PaperLegacyCaseId, PaperLegacyCase> = {
  "stable-periodic": {
    id: "stable-periodic",
    title: "Stable periodic correction",
    steps: 7_000,
    seed: 42,
    theta0: 4.862909272689599,
    phi0: 2.757554564287996,
    omegaTheta: 0.2,
    omegaPhi: 0.1,
    couplingA: 0,
    couplingB: 0,
    correction: 0.157,
    expected: { meanRhoLast: 0.0018181818181816495, maxRho: 0.22, outsideFraction: 0, finalDebt: 0, meanAlignmentLast: 0.9981834700730823, windingTheta: 0.03182530451326856, windingPhi: 0.015912652256634276, windingRatio: 2.0000000000000004, correctionMargin: 0.01200000000000001 },
  },
  "stable-quasiperiodic": {
    id: "stable-quasiperiodic",
    title: "Stable quasiperiodic winding",
    steps: 12_000,
    seed: 43,
    theta0: 4.098517143286439,
    phi0: 0.2750484703055747,
    omegaTheta: 0.21,
    omegaPhi: 0.21 / Math.sqrt(2),
    couplingA: 0.02,
    couplingB: 0.02,
    correction: 0.157,
    expected: { meanRhoLast: 0.0018181818181816493, maxRho: 0.22, outsideFraction: 0, finalDebt: 0, meanAlignmentLast: 0.9981834700730823, windingTheta: 0.033420690803500894, windingPhi: 0.02363246303048015, windingRatio: 1.4141856801128305, correctionMargin: 0.01200000000000001 },
  },
  "neutral-tube": {
    id: "neutral-tube",
    title: "Neutral bounded tube",
    steps: 7_000,
    seed: 44,
    theta0: 0.7701018095498474,
    phi0: 1.6217722790032334,
    omegaTheta: 0.21,
    omegaPhi: 0.21 / Math.sqrt(2),
    couplingA: 0.02,
    couplingB: 0.02,
    correction: 0.145,
    expected: { meanRhoLast: 0.22, maxRho: 0.22, outsideFraction: 0, finalDebt: 0, meanAlignmentLast: 0.8025187979624785, windingTheta: 0.03341609395050339, windingPhi: 0.023628084231574118, windingRatio: 1.4142532091471722, correctionMargin: 0 },
  },
  "rupture-low-correction": {
    id: "rupture-low-correction",
    title: "Low-correction radial escape",
    steps: 7_000,
    seed: 45,
    theta0: 3.6010861228267514,
    phi0: 3.320607798307932,
    omegaTheta: 0.21,
    omegaPhi: 0.21 / Math.sqrt(2),
    couplingA: 0.02,
    couplingB: 0.02,
    correction: 0.09,
    expected: { meanRhoLast: 7.279499545454636, maxRho: 8, outsideFraction: 0.9934285714285714, finalDebt: 30.795600000002423, meanAlignmentLast: 0.00184915021436519, windingTheta: 0.03340966674807827, windingPhi: 0.023629907118325768, windingRatio: 1.4138721147222784, correctionMargin: -0.05500000000000001 },
  },
};

export const paperLegacyCases = Object.values(PAPER_LEGACY_CASES).map((item) => ({
  id: item.id,
  title: item.title,
  steps: item.steps,
  seed: item.seed,
}));

export const PAPER_LEGACY_EXPECTED_DIGESTS: Record<PaperLegacyCaseId, string> = {
  "stable-periodic": "c7e780cc0743949e0b397c823af91e7300ea30cce39033659424ef3b2ccad3c5",
  "stable-quasiperiodic": "7fa4c7f618b5f4464367795a7c9da535193326c790f5829b740425dd30c4bc27",
  "neutral-tube": "a6ef89c758a27a58ec7cfd2de7e324a2fa6543e4fe77ba97b870855e129efc2a",
  "rupture-low-correction": "03c23fad6c38b446ccdf99dc22c405c0b5da3be3dfe05a87e49d05f60d27f9cd",
};

export function paperVerificationPayload(caseId: PaperLegacyCaseId, metrics: PaperLegacyMetrics) {
  const ordered = [
    metrics.meanRhoLast,
    metrics.maxRho,
    metrics.outsideFraction,
    metrics.finalDebt,
    metrics.meanAlignmentLast,
    metrics.windingTheta,
    metrics.windingPhi,
    metrics.windingRatio,
    metrics.correctionMargin,
  ];
  return `paper-2026-legacy|${caseId}|${ordered.map((value) => value.toFixed(12)).join("|")}`;
}

export function simulateLegacyPaperCase(caseId: PaperLegacyCaseId): PaperLegacyResult {
  const reference = PAPER_LEGACY_CASES[caseId];
  if (!reference) throw new RangeError(`Unknown paper case '${caseId}'.`);
  const divergence = 1 * 0.3 * (1 - 0.65) + 0.02 + 0.02;
  const rhoCrit = 1.2;
  let theta = reference.theta0;
  let phi = reference.phi0;
  let thetaUnwrapped = theta;
  let phiUnwrapped = phi;
  let rho = 0.22;
  let debt = 0;
  let maxRho = rho;
  let outsideCount = 0;
  const burn = Math.max(100, Math.floor(reference.steps / 5));
  let rhoTailSum = 0;
  let alignmentTailSum = 0;
  let tailCount = 0;
  let thetaAtBurn = theta;
  let phiAtBurn = phi;
  const frameStride = Math.max(1, Math.ceil(reference.steps / 720));
  const frames: PaperLegacyResult["frames"] = [];

  for (let step = 0; step < reference.steps; step += 1) {
    const alignment = Math.exp(-rho);
    if (step >= burn) {
      if (step === burn) {
        thetaAtBurn = thetaUnwrapped;
        phiAtBurn = phiUnwrapped;
      }
      rhoTailSum += rho;
      alignmentTailSum += alignment;
      tailCount += 1;
    }
    if (rho > rhoCrit) outsideCount += 1;
    if (step % frameStride === 0 || step === reference.steps - 1) {
      frames.push({
        step,
        time: step,
        theta,
        phi,
        thetaUnwrapped,
        phiUnwrapped,
        rho,
        debt,
        alignment,
        divergence,
        correction: reference.correction,
        correctionMargin: reference.correction - divergence,
      });
    }
    if (step === reference.steps - 1) break;
    const priorTheta = theta;
    const priorPhi = phi;
    const thetaIncrement = reference.omegaTheta + reference.couplingA * Math.sin(priorPhi);
    const phiIncrement = reference.omegaPhi + reference.couplingB * Math.sin(priorTheta);
    thetaUnwrapped += thetaIncrement;
    phiUnwrapped += phiIncrement;
    theta = wrapAngle(thetaUnwrapped);
    phi = wrapAngle(phiUnwrapped);
    const surplus = Math.max(reference.correction - divergence, 0);
    const deficit = Math.max(divergence - reference.correction, 0);
    const nextDebt = Math.max(0, debt + 0.08 * deficit - 0.045 * surplus * alignment);
    const nextRho = Math.max(0, Math.min(8, rho - 0.055 * (rho - 0.22) + divergence - reference.correction + 0.025 * debt));
    debt = nextDebt;
    rho = nextRho;
    maxRho = Math.max(maxRho, rho);
  }

  const windingTheta = (thetaUnwrapped - thetaAtBurn) / (TAU * (reference.steps - burn));
  const windingPhi = (phiUnwrapped - phiAtBurn) / (TAU * (reference.steps - burn));
  const metrics: PaperLegacyMetrics = {
    meanRhoLast: rhoTailSum / tailCount,
    maxRho,
    outsideFraction: outsideCount / reference.steps,
    finalDebt: debt,
    meanAlignmentLast: alignmentTailSum / tailCount,
    windingTheta,
    windingPhi,
    windingRatio: windingTheta / windingPhi,
    correctionMargin: reference.correction - divergence,
  };
  const differences = (Object.keys(metrics) as (keyof PaperLegacyMetrics)[])
    .map((key) => Math.abs(metrics[key] - reference.expected[key]));
  const maximumAbsoluteError = Math.max(...differences);
  return {
    engineVersion: "paper-2026-legacy",
    caseId,
    title: reference.title,
    protocol: "Exact unit-step discrete equations from run_toroidal_lab.py with archived initial phases, zero noise, rho clipped to [0,8], and the original 20% burn-in convention.",
    steps: reference.steps,
    seed: reference.seed,
    metrics,
    expected: reference.expected,
    maximumAbsoluteError,
    matchesArchive: maximumAbsoluteError <= 1e-9,
    verificationPayload: paperVerificationPayload(caseId, metrics),
    frames,
  };
}

export type TopologyDiagnostic = {
  gridSize: number;
  occupiedCells: number;
  coverage: number;
  connectedComponents: number;
  spansTheta: boolean;
  spansPhi: boolean;
  heuristicBetti: [number, number, number];
  limitation: string;
};

export function analyzePhaseOccupancy(frames: Pick<SimulationFrame, "theta" | "phi">[], gridSize = 32): TopologyDiagnostic {
  const grid = Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => false));
  frames.forEach((frame) => {
    const theta = Math.min(gridSize - 1, Math.floor(wrapAngle(frame.theta) / TAU * gridSize));
    const phi = Math.min(gridSize - 1, Math.floor(wrapAngle(frame.phi) / TAU * gridSize));
    grid[theta][phi] = true;
  });
  const occupiedCells = grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  const visited = new Set<string>();
  let connectedComponents = 0;
  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const key = `${row}:${column}`;
      if (!grid[row][column] || visited.has(key)) continue;
      connectedComponents += 1;
      const queue = [[row, column]];
      visited.add(key);
      while (queue.length) {
        const [currentRow, currentColumn] = queue.shift()!;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nextRow = (currentRow + dr + gridSize) % gridSize;
          const nextColumn = (currentColumn + dc + gridSize) % gridSize;
          const nextKey = `${nextRow}:${nextColumn}`;
          if (grid[nextRow][nextColumn] && !visited.has(nextKey)) {
            visited.add(nextKey);
            queue.push([nextRow, nextColumn]);
          }
        }
      }
    }
  }
  const spansTheta = grid.every((row) => row.some(Boolean));
  const spansPhi = Array.from({ length: gridSize }, (_, column) => grid.some((row) => row[column])).every(Boolean);
  const beta1 = spansTheta && spansPhi && occupiedCells / (gridSize * gridSize) > 0.12 ? 2 : 1;
  return {
    gridSize,
    occupiedCells,
    coverage: occupiedCells / (gridSize * gridSize),
    connectedComponents,
    spansTheta,
    spansPhi,
    heuristicBetti: [connectedComponents, beta1, beta1 === 2 ? 1 : 0],
    limitation: "The live Betti tuple is an occupancy-grid heuristic. The archived topology study remains the authoritative cubical-homology result.",
  };
}

export type CoupledToriResult = {
  coupling: number;
  agents: number;
  steps: number;
  meanOrderLast: number;
  meanRhoLast: number;
  finalDebtMean: number;
  coordinationWithoutAlignment: boolean;
};

export function simulateCoupledTori(coupling: number, seed = 84, agents = 24, steps = 1_200): CoupledToriResult {
  if (!Number.isFinite(coupling) || coupling < 0 || coupling > 0.25) throw new RangeError("Coupling must be between 0 and 0.25.");
  const random = seededRandom(seed);
  let theta = Array.from({ length: agents }, () => random() * TAU);
  let phi = Array.from({ length: agents }, () => random() * TAU);
  const omegaTheta = Array.from({ length: agents }, () => 0.21 + (random() - 0.5) * 0.04);
  const omegaPhi = Array.from({ length: agents }, () => 0.21 / Math.sqrt(2) + (random() - 0.5) * 0.03);
  let rho = Array.from({ length: agents }, () => 0.22);
  const debt = Array.from({ length: agents }, () => 0);
  let orderTail = 0;
  let rhoTail = 0;
  let tailCount = 0;
  for (let step = 0; step < steps; step += 1) {
    const real = theta.reduce((sum, angle) => sum + Math.cos(angle), 0) / agents;
    const imaginary = theta.reduce((sum, angle) => sum + Math.sin(angle), 0) / agents;
    const order = Math.hypot(real, imaginary);
    if (step >= steps - 400) {
      orderTail += order;
      rhoTail += rho.reduce((sum, value) => sum + value, 0) / agents;
      tailCount += 1;
    }
    const nextTheta = [...theta];
    const nextPhi = [...phi];
    for (let index = 0; index < agents; index += 1) {
      const neighbors = [(index - 1 + agents) % agents, (index + 1) % agents];
      const thetaCoupling = neighbors.reduce((sum, neighbor) => sum + Math.sin(theta[neighbor] - theta[index]), 0);
      const phiCoupling = neighbors.reduce((sum, neighbor) => sum + Math.sin(phi[neighbor] - phi[index]), 0);
      nextTheta[index] = wrapAngle(theta[index] + omegaTheta[index] + coupling * thetaCoupling);
      nextPhi[index] = wrapAngle(phi[index] + omegaPhi[index] + coupling * phiCoupling);
    }
    const effectiveError = 0.3 + 0.35 * coupling * order;
    const divergence = effectiveError * (1 - 0.65) + 0.02 + 0.02;
    const correction = 0.16;
    rho = rho.map((value, index) => {
      const surplus = Math.max(correction - divergence, 0);
      const deficit = Math.max(divergence - correction, 0);
      debt[index] = Math.max(0, debt[index] + 0.08 * deficit - 0.045 * surplus * Math.exp(-value));
      return Math.max(0, Math.min(8, value - 0.055 * (value - 0.22) + divergence - correction + 0.025 * debt[index]));
    });
    theta = nextTheta;
    phi = nextPhi;
  }
  const meanOrderLast = orderTail / Math.max(1, tailCount);
  const meanRhoLast = rhoTail / Math.max(1, tailCount);
  const finalDebtMean = debt.reduce((sum, value) => sum + value, 0) / agents;
  return {
    coupling,
    agents,
    steps,
    meanOrderLast,
    meanRhoLast,
    finalDebtMean,
    coordinationWithoutAlignment: meanOrderLast >= 0.7 && meanRhoLast >= 1.2,
  };
}

function signedExplanationValue(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function explanationStatusLabel(frame: SimulationFrame) {
  if (frame.viabilityState === "Irreversible rupture") return "Irreversible rupture";
  if (frame.viabilityState === "Viability-boundary crossing") return "Boundary crossed";
  if (frame.viabilityState === "Recoverable excursion") return "Recoverable excursion";
  return frame.status;
}

function explanationTone(frame: SimulationFrame): SimulationExplanationTone {
  if (frame.viabilityState === "Irreversible rupture") return "danger";
  if (frame.viabilityState === "Recoverable excursion" && frame.radialVelocity < 0) return "recovering";
  if (frame.viabilityState !== "Viable recurrence") return "warning";
  if (frame.status === "Stable") return "stable";
  if (frame.status === "Recovering") return "recovering";
  if (frame.status === "Rupture approaching" || frame.status === "Ruptured") return "danger";
  return "warning";
}

function outsideStreakAt(frames: SimulationFrame[], rhoCrit: number) {
  let streak = 0;
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    if (frames[index].rho < rhoCrit) break;
    streak += 1;
  }
  return streak;
}

function classificationExplanation(
  frame: SimulationFrame,
  params: SimulationParameters,
  outsideStreak: number,
) {
  if (frame.viabilityState === "Irreversible rupture") {
    return "The terminal policy has fired. This historical state remains latched even if later correction reduces excursion or debt.";
  }
  if (frame.viabilityState === "Viability-boundary crossing") {
    return `Radial excursion ρ=${frame.rho.toFixed(3)} reached the critical boundary ρcrit=${params.rhoCrit.toFixed(3)} on this step. A boundary crossing is not terminal by itself.`;
  }
  if (frame.viabilityState === "Recoverable excursion") {
    const motion = frame.radialVelocity < 0 ? "contracting" : "still expanding";
    return `Excursion remains outside ρcrit for ${outsideStreak} consecutive step${outsideStreak === 1 ? "" : "s"}, but terminal conditions have not fired and radial motion is ${motion}.`;
  }
  switch (frame.status) {
    case "Rupture approaching":
      return `Radial excursion ρ=${frame.rho.toFixed(3)} is at least 84% of the critical boundary (${(params.rhoCrit * 0.84).toFixed(3)}).`;
    case "Recovering":
      return `Radial velocity ${signedExplanationValue(frame.radialVelocity)} is below the recovery cutoff −0.035 while excursion or debt remains elevated.`;
    case "Expanding":
      return `Radial velocity ${signedExplanationValue(frame.radialVelocity)} exceeds the expansion cutoff +0.055.`;
    case "Debt accumulating":
      return `Debt is ${frame.debt.toFixed(3)} and rising at ${signedExplanationValue(frame.debtVelocity)} per time unit, above the accumulation cutoffs.`;
    case "Drifting":
      return `The instantaneous correction margin C−D=${signedExplanationValue(frame.correctionMargin)} is below the drifting cutoff −0.025.`;
    case "Fragile": {
      const reason = frame.rho > params.rhoCrit * 0.5
        ? `ρ=${frame.rho.toFixed(3)} is above half the critical radius`
        : `C−D=${signedExplanationValue(frame.correctionMargin)} is below the +0.045 reserve`;
      return `${reason}, leaving little modeled capacity for another disturbance.`;
    }
    case "Warning": {
      const triggers = [
        frame.rho > params.rhoCrit * 0.34 ? `ρ=${frame.rho.toFixed(3)} is above the early-warning band` : "",
        frame.debt > 0.55 ? `debt Δ=${frame.debt.toFixed(3)} exceeds 0.550` : "",
      ].filter(Boolean);
      return `${triggers.join(" and ")}.`;
    }
    case "Ruptured":
      return `Radial excursion ρ=${frame.rho.toFixed(3)} is outside the critical boundary ρcrit=${params.rhoCrit.toFixed(3)}.`;
    case "Stable":
    default:
      return `Excursion ρ=${frame.rho.toFixed(3)}, debt Δ=${frame.debt.toFixed(3)}, and margin C−D=${signedExplanationValue(frame.correctionMargin)} do not trigger a higher-risk status rule.`;
  }
}

const explanationParameterKeys: (keyof SimulationParameters)[] = [
  "pressure", "error", "feedback", "correction", "drift", "irreversibleLoss", "initialDebt",
  "kappa", "chi", "alpha", "beta", "rho0", "rhoCrit", "omegaTheta", "omegaPhi",
  "couplingA", "couplingB", "seed", "steps", "dt",
];

const explanationParameterSymbols: Record<keyof SimulationParameters, string> = {
  pressure: "π",
  error: "ε",
  feedback: "γ",
  correction: "C",
  drift: "Φ",
  irreversibleLoss: "Λ",
  initialDebt: "Δ₀",
  kappa: "κ",
  chi: "χ",
  omegaTheta: "ωθ",
  omegaPhi: "ωφ",
  couplingA: "a",
  couplingB: "b",
  rho0: "ρ₀",
  rhoCrit: "ρcrit",
  alpha: "α",
  beta: "β",
  seed: "seed",
  steps: "steps",
  dt: "dt",
};

type ExplanationParameterChange = {
  key: keyof SimulationParameters;
  from: number;
  to: number;
};

function explanationParameterChanges(
  from: SimulationParameters,
  to: SimulationParameters,
): ExplanationParameterChange[] {
  return explanationParameterKeys
    .filter((key) => Math.abs(from[key] - to[key]) > 1e-9)
    .map((key) => ({ key, from: from[key], to: to[key] }));
}

function formatExplanationChanges(changes: ExplanationParameterChange[], limit = 4) {
  if (changes.length === 0) return "No parameter changes.";
  const visible = changes.slice(0, limit).map(({ key, from, to }) => (
    `${explanationParameterSymbols[key]} ${from.toFixed(3)}→${to.toFixed(3)}`
  ));
  const remainder = changes.length - visible.length;
  return `${visible.join(" · ")}${remainder > 0 ? ` · +${remainder} more` : ""}`;
}

function declaredDebtAdjustedMargin(parameters: SimulationParameters) {
  const divergence = parameters.pressure * parameters.error * (1 - parameters.feedback)
    + parameters.drift
    + parameters.irreversibleLoss;
  return parameters.correction - divergence - parameters.chi * parameters.initialDebt;
}

function shiftTone(shift: number): SimulationExplanationTone {
  if (shift > 0.005) return "stable";
  if (shift < -0.005) return "danger";
  return "neutral";
}

function shiftState(shift: number, neutral: string) {
  if (shift > 0.005) return "Improves the declared margin";
  if (shift < -0.005) return "Narrows the declared margin";
  return neutral;
}

function buildExplanationSources(input: {
  frame: SimulationFrame;
  initial: SimulationFrame;
  parameters: SimulationParameters;
  interventions: ScheduledIntervention[];
  context?: SimulationAttributionContext;
}): SimulationExplanationSource[] {
  const { frame, initial, parameters, interventions, context } = input;
  const systemBaseline = context?.system.baselineParameters ?? context?.scenario.parameters ?? context?.configuredParameters ?? parameters;
  const scenarioParameters = context?.scenario.parameters ?? context?.configuredParameters ?? parameters;
  const configuredParameters = context?.configuredParameters ?? parameters;
  const structuralKeys = context?.system.structuralParameterKeys?.length
    ? context.system.structuralParameterKeys
    : (["kappa", "chi", "rhoCrit"] as (keyof SimulationParameters)[]);
  const structuralValues = structuralKeys
    .slice(0, 5)
    .map((key) => `${explanationParameterSymbols[key]}=${systemBaseline[key].toFixed(3)}`)
    .join(" · ");
  const baselineMargin = declaredDebtAdjustedMargin(systemBaseline);

  const scenarioChanges = explanationParameterChanges(systemBaseline, scenarioParameters);
  const scenarioMargin = declaredDebtAdjustedMargin(scenarioParameters);
  const scenarioShift = scenarioMargin - baselineMargin;
  const scenarioTitle = context?.scenario.title ?? "Selected scenario";
  const scenarioKind = context?.scenario.kind.replaceAll("-", " ") ?? "scenario";

  const overrideChanges = explanationParameterChanges(scenarioParameters, configuredParameters);
  const configuredMargin = declaredDebtAdjustedMargin(configuredParameters);
  const overrideShift = configuredMargin - scenarioMargin;

  const occurred = interventions.filter((event) => event.step <= frame.step);
  const upcoming = interventions.find((event) => event.step > frame.step);
  const activeStarts = occurred.filter((event) => event.phase !== "end" && !occurred.some((candidate) => (
    candidate.phase === "end" && candidate.id === `${event.id}-end`
  )));
  const latestEvent = occurred.at(-1);
  const interventionChanges = explanationParameterChanges(configuredParameters, parameters);
  const activeMargin = declaredDebtAdjustedMargin(parameters);
  const interventionShift = activeMargin - configuredMargin;
  let interventionState = "No intervention active";
  let interventionSummary = interventions.length
    ? `${context?.interventionPlan.title ?? "The selected plan"} has not changed the parameters at this frame.`
    : "No intervention is scheduled, so the live parameters still reflect only the system, scenario, and user configuration.";
  if (activeStarts.length > 0) {
    interventionState = `${activeStarts.length} modeled action${activeStarts.length === 1 ? "" : "s"} active`;
    interventionSummary = `${latestEvent?.label ?? "An intervention"} most recently changed the run at step ${latestEvent?.step ?? frame.step}. The total active intervention effect is separated from the starting sliders.`;
  } else if (latestEvent?.phase === "end") {
    interventionState = "Temporary action has ended";
    interventionSummary = `${latestEvent.label} at step ${latestEvent.step}; its temporary parameter effect is no longer active.`;
  } else if (upcoming) {
    interventionState = `Next action at step ${upcoming.step}`;
    interventionSummary = `${context?.interventionPlan.title ?? "The selected plan"} is scheduled, but no intervention has taken effect yet. Next: ${upcoming.label}.`;
  }

  const debtChange = frame.debt - initial.debt;
  const debtPressure = parameters.chi * frame.debt;
  let memoryState: string;
  let memoryTone: SimulationExplanationTone;
  let memorySummary: string;
  if (frame.viabilityState === "Irreversible rupture") {
    memoryState = "Terminal history is latched";
    memoryTone = "danger";
    memorySummary = "The modeled terminal policy already fired, so later improvement cannot erase the recorded irreversible rupture.";
  } else if (frame.step === 0 && frame.debt > 0.3) {
    memoryState = "Starting debt is already present";
    memoryTone = "warning";
    memorySummary = "The run begins with declared accumulated debt from conditions before playback; it immediately reduces the debt-adjusted margin.";
  } else if (frame.debtVelocity > 0.005) {
    memoryState = "Debt is accumulating";
    memoryTone = "danger";
    memorySummary = `Past divergence is still being carried forward: debt is rising at ${signedExplanationValue(frame.debtVelocity)} per time unit.`;
  } else if (frame.debtVelocity < -0.005) {
    memoryState = "Debt is being repaid";
    memoryTone = "recovering";
    memorySummary = `Debt is contracting at ${signedExplanationValue(frame.debtVelocity)} per time unit, but its remaining pressure still affects the live margin.`;
  } else if (debtChange > 0.01 || frame.debt > 0.3) {
    memoryState = "Earlier debt still persists";
    memoryTone = frame.debtAdjustedMargin < 0 ? "warning" : "neutral";
    memorySummary = frame.correctionMargin >= 0 && frame.debtAdjustedMargin < 0
      ? "Correction covers current divergence, but carried debt reverses the effective margin. Present conditions alone therefore do not explain the status."
      : "Accumulated debt remains part of the current state even though its level is not changing quickly at this frame.";
  } else {
    memoryState = "Little carried debt";
    memoryTone = "stable";
    memorySummary = "Debt memory is currently small, so the live balance is driven mainly by present divergence and correction.";
  }

  return [
    {
      id: "system-structure",
      title: "System structure",
      state: context ? `${context.system.templateTitle} → ${context.system.systemTitle}` : "Selected system baseline",
      tone: "neutral",
      summary: context?.system.structureSummary ?? "The selected system establishes restoration, debt sensitivity, recurrence, and the viability boundary before other changes are applied.",
      detail: `Pre-scenario C−D−χΔ=${signedExplanationValue(baselineMargin)} · ${structuralValues}`,
    },
    {
      id: "scenario-pressure",
      title: "Scenario pressure",
      state: shiftState(scenarioShift, scenarioChanges.length ? "Changes other dynamics" : "Adds no common transform"),
      tone: shiftTone(scenarioShift),
      summary: scenarioChanges.length
        ? `${scenarioTitle} (${scenarioKind}) changes ${scenarioChanges.length} declared input${scenarioChanges.length === 1 ? "" : "s"} before playback begins.`
        : `${scenarioTitle} uses the bounded system's declared operating baseline without an additional common transform.`,
      detail: `${formatExplanationChanges(scenarioChanges)} · margin ${signedExplanationValue(baselineMargin)}→${signedExplanationValue(scenarioMargin)}`,
    },
    {
      id: "user-overrides",
      title: "User overrides",
      state: overrideChanges.length ? `${overrideChanges.length} slider change${overrideChanges.length === 1 ? "" : "s"}` : "Sliders match the selected scenario",
      tone: shiftTone(overrideShift),
      summary: overrideChanges.length
        ? "These slider or run-control changes were made after the scenario loaded and are part of this run's starting configuration."
        : "No slider change is contributing to the current result; the values match the selected scenario.",
      detail: `${formatExplanationChanges(overrideChanges)} · margin ${signedExplanationValue(scenarioMargin)}→${signedExplanationValue(configuredMargin)}`,
    },
    {
      id: "intervention-activity",
      title: "Intervention activity",
      state: interventionState,
      tone: activeStarts.length ? shiftTone(interventionShift) : "neutral",
      summary: interventionSummary,
      detail: `${interventionChanges.length ? formatExplanationChanges(interventionChanges) : "No active parameter effect."} · live C=${frame.correction.toFixed(3)}`,
    },
    {
      id: "system-memory",
      title: "System memory",
      state: memoryState,
      tone: memoryTone,
      summary: memorySummary,
      detail: `Δ=${frame.debt.toFixed(3)} (${signedExplanationValue(debtChange)} from start) · χΔ=${debtPressure.toFixed(3)} · cumulative Λ=${frame.cumulativeIrreversibleLoss.toFixed(3)}`,
    },
  ];
}

export function explainSimulationFrame(
  frames: SimulationFrame[],
  summary: SimulationSummary,
  parameters: SimulationParameters,
  options: {
    complete?: boolean;
    interventions?: ScheduledIntervention[];
    rupturePolicy?: Partial<RupturePolicy>;
    attribution?: SimulationAttributionContext;
  } = {},
): SimulationExplanation {
  if (frames.length === 0) throw new RangeError("At least one frame is required for an explanation.");
  const frame = frames.at(-1)!;
  const initial = frames[0];
  const complete = options.complete ?? true;
  const optimizationPressure = parameters.pressure * parameters.error * (1 - parameters.feedback);
  const driftAndLoss = parameters.drift + parameters.irreversibleLoss;
  const debtPressure = parameters.chi * frame.debt;
  const outsideStreak = outsideStreakAt(frames, parameters.rhoCrit);
  const policy = rupturePolicyFor(parameters, options.rupturePolicy);
  const radialRatio = frame.rho / parameters.rhoCrit;
  const sources = buildExplanationSources({
    frame,
    initial,
    parameters,
    interventions: options.interventions ?? [],
    context: options.attribution,
  });
  const neutralCorrection = neutralCorrectionFor(frame, parameters);
  const neutralGap = neutralCorrection - frame.correction;
  const radialDirection: SimulationExplanation["trajectory"]["radialDirection"] = frame.radialVelocity > 0.01
    ? "Expansion"
    : frame.radialVelocity < -0.01
      ? "Contraction"
      : "Neutral";
  const neutralDetail = neutralGap > 0.005
    ? `Current correction C=${frame.correction.toFixed(3)} is ${neutralGap.toFixed(3)} below the model's neutral threshold C*=${neutralCorrection.toFixed(3)}. Raising C by that gap, or equivalently lowering modeled divergence or debt pressure, would close the deterministic expansion gap at this frame.`
    : neutralGap < -0.005
      ? `Current correction C=${frame.correction.toFixed(3)} is ${Math.abs(neutralGap).toFixed(3)} above the model's neutral threshold C*=${neutralCorrection.toFixed(3)}, leaving a deterministic contraction margin at this frame.`
      : `Current correction C=${frame.correction.toFixed(3)} is approximately at the model's neutral threshold C*=${neutralCorrection.toFixed(3)} at this frame.`;

  const balanceSummary = frame.correctionMargin < 0
    ? `Divergence exceeds correction by ${Math.abs(frame.correctionMargin).toFixed(3)}; debt pressure widens the effective deficit to ${Math.abs(frame.debtAdjustedMargin).toFixed(3)}.`
    : frame.debtAdjustedMargin < 0
      ? `Correction covers immediate divergence by ${frame.correctionMargin.toFixed(3)}, but debt pressure ${debtPressure.toFixed(3)} reverses the effective margin to ${signedExplanationValue(frame.debtAdjustedMargin)}.`
      : `Correction covers immediate divergence by ${frame.correctionMargin.toFixed(3)} and retains ${frame.debtAdjustedMargin.toFixed(3)} after current debt pressure.`;

  let trajectory: SimulationExplanation["trajectory"];
  if (frame.step === 0) {
    trajectory = {
      label: "Holding",
      tone: "neutral",
      detail: "Playback is at the declared initial state; dynamic motion begins on the next integration step.",
      radialDirection,
      neutralCorrection,
      neutralGap,
      neutralDetail,
    };
  } else {
    const recent = frames[Math.max(0, frames.length - 13)];
    const rhoChange = frame.rho - recent.rho;
    const debtChange = frame.debt - recent.debt;
    const improving = frame.radialVelocity < -0.01 || (Math.abs(frame.radialVelocity) <= 0.01 && frame.debtVelocity < -0.005);
    const worsening = frame.radialVelocity > 0.01 || frame.debtVelocity > 0.005;
    trajectory = {
      label: improving ? "Improving" : worsening ? "Worsening" : "Holding",
      tone: improving ? "recovering" : worsening ? "danger" : "neutral",
      detail: `dρ/dt=${signedExplanationValue(frame.radialVelocity)} and dΔ/dt=${signedExplanationValue(frame.debtVelocity)}; over the recent window, ρ changed ${signedExplanationValue(rhoChange)} and debt changed ${signedExplanationValue(debtChange)}.`,
      radialDirection,
      neutralCorrection,
      neutralGap,
      neutralDetail,
    };
  }

  let threshold: SimulationExplanation["threshold"];
  if (frame.viabilityState === "Irreversible rupture") {
    const ruptureStep = summary.irreversibleRuptureStep ?? frame.step;
    threshold = {
      label: "Terminal policy",
      value: `Fired at step ${ruptureStep}`,
      tone: "danger",
      detail: `The run met persistence (${policy.persistenceSteps} steps), cumulative loss (${policy.cumulativeLossThreshold.toFixed(3)}), and severe debt (Δ≥${policy.debtThreshold.toFixed(3)}) or excursion (ρ≥${policy.irreversibleRho.toFixed(3)}) requirements.`,
    };
  } else if (frame.rho >= parameters.rhoCrit) {
    threshold = {
      label: "Recoverability window",
      value: `${outsideStreak} / ${policy.persistenceSteps} outside steps`,
      tone: frame.radialVelocity < 0 ? "recovering" : "warning",
      detail: `Cumulative loss is ${frame.cumulativeIrreversibleLoss.toFixed(3)} / ${policy.cumulativeLossThreshold.toFixed(3)}; debt is ${frame.debt.toFixed(3)} / ${policy.debtThreshold.toFixed(3)}. Crossing remains nonterminal until every policy gate is satisfied.`,
    };
  } else {
    const headroom = parameters.rhoCrit - frame.rho;
    threshold = {
      label: "Critical-boundary headroom",
      value: `${(radialRatio * 100).toFixed(1)}% of ρcrit`,
      tone: radialRatio >= 0.84 ? "danger" : radialRatio >= 0.5 ? "warning" : "stable",
      detail: `Excursion is ${headroom.toFixed(3)} inside the critical boundary; the rupture-approaching band begins at ${(parameters.rhoCrit * 0.84).toFixed(3)}.`,
    };
  }

  const history: string[] = [
    `Started at ρ=${initial.rho.toFixed(3)}, debt Δ=${initial.debt.toFixed(3)}, and C−D=${signedExplanationValue(initial.correctionMargin)}.`,
  ];
  let currentStreakStart = frames.length - 1;
  const currentLabel = explanationStatusLabel(frame);
  while (currentStreakStart > 0 && explanationStatusLabel(frames[currentStreakStart - 1]) === currentLabel) {
    currentStreakStart -= 1;
  }
  if (currentStreakStart > 0) {
    history.push(`Status changed from ${explanationStatusLabel(frames[currentStreakStart - 1])} to ${currentLabel} at step ${frames[currentStreakStart].step}.`);
  }
  let latestIntervention: ScheduledIntervention | undefined;
  for (const intervention of options.interventions ?? []) {
    if (intervention.step <= frame.step && (!latestIntervention || intervention.step > latestIntervention.step)) latestIntervention = intervention;
  }
  if (latestIntervention) {
    const symbols: Partial<Record<keyof SimulationParameters, string>> = {
      pressure: "π", error: "ε", feedback: "γ", correction: "C", drift: "Φ",
      irreversibleLoss: "Λ", kappa: "κ", chi: "χ", beta: "β", rhoCrit: "ρcrit",
    };
    const changes = Object.entries(latestIntervention.effects)
      .map(([key, value]) => `${symbols[key as keyof SimulationParameters] ?? key}=${Number(value).toFixed(3)}`)
      .join(", ");
    history.push(`${latestIntervention.label} changed ${changes} at step ${latestIntervention.step}.`);
  }
  if (summary.boundaryCrossingStep !== undefined && summary.boundaryCrossingStep <= frame.step) {
    history.push(`The critical boundary was first crossed at step ${summary.boundaryCrossingStep}.`);
  }
  if (summary.irreversibleRuptureStep !== undefined && summary.irreversibleRuptureStep <= frame.step) {
    history.push(`Terminal rupture was declared at step ${summary.irreversibleRuptureStep} and is now an absorbing historical state.`);
  } else {
    const debtChange = frame.debt - initial.debt;
    history.push(Math.abs(debtChange) < 0.01
      ? "Debt remains close to its starting level."
      : `Debt has ${debtChange > 0 ? "grown" : "fallen"} by ${Math.abs(debtChange).toFixed(3)} since the selected run began.`);
  }

  let outcome: string;
  if (!complete) {
    outcome = frame.viabilityState === "Irreversible rupture"
      ? "Irreversible rupture has already been observed; subsequent frames preserve the terminal state."
      : `At the selected time the system is ${currentLabel.toLowerCase()}. The final outcome is not yet shown.`;
  } else if (summary.finalViabilityState === "Irreversible rupture") {
    outcome = `The run finished in irreversible rupture after crossing at step ${summary.boundaryCrossingStep ?? "unknown"} and firing the terminal policy at step ${summary.irreversibleRuptureStep ?? "unknown"}.`;
  } else if (summary.recoveredAfterCrossing) {
    outcome = "The run crossed the critical boundary and returned to sustained viable recurrence before terminal rupture.";
  } else if (summary.recovered) {
    outcome = "The run returned to a sustained stable regime after an earlier warning state.";
  } else if (summary.finalStatus === "Stable") {
    outcome = "The run finished inside the modeled viable tube without a warning episode that later required recovery.";
  } else {
    outcome = `The run finished in a ${summary.finalStatus.toLowerCase()} regime without terminal rupture.`;
  }

  return {
    statusLabel: currentLabel,
    tone: explanationTone(frame),
    classification: classificationExplanation(frame, parameters, outsideStreak),
    sources,
    attributionBoundary: "These are deterministic contributions inside the selected educational model, not empirical causal identification or proof that the real-world mapping is correct.",
    balanceSummary,
    balance: [
      { label: "Pressure × error × feedback gap", symbol: "π·ε·(1−γ)", value: optimizationPressure, tone: "negative" },
      { label: "Drift + irreversible loss", symbol: "Φ + Λ", value: driftAndLoss, tone: "negative" },
      { label: "Total divergence", symbol: "D", value: frame.divergence, tone: "negative" },
      { label: "Correction capacity", symbol: "C", value: frame.correction, tone: "positive" },
      { label: "Debt pressure", symbol: "χΔ", value: debtPressure, tone: "negative" },
      { label: "Debt-adjusted margin", symbol: "C−D−χΔ", value: frame.debtAdjustedMargin, tone: frame.debtAdjustedMargin >= 0 ? "positive" : "negative" },
    ],
    activeControls: [
      { label: "Pressure", symbol: "π", value: parameters.pressure },
      { label: "Error", symbol: "ε", value: parameters.error },
      { label: "Feedback", symbol: "γ", value: parameters.feedback },
      { label: "Correction", symbol: "C", value: parameters.correction },
      { label: "Drift", symbol: "Φ", value: parameters.drift },
      { label: "Irreversible loss", symbol: "Λ", value: parameters.irreversibleLoss },
      { label: "Debt coupling", symbol: "χ", value: parameters.chi },
      { label: "Current debt", symbol: "Δ", value: frame.debt },
    ],
    trajectory,
    threshold,
    history,
    outcome,
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
    summary.irreversibleRuptureStep !== undefined && summary.irreversibleRuptureStep <= final.step
      ? `The viable boundary was crossed at step ${summary.boundaryCrossingStep ?? summary.irreversibleRuptureStep}. Irreversible rupture was declared at step ${summary.irreversibleRuptureStep} after persistent boundary excursion, accumulated loss, and severe debt or radial expansion.`
      : summary.boundaryCrossingStep !== undefined && summary.boundaryCrossingStep <= final.step && final.viabilityState !== "Viable recurrence"
        ? `The viable boundary was crossed at step ${summary.boundaryCrossingStep}; this remains a modeled recoverable excursion unless the terminal policy also fires.`
      : !complete
        ? `At the selected time, the system is in a ${final.status.toLowerCase()} regime; the final outcome is not yet shown.`
        : summary.recoveredAfterCrossing
          ? "The system crossed the viability boundary and then returned to sustained viable recurrence without terminal rupture."
          : summary.recovered
            ? "The system returned to a sustained stable regime before terminal rupture."
        : summary.finalStatus === "Stable"
          ? "The system finished inside the modeled viable tube."
          : `The system finished in a ${summary.finalStatus.toLowerCase()} regime without terminal rupture.`;
  return `${pressureStory}. ${debtStory}. ${outcome}`;
}
