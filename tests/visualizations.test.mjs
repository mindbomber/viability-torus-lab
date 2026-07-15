import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultParameters,
  deterministicExplanation,
  evaluateRadialBalance,
  explainSimulationFrame,
  neutralCorrectionFor,
  simulate,
} from "../engine/simulator.ts";
import {
  createSignedDifferenceFrames,
  deriveTorusGeometry,
  displayDebt,
  displayExcursion,
  nearestFrameForUnwrappedPoint,
  phaseAnalysisAvailable,
  phaseStageFor,
  radialDirectionFor,
  signedDifferenceMetricScales,
  signedDifferenceScale,
  timeSeriesScales,
} from "../components/charts/visualizationMath.ts";
import {
  finalViabilityOutcomeLabel,
  nextPlaybackFrameIndex,
  viabilityJourneyAt,
} from "../engine/assessment.ts";

test("system-specific phase stages and radial direction map deterministically", () => {
  const stages = ["Sense", "Review", "Correct", "Verify"];
  assert.equal(phaseStageFor(0, stages).label, "Sense");
  assert.equal(phaseStageFor(Math.PI, stages).label, "Correct");
  assert.equal(phaseStageFor(Math.PI * 2 - 0.001, stages).label, "Verify");
  assert.equal(radialDirectionFor(-0.02), "Contraction");
  assert.equal(radialDirectionFor(0.005), "Neutral");
  assert.equal(radialDirectionFor(0.02), "Expansion");
});

test("neutral correction closes the deterministic radial expansion gap", () => {
  const frame = { rho: defaultParameters.rho0, debt: defaultParameters.initialDebt };
  const neutralCorrection = neutralCorrectionFor(frame, defaultParameters);
  const balance = evaluateRadialBalance({
    pressure: defaultParameters.pressure,
    error: defaultParameters.error,
    feedback: defaultParameters.feedback,
    drift: defaultParameters.drift,
    irreversibleLoss: defaultParameters.irreversibleLoss,
    correction: neutralCorrection,
    debt: frame.debt,
    rho: frame.rho,
    kappa: defaultParameters.kappa,
    rho0: defaultParameters.rho0,
    chi: defaultParameters.chi,
  });
  assert.ok(Math.abs(balance.radialRate) < 1e-12);
});

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

