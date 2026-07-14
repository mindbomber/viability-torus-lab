import test from "node:test";
import assert from "node:assert/strict";
import { GET as getModel } from "../app/api/v1/model/route.ts";
import { GET as getScenarios } from "../app/api/v1/scenarios/route.ts";
import { POST as simulate } from "../app/api/v1/simulate/route.ts";
import { POST as sweep } from "../app/api/v1/sweep/route.ts";

test("model and scenario endpoints expose versioned machine metadata", async () => {
  const modelResponse = getModel(new Request("https://example.test/api/v1/model"));
  assert.equal(modelResponse.status, 200);
  assert.equal(modelResponse.headers.get("X-VTL-Contract-Version"), "1.0.0");
  const model = await modelResponse.json();
  assert.equal(model.endpoints.mcp, "https://example.test/mcp");

  const scenarioResponse = getScenarios(new Request("https://example.test/api/v1/scenarios?category=AI"));
  const catalog = await scenarioResponse.json();
  assert.ok(catalog.scenarios.length >= 2);
  assert.ok(catalog.scenarios.every((scenario) => scenario.category === "AI"));
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
  assert.equal(result.runs[0].frames, undefined);
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
