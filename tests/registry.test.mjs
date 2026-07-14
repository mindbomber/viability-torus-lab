import assert from "node:assert/strict";
import test from "node:test";
import { empiricalEvidenceRegistryBundleSchema, empiricalEvidenceRegistryRequestSchema, empiricalReceiptSchema } from "../contracts/schemas.ts";
import { createSyntheticRegistryDemo } from "../empirical/registry-demo.ts";
import { aggregateEmpiricalReceipts, buildEmpiricalRegistryBundle, empiricalReceiptId, mergeEmpiricalReceipts } from "../empirical/registry.ts";
import { scenarioById } from "../scenarios/catalog.ts";

const demo = () => createSyntheticRegistryDemo(scenarioById["llm-deployment"]);

test("registry classifies compatible, partial, non-comparable, negative, and synthetic receipts", () => {
  const receipts = demo();
  const summary = aggregateEmpiricalReceipts({ receipts });
  assert.equal(summary.counts.totalReceipts, 5);
  assert.equal(summary.counts.observedStudies, 4);
  assert.equal(summary.counts.syntheticStudies, 1);
  assert.equal(summary.counts.negativeStudies, 1);
  assert.equal(summary.counts.compatibleWithAnchor, 2);
  assert.equal(summary.counts.partiallyComparable, 1);
  assert.equal(summary.counts.nonComparable, 1);
  assert.equal(summary.receipts.find((receipt) => receipt.studyName.startsWith("Study C"))?.compatibility, "partially-comparable");
  assert.equal(summary.receipts.find((receipt) => receipt.studyName.startsWith("Study C"))?.negative, true);
  assert.equal(summary.receipts.find((receipt) => receipt.studyName.startsWith("Study D"))?.compatibility, "non-comparable");
  assert.equal(summary.receipts.find((receipt) => receipt.evidenceKind === "synthetic")?.compatibility, "excluded");
});

test("descriptive cohort includes only compatible observations and preserves negative studies outside it", () => {
  const summary = aggregateEmpiricalReceipts({ receipts: demo() });
  assert.equal(summary.cohort.compatibleObservedStudies, 2);
  assert.equal(summary.cohort.phaseGatePassRate, 1);
  assert.equal(summary.cohort.negativeStudiesPreserved, 1);
  assert.equal(summary.cohort.replayStudies, 2);
  assert.ok(Math.abs(summary.cohort.meanHoldoutRmse - 0.1105) < 1e-12);
  assert.equal(summary.cohort.minHoldoutRmse, 0.103);
  assert.equal(summary.cohort.maxHoldoutRmse, 0.118);
  assert.ok(Math.abs(summary.cohort.meanIntervalCoverage - 0.914) < 1e-12);
  assert.match(summary.interpretationBoundary, /no watchlist tier is averaged/i);
  assert.match(summary.interpretationBoundary, /non-combinability is a valid result/i);
});

test("receipt identity ignores export timestamps and deduplication is stable", () => {
  const receipts = demo();
  const duplicate = empiricalReceiptSchema.parse({ ...receipts[0], exportedAt: "2026-07-14T13:00:00.000Z" });
  assert.equal(empiricalReceiptId(receipts[0]), empiricalReceiptId(duplicate));
  const merged = mergeEmpiricalReceipts(receipts, [duplicate]);
  assert.equal(merged.length, receipts.length);
  const summary = aggregateEmpiricalReceipts({ receipts: [...receipts, duplicate] });
  assert.equal(summary.counts.totalReceipts, receipts.length);
  assert.equal(summary.counts.deduplicatedReceipts, 1);
});

test("changed mapped units are a hard non-comparability gate", () => {
  const receipts = demo();
  const changed = empiricalReceiptSchema.parse({
    ...receipts[1],
    source: { ...receipts[1].source, datasetSha256: "f".repeat(64) },
    mapping: receipts[1].mapping.map((entry) => entry.role === "pressure" ? { ...entry, unit: "kilopascals" } : entry),
  });
  const summary = aggregateEmpiricalReceipts({ receipts: [receipts[0], changed] });
  const comparison = summary.receipts.find((receipt) => receipt.id === empiricalReceiptId(changed));
  assert.equal(comparison?.compatibility, "non-comparable");
  assert.equal(comparison?.dimensions.find((entry) => entry.id === "units")?.status, "differs");
});

test("registry bundle is redacted, schema-valid, and re-importable", () => {
  const receipts = demo();
  const bundle = buildEmpiricalRegistryBundle(receipts, undefined, "2026-07-14T14:00:00.000Z");
  assert.equal(bundle.privacy.rawObservationsIncluded, false);
  assert.equal(bundle.receipts.length, 5);
  assert.equal(empiricalEvidenceRegistryBundleSchema.safeParse(bundle).success, true);
  assert.equal(empiricalEvidenceRegistryRequestSchema.safeParse({ receipts: bundle.receipts, anchorReceiptId: bundle.anchorReceiptId }).success, true);
  assert.equal(JSON.stringify(bundle).includes("internal_cycle_signal"), true);
  assert.equal("data" in bundle.receipts[0], false);
});

test("unknown anchors are rejected instead of silently changing the comparison", () => {
  assert.throws(() => aggregateEmpiricalReceipts({ receipts: demo(), anchorReceiptId: "er-not-present" }), /unknown anchor receipt/i);
});
