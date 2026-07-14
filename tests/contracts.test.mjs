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
    "climate-biosphere": ["0.000000", "26.180032", "132.875597", "Ruptured", 8],
    "groundwater-depletion": ["0.000000", "26.180032", "69.055440", "Ruptured", 10],
    "soil-fertility": ["0.000000", "26.180032", "69.055440", "Ruptured", 10],
    "antimicrobial-resistance": ["0.000000", "26.180032", "63.140439", "Ruptured", 10],
    "information-integrity": ["0.000000", "26.180032", "63.140439", "Ruptured", 10],
    "institutional-trust": ["0.000000", "26.180032", "77.492695", "Ruptured", 9],
    "ai-agent-ecosystems": ["0.970446", "0.000000", "0.361145", "Stable", null],
    "public-health-preparedness": ["0.970446", "0.000000", "0.549051", "Stable", null],
    "energy-grid": ["0.970446", "0.000000", "0.704683", "Stable", null],
    "sovereign-debt": ["0.970446", "0.000000", "0.953794", "Stable", null],
    "semiconductor-supply-chain": ["0.970446", "0.000000", "0.704683", "Stable", null],
    "fishery-management": ["0.970446", "0.000000", "0.895283", "Stable", null],
    "housing-affordability": ["0.970446", "0.000000", "0.953794", "Stable", null],
    "youth-mental-health": ["0.970446", "0.000000", "0.549051", "Stable", null],
    "pollinator-collapse": ["0.970446", "0.000000", "0.350000", "Stable", null],
    "education-quality": ["0.970446", "0.000000", "0.350000", "Stable", null],
    "healthcare-workforce": ["0.970446", "0.000000", "0.350000", "Stable", null],
    "aging-infrastructure": ["0.970446", "0.000000", "0.350000", "Stable", null],
    "water-quality": ["0.970446", "0.000000", "0.350000", "Stable", null],
    "geopolitical-escalation": ["0.970446", "0.000000", "0.350000", "Stable", null],
    "disaster-insurance": ["0.970446", "0.000000", "0.350000", "Stable", null],
    "data-governance": ["0.970446", "0.000000", "0.350000", "Stable", null],
    "llm-deployment": ["0.036118", "3.261498", "3.320958", "Ruptured", 631],
    "coding-agent": ["0.247970", "1.170110", "1.394447", "Fragile", null],
    "startup-growth": ["0.001852", "4.412298", "6.291342", "Ruptured", 245],
    "hospital-throughput": ["0.002701", "4.133804", "5.914185", "Ruptured", 198],
    "burnout-recovery": ["0.008801", "3.261498", "4.732842", "Ruptured", 374],
    "public-transit": ["0.002249", "3.261498", "6.097103", "Ruptured", 251],
    "engagement-recommender": ["0.036118", "3.261498", "3.320958", "Ruptured", 631],
    "urban-reservoir": ["0.000139", "3.261498", "8.883904", "Ruptured", 125],
    "emergency-response": ["0.002249", "3.261498", "6.097103", "Ruptured", 251],
    "research-integrity": ["0.000048", "3.261498", "9.937221", "Ruptured", 104],
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
    assert.equal(summary.ruptureStep ?? null, ruptureStep, scenario.id);
  }
});

test("the scenario pack publishes 22 watchlist systems and 10 featured simulations", () => {
  assert.equal(scenarios.length, 32);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 32);
  const counts = Object.fromEntries(["red", "orange", "yellow", "featured"].map((tier) => [tier, scenarios.filter((scenario) => scenario.watchlistTier === tier).length]));
  assert.deepEqual(counts, { red: 6, orange: 8, yellow: 8, featured: 10 });
  for (const scenario of scenarios) {
    assert.equal(scenario.cycles.minor.defaultFrequency, scenario.defaults.omegaTheta, scenario.id);
    assert.equal(scenario.cycles.major.defaultFrequency, scenario.defaults.omegaPhi, scenario.id);
    assert.ok(scenario.labels.restoration.length > 2, scenario.id);
    assert.ok(scenario.labels.debtCoupling.length > 2, scenario.id);
    assert.ok(scenario.labels.radialExcursion.length > 2, scenario.id);
    assert.equal(scenario.calibration, "illustrative", scenario.id);
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
  assert.equal(index.schemas.length, 8);
  for (const item of index.schemas) {
    const schema = JSON.parse(await readFile(resolve(`public${item.url}`), "utf8"));
    assert.match(schema.$id, /\/schemas\/v1\/.+\.schema\.json$/);
  }
});
