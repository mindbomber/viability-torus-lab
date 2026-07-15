import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PUBLIC_EXECUTION_LIMITS } from "../contracts/constants.ts";
import { ContractError, compareExperiments, runExperiment, sweepParameters } from "../contracts/experiments.ts";
import { validateScenarioProposal } from "../contracts/proposals.ts";
import { interventionDefinitionSchema, interventionPlanDefinitionSchema, scenarioDefinitionSchema, scenarioModuleDefinitionSchema, systemTemplateDefinitionSchema } from "../contracts/schemas.ts";
import { MODEL_VERSION, simulate } from "../engine/simulator.ts";
import { scenarios } from "../scenarios/catalog.ts";
import { assessPublishedTorusEligibility } from "../scenarios/eligibility.ts";
import { assessTorusEligibility, buildScenarioProposal, emptyBuilderAnswers } from "../scenarios/builder.ts";
import { composeLaboratoryRun } from "../scenarios/composition.ts";
import { interventionDefinitions, interventionPlans } from "../scenarios/interventions.ts";
import { scenarioModules } from "../scenarios/protocols.ts";
import { systemTemplates } from "../scenarios/templates.ts";

test("every published scenario conforms to the versioned scenario contract", () => {
  for (const scenario of scenarios) assert.equal(scenarioDefinitionSchema.safeParse(scenario).success, true, scenario.id);
});

test("the published systems catalog admits only explicit two-cycle torus mappings", () => {
  for (const scenario of scenarios) {
    const assessment = assessPublishedTorusEligibility(scenario);
    assert.equal(assessment.eligible, true, `${scenario.id}: ${assessment.issues.join(" ")}`);
  }

  const unsupported = structuredClone(scenarios[0]);
  unsupported.cycles.major.stages = ["Undifferentiated state"];
  unsupported.system.cycles.major.stages = ["Undifferentiated state"];
  unsupported.system.phaseEvidence.independenceClaim = "";
  const rejected = assessPublishedTorusEligibility(unsupported);
  assert.equal(rejected.eligible, false);
  assert.ok(rejected.issues.some((issue) => /major phase/i.test(issue)));
  assert.ok(rejected.issues.some((issue) => /independence claim/i.test(issue)));
});

test("every published scenario discloses its evidence and calibration status", () => {
  for (const scenario of scenarios) {
    assert.equal(scenario.evidence.status, "illustrative", scenario.id);
    assert.match(scenario.evidence.calibrationStatus, /uncalibrated/i, scenario.id);
    assert.match(scenario.evidence.parameterUnits, /dimensionless synthetic/i, scenario.id);
    assert.ok(scenario.evidence.assumptions.length > 0, scenario.id);
    assert.ok(scenario.evidence.falsificationCriteria.length > 0, scenario.id);
    assert.ok(scenario.evidence.references.length > 0, scenario.id);
    assert.equal(scenario.currentStateEstimate.basis, "illustrative-current-state-hypothesis", scenario.id);
    assert.equal(scenario.currentStateEstimate.confidence, "low", scenario.id);
    assert.equal(scenario.currentStateEstimate.allModelParametersRevisable, true, scenario.id);
    assert.match(scenario.currentStateEstimate.asOfDate, /^\d{4}-\d{2}-\d{2}$/, scenario.id);
    assert.equal(Object.keys(scenario.currentStateEstimate.parameterProxies).length, 17, scenario.id);
    assert.ok(Object.values(scenario.currentStateEstimate.parameterProxies).every((proxy) => proxy.observable && proxy.normalization && proxy.updateCadence), scenario.id);
  }
});

