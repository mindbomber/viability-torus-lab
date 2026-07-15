import test from "node:test";
import assert from "node:assert/strict";
import { GET as getModel } from "../app/api/v1/model/route.ts";
import { GET as getScenarios } from "../app/api/v1/scenarios/route.ts";
import { GET as getSystems } from "../app/api/v1/systems/route.ts";
import { GET as getTemplates } from "../app/api/v1/system-templates/route.ts";
import { GET as getScenarioModules } from "../app/api/v1/scenario-modules/route.ts";
import { GET as getInterventions } from "../app/api/v1/interventions/route.ts";
import { GET as getLaboratory } from "../app/api/v1/laboratory/route.ts";
import { POST as simulate } from "../app/api/v1/simulate/route.ts";
import { POST as sweep } from "../app/api/v1/sweep/route.ts";
import { GET as reproducePaper } from "../app/api/v1/research/paper/route.ts";
import { POST as analyzeTelemetry } from "../app/api/v1/telemetry/route.ts";
import { POST as analyzeEmpirical } from "../app/api/v1/empirical/analyze/route.ts";
import { POST as aggregateEmpirical } from "../app/api/v1/empirical/aggregate/route.ts";
import { createSyntheticRegistryDemo } from "../empirical/registry-demo.ts";
import { scenarioById } from "../scenarios/catalog.ts";
import { empiricalResearchFixture } from "./fixtures/empirical.mjs";

test("model and scenario endpoints expose versioned machine metadata", async () => {
  const modelResponse = getModel(new Request("https://example.test/api/v1/model"));
  assert.equal(modelResponse.status, 200);
  assert.equal(modelResponse.headers.get("X-VTL-Contract-Version"), "1.0.0");
  const model = await modelResponse.json();
  assert.equal(model.endpoints.mcp, "https://example.test/mcp");
  assert.equal(model.endpoints.empiricalAnalyze, "https://example.test/api/v1/empirical/analyze");
  assert.equal(model.endpoints.empiricalAggregate, "https://example.test/api/v1/empirical/aggregate");
  assert.equal(model.endpoints.systems, "https://example.test/api/v1/systems");
  assert.equal(model.endpoints.laboratory, "https://example.test/api/v1/laboratory");
  assert.equal(model.systemTemplateCount, 8);
  assert.equal(model.scenarioModuleCount, 5);
  assert.equal(model.interventionDefinitionCount, 6);
  assert.equal(model.interventionPlanCount, 8);
  assert.match(model.empiricalResearchAccess.httpApi, /disabled by default/i);

  const scenarioResponse = getScenarios(new Request("https://example.test/api/v1/scenarios?category=AI"));
  const catalog = await scenarioResponse.json();
  assert.ok(catalog.scenarios.length >= 2);
  assert.ok(catalog.scenarios.every((scenario) => scenario.category === "AI"));
  assert.equal(catalog.total, 32);
  assert.deepEqual(catalog.watchlistCounts, { red: 4, orange: 22, yellow: 6 });
  assert.equal(catalog.featuredSystemCount, 10);
  assert.equal(catalog.catalogModel, "system-template → bounded-system → scenario-module → intervention-plan → run-assessment");
  assert.ok(catalog.systems.every((scenario) => scenario.system?.templateId && scenario.protocols.length >= 5 && scenario.watchlistTier && scenario.currentStateEstimate?.asOfDate));

  const redResponse = getScenarios(new Request("https://example.test/api/v1/scenarios?tier=red"));
  const redCatalog = await redResponse.json();
  assert.equal(redCatalog.count, 4);
  assert.ok(redCatalog.scenarios.every((scenario) => scenario.watchlistTier === "red"));

  const systemsResponse = getSystems(new Request("https://example.test/api/v1/systems?featured=true"));
  const systemsCatalog = await systemsResponse.json();
  assert.equal(systemsCatalog.count, 10);
  assert.ok(systemsCatalog.systems.every((system) => system.featured));

  const [templates, modules, interventions, laboratory] = await Promise.all([
    getTemplates().json(), getScenarioModules().json(), getInterventions().json(), getLaboratory().json(),
  ]);
  assert.equal(templates.count, 8);
  assert.ok(templates.templates.every((template) => template.systemCount > 0));
  assert.equal(modules.count, 5);
  assert.equal(interventions.definitionCount, 6);
  assert.equal(interventions.planCount, 8);
  assert.equal(laboratory.catalogModel, catalog.catalogModel);
  assert.equal(laboratory.systems.length, 32);
});

