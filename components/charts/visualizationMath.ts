import type {
  RupturePolicy,
  SimulationFrame,
  SimulationParameters,
} from "../../engine/simulator.ts";
import { circularDistance, rupturePolicyFor, wrapAngle } from "../../engine/simulator.ts";

export const TORUS_DISPLAY_EXCURSION_CAP = 1.5;
export const TORUS_DISPLAY_DEBT_CAP = 2;

export type DisplayExcursion = {
  ratio: number;
  plottedRatio: number;
  offScale: boolean;
};

export type TorusGeometryRegime = "healthy" | "fragile" | "hysteretic" | "collapse";
export type RadialDirection = "Contraction" | "Neutral" | "Expansion";

export function phaseStageFor(angle: number, stages: string[]) {
  if (stages.length === 0) return { index: 0, label: "Unspecified stage" };
  const index = Math.min(
    stages.length - 1,
    Math.floor((wrapAngle(angle) / (Math.PI * 2)) * stages.length),
  );
  return { index, label: stages[index] };
}

export function radialDirectionFor(radialVelocity: number, tolerance = 0.01): RadialDirection {
  if (radialVelocity > tolerance) return "Expansion";
  if (radialVelocity < -tolerance) return "Contraction";
  return "Neutral";
}

/**
 * A deterministic visual encoding of already-simulated state. These values
 * shape the educational torus; they are not an additional dynamics model or
 * a claim that the paper specifies one unique three-dimensional deformation.
 */