test(`all bounded-system compound-stress references remain stable for ${MODEL_VERSION}`, () => {
  const references = {
    "climate-biosphere": "5ed531f6b7cf8586", "groundwater-depletion": "91018d6e8e05de3e", "soil-fertility": "a0da1df04b21dd4d", "antimicrobial-resistance": "894dc8f4970ce3ff",
    "information-integrity": "b3a4207bb951513d", "institutional-trust": "888df0ca95cfc5cf", "ai-agent-ecosystems": "50e7568c45cc4f8d", "public-health-preparedness": "746d7c0bd63d7e9a",
    "energy-grid": "1f987bed4292fa9c", "sovereign-debt": "b22a02d46cd53a0b", "semiconductor-supply-chain": "a574d354111b8cfc", "fishery-management": "bfc1826296c80b62",
    "housing-affordability": "04d4036103abeaf5", "youth-mental-health": "35b45e5868821319", "pollinator-collapse": "4eb71eb35aaaf1c7", "education-quality": "b2742617b824449a",
    "healthcare-workforce": "0e7aa04378128fb4", "aging-infrastructure": "08a01c350d691fee", "water-quality": "4e1c4bb42a8e6303", "geopolitical-escalation": "d9bda224ddf45ae0",
    "disaster-insurance": "ee9c165d860a5c63", "data-governance": "802e2549959d7c8a", "llm-deployment": "257ad467e2b354ce", "coding-agent": "2721cf7e14b8170c",
    "startup-growth": "e880f422e92c4067", "hospital-throughput": "c8fd6227ef339e8f", "burnout-recovery": "f43b3672fcbec23d", "public-transit": "859989b48ac1fe01",
    "engagement-recommender": "6a37b29ae0640981", "urban-reservoir": "ba239fcf08bdd507", "emergency-response": "283e5a2502d47ca3", "research-integrity": "89d7dcd9ea579c65",
  };
  for (const scenario of scenarios) {
    const protocol = scenario.protocols.find((candidate) => candidate.id.endsWith("compound-stress"));
    assert.ok(protocol, `${scenario.id} is missing the compound-stress protocol`);
    const summary = simulate(protocol.parameters, [], { rupturePolicy: scenario.rupturePolicy }).summary;
    const fingerprint = createHash("sha256").update(JSON.stringify(summary)).digest("hex").slice(0, 16);
    assert.equal(fingerprint, references[scenario.id], scenario.id);
  }
});

test("the catalog publishes 32 bounded systems with separate derived watchlist and featured metadata", () => {
  assert.equal(scenarios.length, 32);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 32);
  const counts = Object.fromEntries(["red", "orange", "yellow"].map((tier) => [tier, scenarios.filter((scenario) => scenario.watchlistTier === tier).length]));
  assert.deepEqual(counts, { red: 4, orange: 22, yellow: 6 });
  assert.equal(scenarios.filter((scenario) => scenario.featured).length, 10);
  for (const scenario of scenarios) {
    assert.equal(scenario.system.id, scenario.id, scenario.id);
    assert.equal(scenario.system.title, scenario.title, scenario.id);
    assert.ok(scenario.system.operator && scenario.system.boundary && scenario.system.population && scenario.system.horizon && scenario.system.aggregation, scenario.id);
    assert.ok(scenario.protocols.length >= 5, scenario.id);
    assert.equal(scenario.protocols.find((protocol) => protocol.id === scenario.defaultProtocolId)?.parameters, scenario.defaults, scenario.id);
    assert.ok(scenario.protocols.every((protocol) => protocol.systemId === scenario.system.id), scenario.id);
    assert.ok(scenario.protocols.every((protocol) => protocol.templateId === scenario.system.templateId), scenario.id);
    assert.deepEqual(new Set(scenario.protocols.map((protocol) => protocol.moduleId)), new Set(scenarioModules.map((module) => module.id)), scenario.id);
    assert.equal(scenario.cycles.minor.defaultFrequency, scenario.defaults.omegaTheta, scenario.id);
    assert.equal(scenario.cycles.major.defaultFrequency, scenario.defaults.omegaPhi, scenario.id);
    assert.ok(scenario.labels.restoration.length > 2, scenario.id);
    assert.ok(scenario.labels.debtCoupling.length > 2, scenario.id);
    assert.ok(scenario.labels.radialExcursion.length > 2, scenario.id);
    assert.equal(scenario.calibration, "illustrative", scenario.id);
  }
});