test("simulation endpoint validates and executes a bounded ensemble", async () => {
  const response = await simulate(new Request("https://example.test/api/v1/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: "llm-deployment", parameters: { steps: 60 }, seeds: [1, 2, 3] }),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ensemble.runCount, 3);
  assert.equal(result.protocol.id, "llm-deployment-default");
  assert.equal(result.runs[0].frames, undefined);
});

test("simulation endpoint can execute an attached named protocol", async () => {
  const response = await simulate(new Request("https://example.test/api/v1/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: "llm-deployment", protocolId: "llm-deployment-early-correction", parameters: { steps: 60 } }),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.system.id, "llm-deployment");
  assert.equal(result.protocol.id, "llm-deployment-early-correction");
  assert.equal(result.configuration.protocolId, result.protocol.id);
});

test("simulation endpoint composes reusable scenario and intervention modules", async () => {
  const response = await simulate(new Request("https://example.test/api/v1/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemId: "llm-deployment", protocolId: "compound-stress", interventionPlanId: "layered-correction", parameters: { steps: 160 }, seeds: [31] }),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.template.id, "capability-correction");
  assert.equal(result.protocol.id, "llm-deployment-compound-stress");
  assert.equal(result.interventionPlan.id, "layered-correction");
  assert.ok(result.configuration.interventions.length >= 5);
  assert.ok(result.configuration.interventions.every((event) => event.definitionId));
});

test("public endpoints reject unknown fields and oversized sweeps", async () => {
  const invalid = await simulate(new Request("https://example.test/api/v1/simulate", {
    method: "POST",
    body: JSON.stringify({ scenarioId: "llm-deployment", arbitrary: "no" }),
  }));
  assert.equal(invalid.status, 422);
  const invalidBody = await invalid.json();
  assert.ok(invalidBody.issues.some((issue) => issue.message.includes("Unrecognized key")));

  const values = Array.from({ length: 20 }, (_, index) => index / 10);
  const oversized = await sweep(new Request("https://example.test/api/v1/sweep", {
    method: "POST",
    body: JSON.stringify({ base: { scenarioId: "llm-deployment", parameters: { steps: 10 } }, grid: { pressure: values, correction: values } }),
  }));
  assert.equal(oversized.status, 422);
});

test("empirical aggregation API shares opt-in authentication and returns only a redacted descriptive summary", async () => {
  const keys = ["VTL_ENABLE_EMPIRICAL_API", "VTL_EMPIRICAL_API_TOKEN", "VTL_EMPIRICAL_API_ORIGIN"];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    const receipts = createSyntheticRegistryDemo(scenarioById["llm-deployment"]);
    const disabled = await aggregateEmpirical(new Request("https://example.test/api/v1/empirical/aggregate", { method: "POST", body: JSON.stringify({ receipts }) }));
    assert.equal(disabled.status, 403);
    process.env.VTL_ENABLE_EMPIRICAL_API = "true";
    process.env.VTL_EMPIRICAL_API_TOKEN = "research-token";
    const unauthorized = await aggregateEmpirical(new Request("https://example.test/api/v1/empirical/aggregate", { method: "POST", body: JSON.stringify({ receipts }) }));
    assert.equal(unauthorized.status, 401);
    const response = await aggregateEmpirical(new Request("https://example.test/api/v1/empirical/aggregate", {
      method: "POST",
      headers: { Authorization: "Bearer research-token", "Content-Type": "application/json" },
      body: JSON.stringify({ receipts }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-VTL-Raw-Input-Logging"), "disabled");
    const summary = await response.json();
    assert.equal(summary.kind, "empirical-evidence-registry-summary");
    assert.equal(summary.cohort.compatibleObservedStudies, 2);
    assert.match(summary.interpretationBoundary, /not a meta-analysis/i);
    assert.equal("data" in summary, false);
  } finally {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  }
});

test("research endpoints reproduce archived fixtures and analyze imported telemetry", async () => {
  const paperResponse = await reproducePaper(new Request("https://example.test/api/v1/research/paper?case=stable-periodic"));
  assert.equal(paperResponse.status, 200);
  const paper = await paperResponse.json();
  assert.equal(paper.engineVersion, "paper-2026-legacy");
  assert.equal(paper.matchesArchive, true);
  assert.equal(paper.frames, undefined);

  const samples = Array.from({ length: 160 }, (_, index) => ({
    time: index * 0.2,
    mismatch: 0.5 + 0.25 * Math.cos(index * Math.PI / 20),
  }));
  const telemetryResponse = await analyzeTelemetry(new Request("https://example.test/api/v1/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: { name: "test", units: "mismatch", provenance: "deterministic API test fixture" }, samples }),
  }));
  assert.equal(telemetryResponse.status, 200);
  const telemetry = await telemetryResponse.json();
  assert.equal(telemetry.samples.length, 160);
  assert.equal(telemetry.evidence.empiricalValidation, false);
});

test("empirical API is opt-in, bearer-token protected, privacy-gated, and request-only", async () => {
  const keys = ["VTL_ENABLE_EMPIRICAL_API", "VTL_EMPIRICAL_API_TOKEN", "VTL_EMPIRICAL_API_ORIGIN", "VTL_ALLOW_SENSITIVE_EMPIRICAL_DATA"];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    const { request } = empiricalResearchFixture({ privacy: { remoteProcessingAuthorized: true } });
    const disabled = await analyzeEmpirical(new Request("https://example.test/api/v1/empirical/analyze", {
      method: "POST",
      body: JSON.stringify(request),
    }));
    assert.equal(disabled.status, 403);
    assert.equal((await disabled.json()).error.code, "EMPIRICAL_API_DISABLED");

    process.env.VTL_ENABLE_EMPIRICAL_API = "true";
    process.env.VTL_EMPIRICAL_API_TOKEN = "research-token";
    process.env.VTL_EMPIRICAL_API_ORIGIN = "https://research.example";
    const unauthorized = await analyzeEmpirical(new Request("https://example.test/api/v1/empirical/analyze", {
      method: "POST",
      body: JSON.stringify(request),
    }));
    assert.equal(unauthorized.status, 401);

    const response = await analyzeEmpirical(new Request("https://example.test/api/v1/empirical/analyze", {
      method: "POST",
      headers: {
        Authorization: "Bearer research-token",
        "Content-Type": "application/json",
        Origin: "https://research.example",
      },
      body: JSON.stringify(request),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://research.example");
    assert.equal(response.headers.get("X-VTL-Data-Retention"), "request-only");
    assert.equal(response.headers.get("X-VTL-Raw-Input-Logging"), "disabled");
    const result = await response.json();
    assert.equal(result.processing.mode, "http-api");
    assert.equal(result.processing.tokenAuthenticated, true);
    assert.equal(result.receipt.source.rawDataIncluded, false);
    assert.equal(result.receipt.evidence.empiricalValidation, false);

    const sensitive = { ...request, privacy: { ...request.privacy, containsSensitiveData: true, deidentified: false } };
    const rejected = await analyzeEmpirical(new Request("https://example.test/api/v1/empirical/analyze", {
      method: "POST",
      headers: { Authorization: "Bearer research-token", "Content-Type": "application/json" },
      body: JSON.stringify(sensitive),
    }));
    assert.equal(rejected.status, 422);
    assert.ok((await rejected.json()).issues.some((issue) => issue.path === "privacy.deidentified"));
  } finally {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  }
});
