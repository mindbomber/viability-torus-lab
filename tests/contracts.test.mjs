import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PUBLIC_EXECUTION_LIMITS } from "../contracts/constants.ts";
import { ContractError, compareExperiments, runExperiment, sweepParameters } from "../contracts/experiments.ts";
import { validateScenarioProposal } from "../contracts/proposals.ts";
import { scenarioDefinitionSchema } from "../contracts/schemas.ts";
import { MODEL_VERSION, simulate } from "../engine/simulator.ts";
import { scenarios } from "../scenarios/catalog.ts";

test("every published scenario conforms to the versioned scenario contract", () => {
  for (const scenario of scenarios) assert.equal(scenarioDefinitionSchema.safeParse(scenario).success, true, scenario.id);
});

test("every published scenario discloses its evidence and calibration status", () => {
  for (const scenario of scenarios) {
    assert.equal(scenario.evidence.status, "illustrative", scenario.id);
    assert.match(scenario.evidence.calibrationStatus, /uncalibrated/i, scenario.id);
    assert.match(scenario.evidence.parameterUnits, /dimensionless synthetic/i, scenario.id);
    assert.ok(scenario.evidence.assumptions.length > 0, scenario.id);
    assert.ok(scenario.evidence.falsificationCriteria.length > 0, scenario.id);
    assert.ok(scenario.evidence.references.length > 0, scenario.id);
  }
});

test(`all scenario stress references remain stable for ${MODEL_VERSION}`, () => {
  const references = {
    "llm-deployment": ["0.195145", "3.261498", "1.634010", "Debt accumulating", undefined],
    "coding-agent": ["0.453329", "1.170110", "0.791138", "Fragile", undefined],
    "startup-growth": ["0.122725", "4.412298", "2.097807", "Debt accumulating", undefined],
    "hospital-throughput": ["0.137303", "4.133804", "1.985568", "Rupture approaching", undefined],
    "burnout-recovery": ["0.195145", "3.261498", "1.634010", "Debt accumulating", undefined],
    "fishery-management": ["0.068987", "5.841591", "2.673842", "Ruptured", 862],
  };
  for (const scenario of scenarios) {
    const preset = scenario.presets.find((candidate) => candidate.name === "Growth at risk");
    assert.ok(preset, `${scenario.id} is missing the reference preset`);
    const summary = simulate({ ...scenario.defaults, ...preset.values }).summary;
    const [alignment, debt, maxRho, finalStatus, ruptureStep] = references[scenario.id];
    assert.equal(summary.finalAlignment.toFixed(6), alignment, scenario.id);
    assert.equal(summary.finalDebt.toFixed(6), debt, scenario.id);
    assert.equal(summary.maxRho.toFixed(6), maxRho, scenario.id);
    assert.equal(summary.finalStatus, finalStatus, scenario.id);
    assert.equal(summary.ruptureStep, ruptureStep, scenario.id);
  }
});

test("experiment runner is deterministic and aggregates an ensemble", () => {
  const spec = {
    schemaVersion: "1.0.0",
    scenarioId: "llm-deployment",
    parameters: { steps: 120, pressure: 1.3 },
    seeds: [11, 12, 13],
  };
  const first = runExperiment(spec);
  const second = runExperiment(spec);
  assert.deepEqual(first, second);
  assert.equal(first.ensemble.runCount, 3);
  assert.equal(first.runs.length, 3);
  assert.equal(first.runs[0].frames, undefined);
  assert.match(first.experimentId, /^vtl-[0-9a-f]{8}$/);
  assert.equal(first.evidence.kind, "synthetic-model");
  assert.match(first.evidence.calibrationStatus, /uncalibrated/i);
});

test("frames are opt-in and bounded through sampling", () => {
  const result = runExperiment({
    scenarioId: "llm-deployment",
    parameters: { steps: 600 },
    includeFrames: true,
  }, { ...PUBLIC_EXECUTION_LIMITS, maxReturnedFramesPerRun: 25 });
  assert.ok(result.runs[0].frames.length <= 25);
  assert.ok(result.runs[0].returnedFrameStride >= 24);
  assert.equal(result.runs[0].frames.at(-1).step, 599);
});

