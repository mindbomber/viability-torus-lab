import test from "node:test";
import assert from "node:assert/strict";
import {
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

test("phase locking counts as viable without creating a warning", () => {
  const result = simulate({ ...defaultParameters, steps: 720 });
  assert.equal(result.summary.stableFraction, 1);
  assert.equal(result.summary.firstWarningStep, undefined);
  assert.ok(result.frames.some((frame) => frame.status === "Phase locked"));
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

test("status classifier exposes rupture and non-identifiable phase gates", () => {
  assert.equal(classifyStatus(2.6, 0, 0, 0, 0, 2.5, 0, 0, 0.1, 0.05), "Ruptured");
  assert.equal(classifyStatus(0.2, 0, 0.3, 0, 0, 2.5, 0, 0, 0.001, 0.001), "Phase not identifiable");
});
