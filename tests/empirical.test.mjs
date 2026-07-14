import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONTRACT_VERSION } from "../contracts/constants.ts";
import { empiricalEvidenceBundleSchema } from "../contracts/schemas.ts";
import { MODEL_VERSION } from "../engine/simulator.ts";
import {
  analyzeEmpiricalStudy,
  autoMapEmpiricalColumns,
  empiricalCursorExplanation,
  empiricalRoleDefinitions,
  exampleEmpiricalStudy,
  parseEmpiricalCsv,
} from "../empirical/analysis.ts";
import { scenarioById } from "../scenarios/catalog.ts";
import { analyzeEmpiricalRequest, explainEmpiricalObservation } from "../empirical/headless.ts";
import { materializeEmpiricalCsvResource } from "../empirical/local-resource.ts";
import { empiricalResearchFixture, empiricalCsv } from "./fixtures/empirical.mjs";

test("multi-column empirical CSV parser preserves quoted fields and maps canonical aliases", () => {
  const header = "time,theta_signal,phi_signal,pressure,error,feedback,correction,drift,irreversible_loss,debt,rho,outcome,intervention";
  const rows = Array.from({ length: 8 }, (_, index) => `${index},${Math.sin(index)},${Math.cos(index)},1.2,0.2,0.7,0.5,0.04,0.01,0.2,0.5,inside,\"audit, review\"`);
  const dataset = parseEmpiricalCsv([header, ...rows].join("\n"), "quoted.csv");
  const mapping = autoMapEmpiricalColumns(dataset);
  assert.equal(dataset.rows[0].intervention, "audit, review");
  assert.equal(mapping.thetaSignal.column, "theta_signal");
  assert.equal(mapping.irreversibleLoss.column, "irreversible_loss");
  assert.equal(mapping.rho.column, "rho");
});

test("bundled observed-form study passes two-phase gates and produces a deterministic held-out replay", () => {
  const example = exampleEmpiricalStudy(scenarioById["llm-deployment"]);
  const first = analyzeEmpiricalStudy(example.dataset, example.mapping, example.study, example.assumptions);
  const second = analyzeEmpiricalStudy(example.dataset, example.mapping, example.study, example.assumptions);
  assert.equal(first.torusReplayReady, true);
  assert.equal(first.modelSupport, "provisional");
  assert.deepEqual(first.gates.map((gate) => gate.passed), [true, true, true, true, true]);
  assert.ok(first.phaseRelationship.jointCoverage > 0.5);
  assert.ok(first.phaseRelationship.lockingValue < 0.985);
  assert.ok(first.replay);
  assert.equal(first.replay.holdoutRows, 72);
  assert.ok(first.replay.holdoutRmse > 0);
  assert.ok(first.replay.holdoutIntervalCoverage > 0.8);
  assert.ok(first.replay.points.some((point) => point.statusLabel === "Boundary crossed"));
  assert.ok(first.replay.points.at(-1).rho < first.replay.points.find((point) => point.statusLabel === "Boundary crossed").rho);
  assert.deepEqual(first.replay, second.replay);
});

test("failed recurrence is a valid negative result and withholds the torus replay", () => {
  const example = exampleEmpiricalStudy(scenarioById["llm-deployment"]);
  const flat = {
    ...example.dataset,
    rows: example.dataset.rows.map((row) => ({ ...row, external_cycle_signal: "0.5" })),
  };
  const analysis = analyzeEmpiricalStudy(flat, example.mapping, example.study, example.assumptions);
  assert.equal(analysis.externalPhase.identifiable, false);
  assert.equal(analysis.externalPhase.reason, "low-amplitude");
  assert.equal(analysis.torusReplayReady, false);
  assert.equal(analysis.modelSupport, "not-supported");
  assert.equal(analysis.gates.find((gate) => gate.id === "external-recurrence")?.state, "fail");
});