test("templates, scenarios, interventions, and plans are reusable first-class contracts", () => {
  assert.equal(systemTemplates.length, 8);
  assert.equal(scenarioModules.length, 5);
  assert.equal(interventionDefinitions.length, 6);
  assert.equal(interventionPlans.length, 8);
  systemTemplates.forEach((item) => assert.equal(systemTemplateDefinitionSchema.safeParse(item).success, true, item.id));
  scenarioModules.forEach((item) => assert.equal(scenarioModuleDefinitionSchema.safeParse(item).success, true, item.id));
  interventionDefinitions.forEach((item) => assert.equal(interventionDefinitionSchema.safeParse(item).success, true, item.id));
  interventionPlans.forEach((item) => assert.equal(interventionPlanDefinitionSchema.safeParse(item).success, true, item.id));

  const untreated = composeLaboratoryRun({ systemId: "llm-deployment", protocolId: "compound-stress", interventionPlanId: "no-action" });
  const corrected = composeLaboratoryRun({ systemId: "llm-deployment", protocolId: "compound-stress", interventionPlanId: "layered-correction" });
  assert.equal(untreated.template.id, "capability-correction");
  assert.equal(untreated.protocol.moduleId, "compound-stress");
  assert.equal(untreated.interventions.length, 0);
  assert.equal(corrected.interventionPlan.id, "layered-correction");
  assert.equal(corrected.interventions.length, 5);
  assert.ok(corrected.interventions.every((event) => event.definitionId && event.planId === "layered-correction"));

  const aquiferStress = composeLaboratoryRun({ systemId: "groundwater-depletion", protocolId: "pressure-surge", interventionPlanId: "visibility-first" });
  const llmStress = composeLaboratoryRun({ systemId: "llm-deployment", protocolId: "pressure-surge", interventionPlanId: "visibility-first" });
  assert.notEqual(aquiferStress.template.id, llmStress.template.id);
  assert.equal(aquiferStress.protocol.moduleId, "pressure-surge");
  assert.equal(llmStress.protocol.moduleId, "pressure-surge");
  assert.deepEqual(aquiferStress.interventions.map((event) => event.definitionId), llmStress.interventions.map((event) => event.definitionId));

  const containment = composeLaboratoryRun({ systemId: "llm-deployment", protocolId: "system-default", interventionPlanId: "temporary-containment" });
  const pauseEvents = containment.interventions.filter((event) => event.definitionId === "pause-optimization");
  assert.equal(pauseEvents.length, 2);
  assert.deepEqual(pauseEvents.map((event) => event.phase), ["start", "end"]);
  assert.ok(pauseEvents[1].step > pauseEvents[0].step);
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
  assert.equal(first.system.id, "llm-deployment");
  assert.equal(first.template.id, "capability-correction");
  assert.equal(first.protocol.id, "llm-deployment-default");
  assert.equal(first.interventionPlan.id, "no-action");
  assert.equal(first.configuration.protocolId, first.protocol.id);
  assert.equal(first.evidence.kind, "synthetic-model");
  assert.match(first.evidence.calibrationStatus, /uncalibrated/i);
});

test("experiment runner selects a named protocol before applying parameter overrides", () => {
  const result = runExperiment({ scenarioId: "llm-deployment", protocolId: "llm-deployment-early-correction", parameters: { steps: 80 } });
  const protocol = scenarios.find((item) => item.id === "llm-deployment").protocols.find((item) => item.id === "llm-deployment-early-correction");
  assert.equal(result.protocol.id, protocol.id);
  assert.equal(result.configuration.parameters.pressure, protocol.parameters.pressure);
  assert.equal(result.configuration.parameters.steps, 80);
  assert.throws(() => runExperiment({ scenarioId: "llm-deployment", protocolId: "climate-biosphere-default" }), /unknown protocol/i);
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

test("legacy v1 draft shapes remain parseable but cannot pass the bounded-system publication gate", async () => {
  const proposal = JSON.parse(await readFile(resolve("proposals/social-platform.draft.json"), "utf8"));
  delete proposal.scenario.system;
  delete proposal.scenario.defaultProtocolId;
  delete proposal.scenario.protocols;
  proposal.scenario.watchlistTier = "featured";
  delete proposal.scenario.featured;
  const result = validateScenarioProposal(proposal);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "scenario.system"));
  assert.ok(result.issues.some((issue) => issue.path === "scenario.protocols"));
});

test("builder requires two independently recurrent observable phases", () => {
  const answers = emptyBuilderAnswers();
  Object.assign(answers, {
    systemName: "Emergency Department",
    template: "human-capacity",
    operator: "Hospital flow, staffing, bed-management, and quality teams",
    boundary: "Emergency arrivals, triage, treatment spaces, staffing, discharge paths, and safety feedback",
    population: "Patients by acuity, families, clinical staff, and the region served",
    horizon: "Three years with daily flow and seasonal demand cycles",
    aggregation: "Safety and access floors by acuity and subgroup before throughput averages",
    category: "Healthcare",
    objective: "Treat urgent patients safely and promptly",
    pressure: "Arrival load and wait-time targets",
    minorCycle: "triage → diagnose → treat → reassess",
    majorCycle: "review demand → revise staffing → evaluate outcomes",
    independentCycles: "Uncertain — needs evidence",
    minorObservation: "Workflow timestamps identify the operational stage",
    majorObservation: "Quarterly demand telemetry tested for recurrent cycles",
    feedback: "Outcome audits and follow-up data",
    misclassification: "Acuity hidden by incomplete intake information",
    correction: "Senior review and surge staffing",
    drift: "Seasonal disease and changing care standards",
    debt: "Unresolved cases, fatigue, and audit backlog",
    irreversibleLoss: "Preventable death or permanent trust loss",
    viableRegion: "Safe outcomes, bounded queues, and sustainable workload",
    shocks: "Demand spike, staffing loss, early surge activation",
    falsification: "The external signal does not recur or the cycles are not dynamically distinct",
  });
  const uncertain = assessTorusEligibility(answers);
  assert.equal(uncertain.eligible, false);
  assert.ok(uncertain.issues.some((issue) => issue.field === "independentCycles"));
  answers.independentCycles = "Yes — independently recurrent";
  assert.equal(assessTorusEligibility(answers).eligible, true);
});