test("torus geometry separates excursion, repayable debt warp, persistent loss scars, and collapse", () => {
  const parameters = { ...defaultParameters, irreversibleLoss: 0, steps: 4 };
  const { frames } = simulate(parameters);
  const frame = frames[0];
  const healthy = deriveTorusGeometry(frames, 0, parameters);
  assert.equal(healthy.regime, "healthy");
  assert.equal(healthy.cumulativeLoss, 0);

  const indebtedFrame = {
    ...frame,
    debt: 1.2,
    debtVelocity: 0.08,
    debtAdjustedMargin: -0.2,
    status: "Debt accumulating",
  };
  const indebted = deriveTorusGeometry([indebtedFrame], 0, parameters);
  assert.ok(indebted.debtWarp > healthy.debtWarp);
  assert.ok(indebted.tubeScale < healthy.tubeScale);
  assert.equal(indebted.debtDirection, "rising");

  const repaidFrame = {
    ...indebtedFrame,
    debt: 0.08,
    debtVelocity: -0.08,
    debtAdjustedMargin: 0.1,
    status: "Recovering",
  };
  const repaid = deriveTorusGeometry([indebtedFrame, repaidFrame], 1, parameters);
  assert.ok(repaid.debtWarp < indebted.debtWarp);
  assert.equal(repaid.debtDirection, "repaying");

  const scarredFrame = {
    ...repaidFrame,
    cumulativeIrreversibleLoss: 0.8,
    irreversibleLoss: 0,
    status: "Stable",
  };
  const scarred = deriveTorusGeometry([indebtedFrame, scarredFrame], 1, parameters);
  assert.equal(scarred.regime, "hysteretic");
  assert.ok(scarred.lossScar > healthy.lossScar);
  assert.ok(scarred.tubeScale < healthy.tubeScale);
  assert.equal(scarred.memoryPersists, true);
  assert.match(scarred.summary, /loss scar does not reverse within this run/i);

  const collapsed = deriveTorusGeometry([{
    ...scarredFrame,
    viabilityState: "Irreversible rupture",
    status: "Ruptured",
    ruptureProgress: 0.5,
  }], 0, parameters);
  assert.equal(collapsed.regime, "collapse");
  assert.equal(collapsed.recurrenceIntegrity, 0);
  assert.equal(collapsed.recurrenceLabel, "Lost");
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

test("causal viability journey does not leak future crossings and models recovery as an alternative to rupture", () => {
  const frames = [
    { step: 0, viabilityState: "Viable recurrence", status: "Stable" },
    { step: 1, viabilityState: "Viability-boundary crossing", status: "Warning" },
    { step: 2, viabilityState: "Recoverable excursion", status: "Recovering" },
    { step: 3, viabilityState: "Viable recurrence", status: "Stable" },
  ];
  assert.equal(viabilityJourneyAt(frames, 0).phase, "before-crossing");
  assert.equal(viabilityJourneyAt(frames, 1).phase, "crossing");
  assert.equal(viabilityJourneyAt(frames, 2).phase, "recovery-window");
  assert.equal(viabilityJourneyAt(frames, 3).phase, "recovered");

  const ruptured = [...frames.slice(0, 3), { step: 3, viabilityState: "Irreversible rupture", status: "Ruptured" }];
  const terminalJourney = viabilityJourneyAt(ruptured, 3);
  assert.equal(terminalJourney.phase, "irreversible-rupture");
  assert.equal(terminalJourney.recovered, false);
  assert.equal(terminalJourney.ruptureStep, 3);
});

test("playback stride lands on dynamic status, viability, and intervention transitions", () => {
  const frames = [
    { step: 0, viabilityState: "Viable recurrence", status: "Stable" },
    { step: 1, viabilityState: "Viable recurrence", status: "Stable" },
    { step: 2, viabilityState: "Viable recurrence", status: "Drifting" },
    { step: 3, viabilityState: "Viability-boundary crossing", status: "Warning" },
    { step: 4, viabilityState: "Recoverable excursion", status: "Warning" },
    { step: 5, viabilityState: "Recoverable excursion", status: "Warning" },
  ];
  assert.equal(nextPlaybackFrameIndex(frames, 0, 8), 2);
  assert.equal(nextPlaybackFrameIndex(frames, 2, 8), 3);
  assert.equal(nextPlaybackFrameIndex(frames, 3, 8), 4);
  assert.equal(nextPlaybackFrameIndex(frames, 4, 8, new Set([5])), 5);
});

test("final outcome labels distinguish recovered boundary crossings from irreversible rupture", () => {
  assert.equal(finalViabilityOutcomeLabel({
    ruptureStep: 12,
    boundaryCrossingStep: 12,
    recoveredAfterCrossing: true,
    finalViabilityState: "Viable recurrence",
  }), "Recovered after boundary crossing");
  assert.equal(finalViabilityOutcomeLabel({
    ruptureStep: 12,
    boundaryCrossingStep: 12,
    irreversibleRuptureStep: 18,
    recoveredAfterCrossing: false,
    finalViabilityState: "Irreversible rupture",
  }), "Irreversible rupture");
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
  assert.equal(explanation.trajectory.radialDirection, "Neutral");
  assert.ok(explanation.trajectory.neutralCorrection >= 0);
  assert.match(explanation.trajectory.neutralDetail, /neutral threshold/i);
  assert.match(explanation.classification, /do not trigger a higher-risk status rule/i);
  assert.match(explanation.balanceSummary, /correction covers immediate divergence/i);
  assert.match(explanation.outcome, /final outcome is not yet shown/i);
  assert.equal(explanation.activeControls.find((control) => control.symbol === "π")?.value, defaultParameters.pressure);
  assert.equal(explanation.balance.find((item) => item.symbol === "C−D−χΔ")?.value, frames[0].debtAdjustedMargin);
});

test("five-source attribution separates structure, scenario, overrides, interventions, and memory", () => {
  const systemBaseline = { ...defaultParameters, steps: 24, kappa: 0.22, chi: 0.18 };
  const scenarioParameters = { ...systemBaseline, pressure: systemBaseline.pressure + 0.28, initialDebt: systemBaseline.initialDebt + 0.12 };
  const configuredParameters = { ...scenarioParameters, feedback: 0.7 };
  const intervention = {
    id: "correction-start",
    label: "Increase correction",
    step: 2,
    cost: 1,
    phase: "start",
    effects: { correction: 0.82 },
  };
  const result = simulate(configuredParameters, [intervention]);
  const attribution = {
    system: {
      templateTitle: "Detection and correction",
      systemTitle: "Language model service",
      structureSummary: "An optimizing service bounded by verification, correction, and rollback capacity.",
      baselineParameters: systemBaseline,
      structuralParameterKeys: ["kappa", "chi"],
    },
    scenario: { title: "Pressure surge", kind: "stress", parameters: scenarioParameters },
    configuredParameters,
    interventionPlan: { title: "Correction surge", strategy: "corrective" },
  };

  const before = explainSimulationFrame(result.frames.slice(0, 1), result.summary, configuredParameters, {
    complete: false,
    interventions: [intervention],
    attribution,
  });
  assert.deepEqual(before.sources.map((source) => source.title), [
    "System structure",
    "Scenario pressure",
    "User overrides",
    "Intervention activity",
    "System memory",
  ]);
  assert.match(before.sources[0].state, /detection and correction/i);
  assert.match(before.sources[1].detail, /π 1\.650→1\.930/i);
  assert.match(before.sources[2].detail, /γ 0\.620→0\.700/i);
  assert.match(before.sources[3].state, /next action at step 2/i);
  assert.match(before.attributionBoundary, /not empirical causal identification/i);

  const activeParameters = { ...configuredParameters, correction: 0.82 };
  const after = explainSimulationFrame(result.frames.slice(0, 3), result.summary, activeParameters, {
    complete: false,
    interventions: [intervention],
    attribution,
  });
  assert.match(after.sources[3].state, /1 modeled action active/i);
  assert.match(after.sources[3].detail, /C 0\.460→0\.820/i);
  assert.match(after.sources[4].detail, /χΔ=/i);
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