test("mapping gate rejects undocumented or out-of-range canonical proxies", () => {
  const example = exampleEmpiricalStudy(scenarioById["llm-deployment"]);
  const mapping = structuredClone(example.mapping);
  mapping.feedback.unit = "";
  const invalidRows = example.dataset.rows.map((row, index) => index === 5 ? { ...row, error: "1.4" } : row);
  const analysis = analyzeEmpiricalStudy({ ...example.dataset, rows: invalidRows }, mapping, example.study, example.assumptions);
  assert.equal(analysis.modelSupport, "insufficient-data");
  assert.match(analysis.issues.join(" "), /requires documented units/i);
});

test("cursor explanation reports model attribution, residual, and causal boundary", () => {
  const example = exampleEmpiricalStudy(scenarioById["llm-deployment"]);
  const analysis = analyzeEmpiricalStudy(example.dataset, example.mapping, example.study, example.assumptions);
  const point = analysis.replay.points[96];
  const explanation = empiricalCursorExplanation(point, example.assumptions);
  assert.match(explanation.statement, /declared model attributes/i);
  assert.match(explanation.statement, /observed expansion|observed contraction|observed near-flat movement/i);
  assert.match(explanation.boundary, /not causal identification or empirical validation/i);
  assert.equal(explanation.contributions.length, 5);
});

test("empirical evidence receipt is schema-valid and excludes raw observations", () => {
  const scenario = scenarioById["llm-deployment"];
  const example = exampleEmpiricalStudy(scenario);
  const analysis = analyzeEmpiricalStudy(example.dataset, example.mapping, example.study, example.assumptions);
  const finalPoint = analysis.replay.points.at(-1);
  const bundle = empiricalEvidenceBundleSchema.parse({
    schemaVersion: CONTRACT_VERSION,
    kind: "browser-local-empirical-study",
    modelVersion: MODEL_VERSION,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    exportedAt: "2026-07-14T12:00:00.000Z",
    study: example.study,
    source: {
      name: example.dataset.name,
      kind: example.dataset.sourceKind,
      rows: example.dataset.rows.length,
      columns: example.dataset.headers.length,
      datasetSha256: "a".repeat(64),
      localOnly: true,
      rawDataIncluded: false,
    },
    mapping: empiricalRoleDefinitions.map((definition) => ({ role: definition.role, symbol: definition.symbol, ...example.mapping[definition.role] })),
    assumptions: { ...example.assumptions, provenance: "declared-not-fitted" },
    validation: {
      evidenceLevel: analysis.evidenceLevel,
      modelSupport: analysis.modelSupport,
      torusReplayReady: analysis.torusReplayReady,
      gates: analysis.gates,
      internalPhase: { identifiable: analysis.internalPhase.identifiable, reason: analysis.internalPhase.reason, spectralConcentration: analysis.internalPhase.spectralConcentration, estimatedCycles: analysis.internalPhase.estimatedMajorCycles },
      externalPhase: { identifiable: analysis.externalPhase.identifiable, reason: analysis.externalPhase.reason, spectralConcentration: analysis.externalPhase.spectralConcentration, estimatedCycles: analysis.externalPhase.estimatedMajorCycles },
      phaseRelationship: analysis.phaseRelationship,
    },
    replay: {
      method: analysis.replay.method,
      uncertaintyMethod: analysis.replay.uncertaintyMethod,
      calibrationRows: analysis.replay.calibrationRows,
      holdoutRows: analysis.replay.holdoutRows,
      holdoutRmse: analysis.replay.holdoutRmse,
      holdoutMae: analysis.replay.holdoutMae,
      holdoutIntervalCoverage: analysis.replay.holdoutIntervalCoverage,
      finalStatus: finalPoint.statusLabel,
    },
    limitations: [
      "Raw data are excluded and the original fingerprinted source must be retained separately.",
      "Parameters and transformations are declared rather than automatically fitted in this first release.",
      "Phase diagnostics do not independently establish toroidal topology or domain calibration.",
    ],
  });
  assert.equal(bundle.source.rawDataIncluded, false);
  assert.equal("rows" in bundle && Array.isArray(bundle.rows), false);
});