test("unknown fields and public execution overages return contract errors", () => {
  assert.throws(() => runExperiment({ scenarioId: "llm-deployment", surprise: true }), ContractError);
  assert.throws(() => runExperiment({ scenarioId: "llm-deployment", parameters: { steps: 6_000 } }, PUBLIC_EXECUTION_LIMITS), /execution limits/i);
  assert.throws(() => runExperiment({ scenarioId: "llm-deployment", parameters: { rho0: 2.5, rhoCrit: 2.5 } }), (error) => error instanceof ContractError && error.issues.some((issue) => /rho0 must remain below rhoCrit/i.test(issue.message)));
  assert.throws(() => runExperiment({ scenarioId: "llm-deployment", parameters: { steps: 1_001, dt: 10 }, seeds: Array.from({ length: 50 }, (_, index) => index) }, PUBLIC_EXECUTION_LIMITS), (error) => error instanceof ContractError && error.issues.some((issue) => /integration-step work budget/i.test(issue.message)));
});

test("intervention sequences are validated as cumulative parameter states", () => {
  assert.throws(() => runExperiment({
    scenarioId: "llm-deployment",
    parameters: { steps: 100, rho0: 0.35, rhoCrit: 0.5 },
    interventions: [
      { id: "raise-reference", label: "Raise reference", step: 10, cost: 0, effects: { rho0: 0.49 } },
      { id: "narrow-boundary", label: "Narrow boundary", step: 20, cost: 0, effects: { rhoCrit: 0.4 } },
    ],
  }), (error) => error instanceof ContractError && error.issues.some((issue) => issue.path.includes("interventions.1.effects.rho0") && /rho0 must remain below rhoCrit/i.test(issue.message)));
});

test("comparison reports signed ensemble differences", () => {
  const result = compareExperiments({
    left: { scenarioId: "llm-deployment", parameters: { steps: 120, pressure: 2.5, error: 0.8, feedback: 0.2, correction: 0.2 } },
    right: { scenarioId: "llm-deployment", parameters: { steps: 120, pressure: 1.1, error: 0.2, feedback: 0.85, correction: 0.7 } },
  });
  assert.ok(result.difference.meanFinalAlignment < 0);
  assert.ok(result.difference.meanFinalDebt > 0);
});

test("parameter sweeps are ranked and bounded", () => {
  const result = sweepParameters({
    base: { scenarioId: "llm-deployment", parameters: { steps: 120 }, seeds: [1, 2] },
    grid: { pressure: [1, 2], feedback: [0.4, 0.8], correction: [0.4, 0.7] },
    topK: 4,
  });
  assert.equal(result.candidatesTested, 8);
  assert.equal(result.results.length, 4);
  assert.equal(result.results[0].rank, 1);
  assert.ok(result.results[0].ensemble.ruptureRate <= result.results.at(-1).ensemble.ruptureRate);
});

test("reference draft scenario passes evidence checks but is never auto-publishable", async () => {
  const proposal = JSON.parse(await readFile(resolve("proposals/social-platform.draft.json"), "utf8"));
  const result = validateScenarioProposal(proposal);
  assert.equal(result.valid, true);
  assert.equal(result.publishable, false);
  assert.equal(result.evaluations.length, 3);
  assert.ok(result.evaluations.every((evaluation) => evaluation.passed));
});

test("generated JSON Schema catalog is valid JSON with stable ids", async () => {
  const index = JSON.parse(await readFile(resolve("public/schemas/v1/index.json"), "utf8"));
  assert.equal(index.schemaVersion, "1.0.0");
  assert.equal(index.schemas.length, 7);
  for (const item of index.schemas) {
    const schema = JSON.parse(await readFile(resolve(`public${item.url}`), "utf8"));
    assert.match(schema.$id, /\/schemas\/v1\/.+\.schema\.json$/);
  }
});
