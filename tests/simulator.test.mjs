import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzePhaseDynamics,
  circularDistance,
  classifyStatus,
  defaultParameters,
  seededRandom,
  simulate,
  wrapAngle,
} from "../engine/simulator.ts";

test("seeded randomness is deterministic", () => {
  const a = seededRandom(417);
  const b = seededRandom(417);
  assert.deepEqual(Array.from({ length: 20 }, a), Array.from({ length: 20 }, b));
});

test("angles wrap into the canonical 0..2pi interval", () => {
  assert.ok(wrapAngle(-0.1) > 6);
  assert.equal(wrapAngle(Math.PI * 2), 0);
  assert.ok(wrapAngle(Math.PI * 8 + 0.2) < 0.21);
});

test("identical seed and configuration reproduce every frame", () => {
  const first = simulate({ ...defaultParameters, steps: 180 });
  const second = simulate({ ...defaultParameters, steps: 180 });
  assert.deepEqual(first.frames, second.frames);
  assert.deepEqual(first.summary, second.summary);
});

test("phase regime is diagnosed separately from viability status", () => {
  const result = simulate({ ...defaultParameters, steps: 960 });
  assert.equal(result.summary.stableFraction, 1);
  assert.equal(result.summary.firstWarningStep, undefined);
  assert.equal(result.summary.phase.identifiable, true);
  assert.notEqual(result.summary.phase.regime, "Not identifiable");
  assert.ok(result.frames.every((frame) => frame.status === "Stable"));
});

test("short runs do not claim an identifiable external phase", () => {
  const result = simulate({ ...defaultParameters, steps: 100 });
  assert.equal(result.summary.phase.identifiable, false);
  assert.equal(result.summary.phase.reason, "insufficient-cycles");
  assert.ok(result.frames.every((frame) => frame.estimatedPhi === undefined));
});

test("the phase estimator tracks the simulated external phase only after its gates pass", () => {
  const result = simulate({ ...defaultParameters, steps: 960 });
  const errors = result.frames.map((frame) => circularDistance(frame.estimatedPhi, frame.phi));
  const meanError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
  assert.ok(meanError < 0.35, `mean circular error ${meanError}`);
});

test("rational phase locking is symmetric and reports the detected ratio", () => {
  const template = simulate({ ...defaultParameters, steps: 1 }).frames[0];
  const frames = Array.from({ length: 420 }, (_, step) => {
    const phiUnwrapped = 0.22 + step * 0.06;
    const thetaUnwrapped = 0.7 + step * 0.12;
    const phi = wrapAngle(phiUnwrapped);
    return {
      ...template,
      step,
      time: step * 0.25,
      theta: wrapAngle(thetaUnwrapped),
      phi,
      thetaUnwrapped,
      phiUnwrapped,
      externalMismatch: 0.5 + 0.28 * Math.cos(phi) + 0.04 * Math.cos(2 * phi),
    };
  });
  const phase = analyzePhaseDynamics(frames);
  assert.equal(phase.identifiable, true);
  assert.equal(phase.regime, "Phase locked");
  assert.equal(phase.phaseLockingRatio, "2:1");
  assert.ok(phase.phaseLockingValue > 0.999);
});

test("stable reference case remains below the viable boundary", () => {
  const result = simulate({
    ...defaultParameters,
    steps: 600,
    pressure: 1.15,
    error: 0.2,
    feedback: 0.82,
    correction: 0.62,
    initialDebt: 0.05,
  });
  assert.equal(result.summary.ruptureStep, undefined);
  assert.ok(result.summary.maxRho < defaultParameters.rhoCrit);
  assert.ok(result.summary.finalAlignment > 0.75);
});

test("high divergence and debt produce radial expansion and rupture", () => {
  const result = simulate({
    ...defaultParameters,
    steps: 1400,
    pressure: 3,
    error: 0.9,
    feedback: 0.08,
    correction: 0.08,
    drift: 0.3,
    initialDebt: 1.2,
  });
  assert.notEqual(result.summary.ruptureStep, undefined);
  assert.ok(result.summary.finalAlignment < 0.1);
});

test("scheduled intervention changes the active run outcome", () => {
  const stressed = {
    ...defaultParameters,
    steps: 900,
    pressure: 2.55,
    error: 0.58,
    feedback: 0.25,
    correction: 0.2,
    initialDebt: 0.55,
  };
  const baseline = simulate(stressed);
  const corrected = simulate(stressed, [
    {
      id: "early-correction",
      label: "Early correction",
      step: 50,
      cost: 2,
      effects: { pressure: 1.25, feedback: 0.82, correction: 0.78 },
    },
  ]);
  assert.ok(corrected.summary.finalAlignment > baseline.summary.finalAlignment);
  assert.ok(corrected.summary.finalDebt < baseline.summary.finalDebt);
  assert.equal(corrected.summary.interventionCost, 2);
});

test("bounded internal substeps prevent large-dt Euler artifacts", () => {
  const fine = simulate({ ...defaultParameters, steps: 401, dt: 0.25 });
  const coarse = simulate({ ...defaultParameters, steps: 11, dt: 10 });
  assert.equal(fine.frames.at(-1).time, coarse.frames.at(-1).time);
  assert.equal(fine.summary.finalAlignment, coarse.summary.finalAlignment);
  assert.equal(fine.summary.finalDebt, coarse.summary.finalDebt);
  assert.equal(fine.summary.maxRho, coarse.summary.maxRho);
  assert.equal(coarse.summary.ruptureStep, undefined);
});

test("the initial frame is the declared initial state", () => {
  const result = simulate({ ...defaultParameters, steps: 2, rho0: 0.41, initialDebt: 0.73 });
  assert.equal(result.frames[0].rho, 0.41);
  assert.equal(result.frames[0].debt, 0.73);
  assert.equal(result.frames[0].time, 0);
});

test("status classifier reports viability only and invalid radial bounds fail closed", () => {
  assert.equal(classifyStatus(2.6, 0, 0, 0, 0, 2.5), "Ruptured");
  assert.equal(classifyStatus(0.2, 0, 0.3, 0, 0, 2.5), "Stable");
  assert.throws(() => simulate({ ...defaultParameters, rho0: 2.5, rhoCrit: 2.5 }), /rho0 must remain below rhoCrit/i);
});
