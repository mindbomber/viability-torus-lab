import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultParameters,
  deterministicExplanation,
  explainSimulationFrame,
  simulate,
} from "../engine/simulator.ts";
import {
  createSignedDifferenceFrames,
  displayDebt,
  displayExcursion,
  nearestFrameForUnwrappedPoint,
  phaseAnalysisAvailable,
  signedDifferenceMetricScales,
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
  assert.deepEqual(signedDifferenceMetricScales([difference]), {
    alignment: 0.10000000000000009,
    debt: 0.1,
    rho: 0.30000000000000004,
  });
  assert.deepEqual(signedDifferenceMetricScales([zero]), { alignment: 0.001, debt: 0.001, rho: 0.001 });
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

  const estimatedFrames = [
    { theta: 0.2, phi: 4.8, estimatedPhi: 1.1 },
    { theta: 0.2, phi: 1.1, estimatedPhi: 4.8 },
  ];
  assert.equal(
    nearestFrameForUnwrappedPoint(
      estimatedFrames,
      0.2,
      4.8,
      1,
      (frame) => frame.estimatedPhi,
    ),
    1,
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

test("structured explanation connects active parameters to the current stable frame", () => {
  const { frames, summary } = simulate(defaultParameters);
  const explanation = explainSimulationFrame(frames.slice(0, 1), summary, defaultParameters, { complete: false });
  assert.equal(explanation.statusLabel, "Stable");
  assert.equal(explanation.trajectory.label, "Holding");
  assert.match(explanation.classification, /do not trigger a higher-risk status rule/i);
  assert.match(explanation.balanceSummary, /correction covers immediate divergence/i);
  assert.match(explanation.outcome, /final outcome is not yet shown/i);
  assert.equal(explanation.activeControls.find((control) => control.symbol === "π")?.value, defaultParameters.pressure);
  assert.equal(explanation.balance.find((item) => item.symbol === "C−D−χΔ")?.value, frames[0].debtAdjustedMargin);
});

test("structured explanation follows worsening, boundary, and recovery states without future leakage", () => {
  const parameters = {
    ...defaultParameters,
    steps: 960,
    pressure: 2.35,
    feedback: 0.42,
    correction: 0.42,
    initialDebt: 0.34,
    kappa: 0.22,
    chi: 0.18,
    omegaTheta: 0.12,
  };
  const intervention = {
    id: "recovery",
    label: "Recovery intervention",
    step: 636,
    cost: 1,
    effects: { pressure: 0.82, error: 0.2, feedback: 0.86, correction: 1.02, irreversibleLoss: 0.01, beta: 0.18 },
  };
  const rupturePolicy = {
    irreversibleRho: 3.375,
    cumulativeLossThreshold: 0.5,
    debtThreshold: 1,
    persistenceSteps: 12,
  };
  const { frames, summary } = simulate(parameters, [intervention], { rupturePolicy });

  const worseningIndex = frames.findIndex((frame) => frame.status === "Debt accumulating");
  assert.ok(worseningIndex > 0);
  const worsening = explainSimulationFrame(frames.slice(0, worseningIndex + 1), summary, parameters, { complete: false, interventions: [intervention], rupturePolicy });
  assert.equal(worsening.statusLabel, "Debt accumulating");
  assert.match(worsening.classification, /above the accumulation cutoffs/i);
  assert.match(worsening.balanceSummary, /divergence exceeds correction/i);
  assert.doesNotMatch(worsening.outcome, /finished/i);

  const crossingIndex = summary.boundaryCrossingStep;
  assert.ok(Number.isInteger(crossingIndex));
  const crossing = explainSimulationFrame(frames.slice(0, crossingIndex + 1), summary, parameters, { complete: false, interventions: [intervention], rupturePolicy });
  assert.equal(crossing.statusLabel, "Boundary crossed");
  assert.match(crossing.classification, /not terminal by itself/i);

  const recoveringIndex = frames.findIndex((frame) => frame.step >= intervention.step && frame.status === "Recovering");
  assert.ok(recoveringIndex >= intervention.step);
  const activeParameters = { ...parameters, ...intervention.effects };
  const recovering = explainSimulationFrame(frames.slice(0, recoveringIndex + 1), summary, activeParameters, { complete: false, interventions: [intervention], rupturePolicy });
  assert.equal(recovering.trajectory.label, "Improving");
  assert.ok(recovering.history.some((item) => item.includes("Recovery intervention")));
  assert.match(recovering.balanceSummary, /retains/i);
});

test("structured explanation preserves the terminal latch after late correction", () => {
  const parameters = {
    ...defaultParameters,
    steps: 180,
    pressure: 3,
    error: 1,
    feedback: 0,
    correction: 0,
    drift: 0.5,
    irreversibleLoss: 0.35,
    initialDebt: 2,
  };
  const intervention = {
    id: "late-rescue",
    label: "Late rescue",
    step: 90,
    cost: 1,
    effects: { pressure: 0, error: 0, feedback: 1, correction: 2, drift: 0, irreversibleLoss: 0, beta: 2 },
  };
  const { frames, summary } = simulate(parameters, [intervention]);
  assert.ok(summary.irreversibleRuptureStep < intervention.step);
  const activeParameters = { ...parameters, ...intervention.effects };
  const explanation = explainSimulationFrame(frames, summary, activeParameters, { complete: true, interventions: [intervention] });
  assert.equal(explanation.statusLabel, "Irreversible rupture");
  assert.match(explanation.classification, /remains latched/i);
  assert.match(explanation.threshold.value, /fired at step/i);
  assert.ok(explanation.history.some((item) => item.includes("Late rescue")));
  assert.match(explanation.outcome, /finished in irreversible rupture/i);
});
