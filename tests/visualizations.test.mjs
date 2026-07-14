import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultParameters,
  deterministicExplanation,
  simulate,
} from "../engine/simulator.ts";
import {
  createSignedDifferenceFrames,
  displayDebt,
  displayExcursion,
  nearestFrameForUnwrappedPoint,
  phaseAnalysisAvailable,
  signedDifferenceScale,
  timeSeriesScales,
} from "../components/charts/visualizationMath.ts";

test("comparison frames preserve signed A minus B values and an exact zero baseline", () => {
  const left = [{ alignment: 0.7, debt: 0.2, rho: 0.8 }];
  const right = [{ alignment: 0.8, debt: 0.1, rho: 1.1 }];
  const [difference] = createSignedDifferenceFrames(left, right);
  assert.ok(Math.abs(difference.alignment - -0.1) < 1e-12);
  assert.ok(Math.abs(difference.debt - 0.1) < 1e-12);
  assert.ok(Math.abs(difference.rho - -0.3) < 1e-12);

  const [zero] = createSignedDifferenceFrames(left, left);
  assert.deepEqual(
    [zero.alignment, zero.debt, zero.rho],
    [0, 0, 0],
  );
  assert.equal(signedDifferenceScale([zero]), 0.001);
});

test("off-scale excursion keeps its real value while clamping display geometry", () => {
  assert.deepEqual(displayExcursion(1.25, 2.5), {
    ratio: 0.5,
    plottedRatio: 0.5,
    offScale: false,
  });
  assert.deepEqual(displayExcursion(60, 2.5), {
    ratio: 24,
    plottedRatio: 1.5,
    offScale: true,
  });
  assert.equal(displayDebt(149.69), 2);
});

test("unwrapped selection uses theta, circular phi distance, and latest-match tie breaking", () => {
  const frames = [
    { theta: 0.1, phi: 6.27 },
    { theta: 3.05, phi: 0.02 },
    { theta: 3.05, phi: 0.02 },
  ];
  assert.equal(
    nearestFrameForUnwrappedPoint(frames, 3.04, 6.28, 2),
    2,
  );
  assert.equal(
    nearestFrameForUnwrappedPoint(frames, 0.11, 0.01, 2),
    0,
  );
});

test("time-series scales disclose the independent debt and excursion domains", () => {
  const frames = [
    { debt: 0.4, rho: 0.8 },
    { debt: 2.4, rho: 4.5 },
  ];
  assert.deepEqual(timeSeriesScales(frames, { rhoCrit: 2.5 }), {
    alignment: 1,
    debt: 2.4,
    rho: 4.5,
  });
});

test("full-run phase diagnostics remain hidden during progressive playback", () => {
  assert.equal(phaseAnalysisAvailable(0, 900), false);
  assert.equal(phaseAnalysisAvailable(898, 900), false);
  assert.equal(phaseAnalysisAvailable(899, 900), true);
});

test("progressive explanation does not reveal a future rupture", () => {
  const parameters = {
    ...defaultParameters,
    pressure: 3,
    error: 1,
    feedback: 0,
    correction: 0,
    drift: 0.5,
    irreversibleLoss: 0.35,
    initialDebt: 2,
  };
  const { frames, summary } = simulate(parameters);
  assert.ok(summary.ruptureStep > 0);
  const initialExplanation = deterministicExplanation(
    frames.slice(0, 1),
    summary,
    { complete: false },
  );
  assert.match(initialExplanation, /final outcome is not yet shown/i);
  assert.doesNotMatch(initialExplanation, /boundary was crossed/i);

  const finalExplanation = deterministicExplanation(frames, summary, {
    complete: true,
  });
  assert.match(finalExplanation, /boundary was crossed/i);
});