export type TorusGeometryState = {
  regime: TorusGeometryRegime;
  regimeLabel: string;
  tone: "stable" | "warning" | "danger";
  excursionRatio: number;
  debtPressure: number;
  cumulativeLoss: number;
  debtSeverity: number;
  debtWarp: number;
  lossScar: number;
  tubeScale: number;
  recurrenceIntegrity: number;
  recurrenceLabel: string;
  memoryPersists: boolean;
  debtDirection: "rising" | "repaying" | "holding";
  summary: string;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function saturatingSeverity(ratio: number) {
  return clamp01(1 - Math.exp(-Math.max(0, ratio) * 0.7));
}

export function deriveTorusGeometry(
  frames: SimulationFrame[],
  frameIndex: number,
  params: SimulationParameters,
  ruptureOverrides: Partial<RupturePolicy> = {},
): TorusGeometryState {
  if (frames.length === 0) throw new RangeError("At least one frame is required to derive torus geometry.");

  const index = Math.max(0, Math.min(frameIndex, frames.length - 1));
  const frame = frames[index];
  let peakRho = frame.rho;
  let peakDebt = frame.debt;
  for (let historyIndex = 0; historyIndex <= index; historyIndex += 1) {
    peakRho = Math.max(peakRho, frames[historyIndex].rho);
    peakDebt = Math.max(peakDebt, frames[historyIndex].debt);
  }
  const policy = rupturePolicyFor(params, ruptureOverrides);
  const excursionRatio = frame.rho / Math.max(params.rhoCrit, Number.EPSILON);
  const debtRatio = frame.debt / Math.max(policy.debtThreshold, Number.EPSILON);
  const lossRatio = frame.cumulativeIrreversibleLoss / Math.max(policy.cumulativeLossThreshold, Number.EPSILON);
  const debtPressure = Math.max(0, params.chi * frame.debt);
  const liveScale = Math.max(0.1, Math.abs(frame.divergence), Math.abs(frame.correction));
  const debtPressureRatio = debtPressure / liveScale;
  const debtSeverity = clamp01(saturatingSeverity(debtRatio) * 0.7 + saturatingSeverity(debtPressureRatio) * 0.3);
  const lossScar = saturatingSeverity(lossRatio);
  const boundarySeverity = clamp01((excursionRatio - 0.25) / 0.75);
  const marginSeverity = frame.debtAdjustedMargin < 0
    ? clamp01(Math.abs(frame.debtAdjustedMargin) / liveScale)
    : 0;
  const fragility = Math.max(boundarySeverity, debtSeverity * 0.8, lossScar * 0.62, marginSeverity * 0.72);
  const terminal = frame.viabilityState === "Irreversible rupture";
  const tubeScale = terminal ? 0.38 : Math.max(0.48, 1 - fragility * 0.34 - lossScar * 0.16);
  const recurrenceIntegrity = terminal ? 0 : Math.max(0.16, 1 - fragility * 0.34 - lossScar * 0.38);
  const debtWarp = debtSeverity * 0.24;
  const earlierStateHasEased = frame.rho < peakRho - Math.max(0.04, params.rhoCrit * 0.025)
    || frame.debt < peakDebt - 0.04
    || frame.debtVelocity < -0.005;
  const memoryPersists = !terminal
    && earlierStateHasEased
    && (debtSeverity >= 0.2 || lossScar >= 0.2);
  const debtDirection = frame.debtVelocity > 0.005
    ? "rising"
    : frame.debtVelocity < -0.005
      ? "repaying"
      : "holding";

  let regime: TorusGeometryRegime;
  if (terminal) regime = "collapse";
  else if (lossScar >= 0.45 || (memoryPersists && debtSeverity >= 0.35)) regime = "hysteretic";
  else if (fragility >= 0.24 || frame.status !== "Stable") regime = "fragile";
  else regime = "healthy";

  const regimeLabel = {
    healthy: "Healthy recurrence",
    fragile: "Fragile · thinning tube",
    hysteretic: "Hysteretic · memory-shaped",
    collapse: "Collapse · no invariant torus",
  }[regime];
  const tone = regime === "healthy" ? "stable" : regime === "collapse" ? "danger" : "warning";
  const recurrenceLabel = terminal
    ? "Lost"
    : recurrenceIntegrity >= 0.72
      ? "Coherent"
      : recurrenceIntegrity >= 0.42
        ? "Strained"
        : "Weak";

  let summary: string;
  if (regime === "collapse") {
    summary = "The terminal policy has latched, so the model-linked view no longer renders a coherent invariant torus. Later improvement cannot erase that recorded terminal history.";
  } else if (regime === "hysteretic") {
    summary = `${memoryPersists ? "Current excursion or debt has eased from an earlier peak, but " : "Path-dependent memory remains because "}debt Δ=${frame.debt.toFixed(3)} and cumulative loss ΣΛ=${frame.cumulativeIrreversibleLoss.toFixed(3)} still shape the view. Debt deformation can relax only as debt is repaid; the loss scar does not reverse within this run.`;
  } else if (regime === "fragile") {
    summary = `The viable tube is visually thinner while excursion is ${(excursionRatio * 100).toFixed(1)}% of ρcrit, debt pressure χΔ=${debtPressure.toFixed(3)}, and cumulative loss ΣΛ=${frame.cumulativeIrreversibleLoss.toFixed(3)}. The geometry is strained but modeled recurrence remains present.`;
  } else {
    summary = `The recurrence tube remains coherent: excursion is ${(excursionRatio * 100).toFixed(1)}% of ρcrit, debt pressure χΔ=${debtPressure.toFixed(3)}, and little irreversible scarring is visible at this frame.`;
  }

  return {
    regime,
    regimeLabel,
    tone,
    excursionRatio,
    debtPressure,
    cumulativeLoss: frame.cumulativeIrreversibleLoss,
    debtSeverity,
    debtWarp,
    lossScar,
    tubeScale,
    recurrenceIntegrity,
    recurrenceLabel,
    memoryPersists,
    debtDirection,
    summary,
  };
}

export function displayExcursion(
  rho: number,
  rhoCrit: number,
  cap = TORUS_DISPLAY_EXCURSION_CAP,
): DisplayExcursion {
  const safeCap = Math.max(Number.EPSILON, cap);
  const ratio = rhoCrit > 0 ? Math.max(0, rho / rhoCrit) : safeCap;
  return {
    ratio,
    plottedRatio: Math.min(safeCap, ratio),
    offScale: ratio > safeCap,
  };
}

export function displayDebt(
  debt: number,
  cap = TORUS_DISPLAY_DEBT_CAP,
) {
  return Math.min(Math.max(Number.EPSILON, cap), Math.max(0, debt));
}

export function nearestFrameForUnwrappedPoint(
  frames: SimulationFrame[],
  targetTheta: number,
  targetPhi: number,
  endIndex = frames.length - 1,
  phiSelector: (frame: SimulationFrame) => number | undefined = (frame) => frame.phi,
) {
  if (frames.length === 0) return 0;
  const end = Math.max(0, Math.min(endIndex, frames.length - 1));
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= end; index += 1) {
    const frame = frames[index];
    const phi = phiSelector(frame);
    if (phi === undefined) continue;
    const thetaDistance = circularDistance(frame.theta, targetTheta);
    const phiDistance = circularDistance(phi, targetPhi);
    const distance = thetaDistance * thetaDistance + phiDistance * phiDistance;
    if (
      distance < bestDistance - Number.EPSILON ||
      (Math.abs(distance - bestDistance) <= Number.EPSILON && index > bestIndex)
    ) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  return bestIndex;
}

export function createSignedDifferenceFrames(
  left: SimulationFrame[],
  right: SimulationFrame[],
) {
  const length = Math.min(left.length, right.length);
  return Array.from({ length }, (_, index) => ({
    ...left[index],
    alignment: left[index].alignment - right[index].alignment,
    debt: left[index].debt - right[index].debt,
    rho: left[index].rho - right[index].rho,
  }));
}

export function timeSeriesScales(
  frames: SimulationFrame[],
  params: SimulationParameters,
) {
  return {
    alignment: 1,
    debt: Math.max(1, ...frames.map((frame) => frame.debt)),
    rho: Math.max(params.rhoCrit, ...frames.map((frame) => frame.rho)),
  };
}

export function signedDifferenceScale(frames: SimulationFrame[]) {
  let maxAbsolute = 0;
  for (const frame of frames) {
    maxAbsolute = Math.max(
      maxAbsolute,
      Math.abs(frame.alignment),
      Math.abs(frame.debt),
      Math.abs(frame.rho),
    );
  }
  return Math.max(0.001, maxAbsolute);
}

export function signedDifferenceMetricScales(frames: SimulationFrame[]) {
  const maximum = (select: (frame: SimulationFrame) => number) => Math.max(0.001, ...frames.map((frame) => Math.abs(select(frame))));
  return {
    alignment: maximum((frame) => frame.alignment),
    debt: maximum((frame) => frame.debt),
    rho: maximum((frame) => frame.rho),
  };
}

export function phaseAnalysisAvailable(frameIndex: number, frameCount: number) {
  return frameCount > 0 && frameIndex >= frameCount - 1;
}