test("builder emits a schema-valid executable draft proposal with objective and pressure kept distinct", () => {
  const answers = emptyBuilderAnswers();
  Object.assign(answers, {
    systemName: "Emergency Department",
    template: "human-capacity",
    operator: "Hospital flow, staffing, bed-management, and quality teams",
    boundary: "Emergency arrivals, triage, treatment spaces, staffing, discharge paths, and safety feedback",
    population: "Patients by acuity, families, clinical staff, and the region served",
    horizon: "Three years with daily flow and seasonal demand cycles",
    aggregation: "Safety and access floors by acuity and subgroup before throughput averages",
    category: "Healthcare",
    objective: "Treat urgent patients safely and promptly",
    pressure: "Arrival load and wait-time targets",
    minorCycle: "triage → diagnose → treat → reassess",
    majorCycle: "review demand → revise staffing → evaluate outcomes",
    independentCycles: "Yes — independently recurrent",
    minorObservation: "Workflow timestamps identify the operational stage",
    majorObservation: "Quarterly demand telemetry with spectral and cycle-count gates",
    feedback: "Outcome audits and follow-up data",
    misclassification: "Acuity hidden by incomplete intake information",
    correction: "Senior review and surge staffing",
    drift: "Seasonal disease and changing care standards",
    debt: "Unresolved cases, fatigue, and audit backlog",
    irreversibleLoss: "Preventable death or permanent trust loss",
    viableRegion: "Safe outcomes, bounded queues, and sustainable workload",
    shocks: "Demand spike, staffing loss, early surge activation",
    falsification: "The external signal does not recur or the cycles are not dynamically distinct",
  });
  const proposal = buildScenarioProposal(answers);
  assert.equal(scenarioDefinitionSchema.safeParse(proposal.scenario).success, true);
  assert.equal(proposal.status, "draft");
  assert.equal(proposal.scenario.optimizedOutcome, answers.objective);
  assert.equal(proposal.scenario.labels.pressure, answers.pressure);
  assert.notEqual(proposal.scenario.optimizedOutcome, proposal.scenario.labels.pressure);
  assert.equal(proposal.scenario.system.operator, answers.operator);
  assert.equal(proposal.scenario.system.boundary, answers.boundary);
  assert.equal(proposal.scenario.system.templateId, "human-capacity");
  assert.equal(proposal.scenario.modelFamily, "human-capacity");
  assert.equal(proposal.scenario.protocols[0].systemId, proposal.scenario.system.id);
  const validation = validateScenarioProposal(proposal);
  assert.equal(validation.valid, true);
  assert.equal(validation.publishable, false);
  assert.equal(validation.evaluations.length, 3);
});

test("generated JSON Schema catalog is valid JSON with stable ids", async () => {
  const index = JSON.parse(await readFile(resolve("public/schemas/v1/index.json"), "utf8"));
  assert.equal(index.schemaVersion, "1.0.0");
  assert.equal(index.schemas.length, 17);
  assert.ok(index.schemas.some((item) => item.name === "system-template"));
  assert.ok(index.schemas.some((item) => item.name === "scenario-module"));
  assert.ok(index.schemas.some((item) => item.name === "intervention-definition"));
  assert.ok(index.schemas.some((item) => item.name === "intervention-plan"));
  assert.ok(index.schemas.some((item) => item.name === "empirical-evidence-bundle"));
  assert.ok(index.schemas.some((item) => item.name === "empirical-research-request"));
  assert.ok(index.schemas.some((item) => item.name === "empirical-research-receipt"));
  assert.ok(index.schemas.some((item) => item.name === "empirical-evidence-registry-request"));
  assert.ok(index.schemas.some((item) => item.name === "empirical-evidence-registry"));
  for (const item of index.schemas) {
    const schema = JSON.parse(await readFile(resolve(`public${item.url}`), "utf8"));
    assert.match(schema.$id, /\/schemas\/v1\/.+\.schema\.json$/);
  }
});
