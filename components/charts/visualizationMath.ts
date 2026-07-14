import type {
  SimulationFrame,
  SimulationParameters,
} from "../../engine/simulator.ts";
import { circularDistance } from "../../engine/simulator.ts";

export const TORUS_DISPLAY_EXCURSION_CAP = 1.5;
export const TORUS_DISPLAY_DEBT_CAP = 2;

export type DisplayExcursion = {
  ratio: number;
  plottedRatio: number;
  offScale: boolean;
};

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