test("headless empirical engine returns deterministic gates, bounded replay, and a redacted receipt", () => {
  const { request } = empiricalResearchFixture();
  const policy = { mode: "local-mcp", tokenAuthenticated: false, allowSensitiveRemoteData: true, maxReturnedReplayPoints: 80 };
  const first = analyzeEmpiricalRequest(request, policy, "2026-07-14T12:00:00.000Z");
  const second = analyzeEmpiricalRequest(request, policy, "2026-07-14T12:00:00.000Z");
  assert.deepEqual(first, second);
  assert.equal(first.validation.torusReplayReady, true);
  assert.ok(first.replay.returnedPointCount <= 81);
  assert.ok(first.replay.returnedPointStride >= 3);
  assert.equal(first.receipt.kind, "empirical-research-receipt");
  assert.equal(first.receipt.source.rawDataIncluded, false);
  assert.match(first.receipt.source.canonicalTableSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.receipt.processing.retention, "request-only");
  assert.equal(first.receipt.evidence.empiricalValidation, false);
  assert.equal("data" in first, false);
});

test("headless adapters preserve a failed phase gate instead of forcing torus evidence", () => {
  const { request } = empiricalResearchFixture();
  const flatRows = request.data.rows.map((row) => ({ ...row, external_cycle_signal: "0.5" }));
  const result = analyzeEmpiricalRequest({ ...request, data: { ...request.data, rows: flatRows } }, undefined, "2026-07-14T12:00:00.000Z");
  assert.equal(result.validation.torusReplayReady, false);
  assert.equal(result.validation.externalPhase.identifiable, false);
  assert.equal(result.replay.torusInterpretationWithheld, true);
  assert.equal(result.receipt.evidence.modelSupport, "not-supported");
});

test("remote empirical processing requires authorization and rejects undeidentified sensitive data by default", () => {
  const { request } = empiricalResearchFixture();
  const remotePolicy = { mode: "http-api", tokenAuthenticated: true, allowSensitiveRemoteData: false, maxReturnedReplayPoints: 100 };
  assert.throws(() => analyzeEmpiricalRequest(request, remotePolicy), (error) => error.issues.some((issue) => /explicit authorization/i.test(issue.message)));
  const authorized = { ...request, privacy: { ...request.privacy, remoteProcessingAuthorized: true } };
  assert.equal(analyzeEmpiricalRequest(authorized, remotePolicy).processing.mode, "http-api");
  const sensitive = { ...authorized, privacy: { ...authorized.privacy, containsSensitiveData: true } };
  assert.throws(() => analyzeEmpiricalRequest(sensitive, remotePolicy), (error) => error.issues.some((issue) => /must be deidentified/i.test(issue.message)));
  const deidentified = { ...sensitive, privacy: { ...sensitive.privacy, deidentified: true } };
  assert.equal(analyzeEmpiricalRequest(deidentified, remotePolicy).processing.deidentified, true);
});

test("headless observation explanation preserves the model-attribution boundary", () => {
  const { request } = empiricalResearchFixture();
  const result = explainEmpiricalObservation({ ...request, observationIndex: 96 }, undefined, "2026-07-14T12:00:00.000Z");
  assert.equal(result.observation.index, 96);
  assert.match(result.explanation.statement, /declared model attributes/i);
  assert.match(result.explanation.boundary, /not causal identification or empirical validation/i);
});

test("local empirical resources resolve symlinks and remain inside configured roots", async () => {
  const root = await mkdtemp(join(tmpdir(), "vtl-empirical-root-"));
  const outside = await mkdtemp(join(tmpdir(), "vtl-empirical-outside-"));
  try {
    const { request, example } = empiricalResearchFixture();
    const insidePath = join(root, "study.csv");
    const outsidePath = join(outside, "study.csv");
    const csv = empiricalCsv(example);
    await Promise.all([writeFile(insidePath, csv, "utf8"), writeFile(outsidePath, csv, "utf8")]);
    const base = { ...request };
    delete base.data;
    const materialized = await materializeEmpiricalCsvResource({ ...base, filePath: insidePath }, [root]);
    assert.equal(materialized.data.format, "csv");
    assert.match(materialized.data.csv, /^time,/);
    await assert.rejects(() => materializeEmpiricalCsvResource({ ...base, filePath: outsidePath }, [root]), /outside the approved roots/i);
  } finally {
    await Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]);
  }
});
