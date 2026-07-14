import { CONTRACT_VERSION } from "../contracts/constants.ts";
import {
  empiricalEvidenceRegistryBundleSchema,
  empiricalEvidenceRegistryRequestSchema,
  empiricalRegistrySummarySchema,
  type ParsedEmpiricalEvidenceRegistryBundle,
  type ParsedEmpiricalReceipt,
} from "../contracts/schemas.ts";

export type EmpiricalCompatibility = "anchor" | "compatible" | "partially-comparable" | "non-comparable" | "excluded";
export type EmpiricalCompatibilityDimension = {
  id: "evidence-kind" | "model-version" | "scenario-version" | "population" | "horizon" | "aggregation" | "viable-region" | "phase-definition" | "units" | "preprocessing" | "assumptions";
  label: string;
  status: "match" | "differs" | "unknown" | "excluded";
  severity: "none" | "partial" | "critical";
  explanation: string;
};

type NormalizedReceipt = {
  receipt: ParsedEmpiricalReceipt;
  id: string;
  receiptKind: ParsedEmpiricalReceipt["kind"];
  studyName: string;
  sourceName: string;
  scenarioId: string;
  scenarioVersion: string;
  modelVersion: string;
  evidenceKind: "observed" | "synthetic";
  modelSupport: "insufficient-data" | "not-supported" | "provisional";
  phaseResult: "pass" | "fail" | "blocked";
  negative: boolean;
  rows: number;
  replay: ParsedEmpiricalReceipt["replay"];
  preprocessing: string[] | null;
  assumptions: { kappa: number; chi: number; rho0: number; rhoCrit: number };
  mappingUnits: Record<string, string>;
};

const labels: Record<EmpiricalCompatibilityDimension["id"], string> = {
  "evidence-kind": "Observed evidence",
  "model-version": "Model version",
  "scenario-version": "Scenario / version",
  population: "Population ω",
  horizon: "Horizon τ",
  aggregation: "Aggregation rule α",
  "viable-region": "Viable region X*",
  "phase-definition": "Two recurrent phases",
  units: "Mapped units",
  preprocessing: "Preprocessing",
  assumptions: "Declared assumptions",
};

function normalizedText(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function stableString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableString).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableString(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function receiptHash(receipt: ParsedEmpiricalReceipt) {
  return receipt.kind === "browser-local-empirical-study"
    ? receipt.source.datasetSha256
    : receipt.source.canonicalTableSha256;
}

export function empiricalReceiptId(receipt: ParsedEmpiricalReceipt) {
  const identity = stableString({
    dataset: receiptHash(receipt),
    scenarioId: receipt.scenarioId,
    scenarioVersion: receipt.scenarioVersion,
    modelVersion: receipt.modelVersion,
    study: receipt.study,
    mapping: [...receipt.mapping].sort((left, right) => left.role.localeCompare(right.role)).map(({ role, column, unit, evidence }) => ({ role, column, unit, evidence })),
    assumptions: receipt.assumptions,
  });
  return `er-${fnv1a(identity, 0x811c9dc5)}${fnv1a(identity, 0x9e3779b9)}`;
}

function phaseResult(receipt: ParsedEmpiricalReceipt): "pass" | "fail" | "blocked" {
  const phaseGateIds = new Set(["internal-recurrence", "external-recurrence", "phase-independence"]);
  const phaseGates = receipt.validation.gates.filter((gate) => phaseGateIds.has(gate.id));
  if (phaseGates.some((gate) => gate.state === "fail")) return "fail";
  if (phaseGates.some((gate) => gate.state === "blocked")) return "blocked";
  return phaseGates.every((gate) => gate.passed) ? "pass" : "blocked";
}

function normalizeReceipt(receipt: ParsedEmpiricalReceipt): NormalizedReceipt {
  const result = phaseResult(receipt);
  const evidenceKind = receipt.kind === "browser-local-empirical-study" && receipt.source.kind === "bundled-observed-form-demo"
    ? "synthetic"
    : "observed";
  const preprocessing = receipt.source.preprocessing && receipt.source.preprocessing.length > 0
    ? receipt.source.preprocessing.map(normalizedText).sort()
    : null;
  const mappingUnits = Object.fromEntries(receipt.mapping
    .filter((entry) => entry.evidence !== "not-mapped" && entry.column.trim())
    .map((entry) => [entry.role, normalizedText(entry.unit)]));
  const modelSupport = receipt.kind === "empirical-research-receipt"
    ? receipt.evidence.modelSupport
    : receipt.validation.modelSupport;
  return {
    receipt,
    id: empiricalReceiptId(receipt),
    receiptKind: receipt.kind,
    studyName: receipt.study.name,
    sourceName: receipt.source.name,
    scenarioId: receipt.scenarioId,
    scenarioVersion: receipt.scenarioVersion,
    modelVersion: receipt.modelVersion,
    evidenceKind,
    modelSupport,
    phaseResult: result,
    negative: result !== "pass" || modelSupport === "not-supported",
    rows: receipt.source.rows,
    replay: receipt.replay,
    preprocessing,
    assumptions: receipt.assumptions,
    mappingUnits,
  };
}

function dimension(
  id: EmpiricalCompatibilityDimension["id"],
  status: EmpiricalCompatibilityDimension["status"],
  severity: EmpiricalCompatibilityDimension["severity"],
  explanation: string,
): EmpiricalCompatibilityDimension {
  return { id, label: labels[id], status, severity, explanation };
}

function compareText(
  id: EmpiricalCompatibilityDimension["id"],
  candidate: string,
  anchor: string,
  severity: "partial" | "critical",
  matching: string,
  differing: string,
) {
  if (!candidate.trim() || !anchor.trim()) return dimension(id, "unknown", severity, `${labels[id]} is not fully declared in both receipts.`);
  return normalizedText(candidate) === normalizedText(anchor)
    ? dimension(id, "match", "none", matching)
    : dimension(id, "differs", severity, differing);
}

function compareUnits(candidate: NormalizedReceipt, anchor: NormalizedReceipt) {
  const roles = [...new Set([...Object.keys(anchor.mappingUnits), ...Object.keys(candidate.mappingUnits)])].sort();
  if (roles.length === 0) return dimension("units", "unknown", "partial", "No mapped measurement units are available in both receipts.");
  const missing = roles.filter((role) => !anchor.mappingUnits[role] || !candidate.mappingUnits[role]);
  if (missing.length > 0) return dimension("units", "unknown", "partial", `Mapped units are missing for ${missing.join(", ")}.`);
  const changed = roles.filter((role) => anchor.mappingUnits[role] !== candidate.mappingUnits[role]);
  if (changed.length > 0) return dimension("units", "differs", "critical", `Declared units differ for ${changed.join(", ")}; replay metrics cannot be combined.`);
  return dimension("units", "match", "none", "All mapped variables use the same declared units or scales.");
}

function comparePreprocessing(candidate: NormalizedReceipt, anchor: NormalizedReceipt) {
  if (!candidate.preprocessing || !anchor.preprocessing) return dimension("preprocessing", "unknown", "partial", "Preprocessing is not declared in both receipts.");
  return stableString(candidate.preprocessing) === stableString(anchor.preprocessing)
    ? dimension("preprocessing", "match", "none", "The declared preprocessing steps match.")
    : dimension("preprocessing", "differs", "partial", "Declared preprocessing differs; keep this study visible but outside the compatible cohort.");
}

function compareAssumptions(candidate: NormalizedReceipt, anchor: NormalizedReceipt) {
  return stableString(candidate.assumptions) === stableString(anchor.assumptions)
    ? dimension("assumptions", "match", "none", "κ, χ, ρ₀, and ρcrit match the anchor receipt.")
    : dimension("assumptions", "differs", "partial", "Declared radial assumptions differ; prediction-error summaries are not directly comparable.");
}

function compatibilityDimensions(candidate: NormalizedReceipt, anchor: NormalizedReceipt) {
  const receipt = candidate.receipt;
  const anchorReceipt = anchor.receipt;
  return [
    candidate.evidenceKind === "synthetic"
      ? dimension("evidence-kind", "excluded", "critical", "Bundled synthetic teaching data remain visible but are excluded from empirical aggregation.")
      : dimension("evidence-kind", "match", "none", "This receipt describes researcher-supplied observations."),
    compareText("model-version", candidate.modelVersion, anchor.modelVersion, "critical", "The model versions match.", "The model versions differ; re-analysis under a common version is required."),
    candidate.scenarioId === anchor.scenarioId && candidate.scenarioVersion === anchor.scenarioVersion
      ? dimension("scenario-version", "match", "none", "The scenario id and scenario version match.")
      : dimension("scenario-version", "differs", "critical", `Scenario/version differs (${candidate.scenarioId} / ${candidate.scenarioVersion} versus ${anchor.scenarioId} / ${anchor.scenarioVersion}).`),
    compareText("population", receipt.study.population, anchorReceipt.study.population, "critical", "The population ω and inclusion boundary match.", "Population ω differs; these receipts describe different systems or inclusion boundaries."),
    compareText("horizon", receipt.study.horizon, anchorReceipt.study.horizon, "partial", "The evidence horizon τ matches.", "Horizon τ differs; temporal summaries are only partially comparable."),
    compareText("aggregation", receipt.study.aggregation, anchorReceipt.study.aggregation, "critical", "The aggregation rule α matches.", "Aggregation rule α differs; heterogeneous outcomes are being combined differently."),
    compareText("viable-region", receipt.study.viableRegion, anchorReceipt.study.viableRegion, "critical", "The declared viable region X* matches.", "The viable-region definition differs; status outcomes do not have the same meaning."),
    normalizedText(receipt.study.internalCycle) === normalizedText(anchorReceipt.study.internalCycle)
      && normalizedText(receipt.study.externalCycle) === normalizedText(anchorReceipt.study.externalCycle)
      ? dimension("phase-definition", "match", "none", "Both recurrent phase definitions match.")
      : dimension("phase-definition", "differs", "critical", "One or both recurrent phase definitions differ; torus diagnostics are not measuring the same cycles."),
    compareUnits(candidate, anchor),
    comparePreprocessing(candidate, anchor),
    compareAssumptions(candidate, anchor),
  ];
}

function classify(candidate: NormalizedReceipt, anchor: NormalizedReceipt, dimensions: EmpiricalCompatibilityDimension[]): EmpiricalCompatibility {
  if (candidate.evidenceKind === "synthetic") return "excluded";
  if (candidate.id === anchor.id) return "anchor";
  if (dimensions.some((entry) => entry.severity === "critical" && entry.status !== "match")) return "non-comparable";
  if (dimensions.some((entry) => entry.severity === "partial" && entry.status !== "match")) return "partially-comparable";
  return "compatible";
}

function mean(values: number[]) {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function range(values: number[]) {
  return values.length > 0 ? { min: Math.min(...values), max: Math.max(...values) } : null;
}

export function aggregateEmpiricalReceipts(input: unknown) {
  const request = empiricalEvidenceRegistryRequestSchema.parse(input);
  const normalized = request.receipts.map(normalizeReceipt);
  const byId = new Map<string, NormalizedReceipt>();
  for (const receipt of normalized) if (!byId.has(receipt.id)) byId.set(receipt.id, receipt);
  const unique = [...byId.values()];
  const requestedAnchor = request.anchorReceiptId ? byId.get(request.anchorReceiptId) : undefined;
  if (request.anchorReceiptId && !requestedAnchor) throw new Error(`Unknown anchor receipt '${request.anchorReceiptId}'.`);
  const anchor = requestedAnchor ?? unique.find((receipt) => receipt.evidenceKind === "observed") ?? unique[0];
  if (!anchor) throw new Error("The registry requires at least one receipt.");

  const entries = unique.map((receipt) => {
    const dimensions = compatibilityDimensions(receipt, anchor);
    return {
      id: receipt.id,
      receiptKind: receipt.receiptKind,
      studyName: receipt.studyName,
      sourceName: receipt.sourceName,
      scenarioId: receipt.scenarioId,
      scenarioVersion: receipt.scenarioVersion,
      modelVersion: receipt.modelVersion,
      evidenceKind: receipt.evidenceKind,
      modelSupport: receipt.modelSupport,
      phaseResult: receipt.phaseResult,
      negative: receipt.negative,
      compatibility: classify(receipt, anchor, dimensions),
      rows: receipt.rows,
      replay: receipt.replay,
      dimensions,
    };
  });
  const cohortEntries = entries.filter((entry) => entry.evidenceKind === "observed" && (entry.compatibility === "anchor" || entry.compatibility === "compatible"));
  const cohortIds = new Set(cohortEntries.map((entry) => entry.id));
  const cohortReceipts = unique.filter((receipt) => cohortIds.has(receipt.id));
  const replayReceipts = cohortReceipts.filter((receipt) => receipt.replay !== null);
  const rmse = replayReceipts.map((receipt) => receipt.replay!.holdoutRmse);
  const coverage = replayReceipts.map((receipt) => receipt.replay!.holdoutIntervalCoverage);

  return empiricalRegistrySummarySchema.parse({
    schemaVersion: CONTRACT_VERSION,
    kind: "empirical-evidence-registry-summary",
    anchorReceiptId: anchor.id,
    receipts: entries,
    counts: {
      totalReceipts: unique.length,
      observedStudies: entries.filter((entry) => entry.evidenceKind === "observed").length,
      syntheticStudies: entries.filter((entry) => entry.evidenceKind === "synthetic").length,
      negativeStudies: entries.filter((entry) => entry.evidenceKind === "observed" && entry.negative).length,
      compatibleWithAnchor: entries.filter((entry) => entry.evidenceKind === "observed" && (entry.compatibility === "anchor" || entry.compatibility === "compatible")).length,
      partiallyComparable: entries.filter((entry) => entry.compatibility === "partially-comparable").length,
      nonComparable: entries.filter((entry) => entry.compatibility === "non-comparable").length,
      deduplicatedReceipts: normalized.length - unique.length,
    },
    cohort: {
      receiptIds: cohortEntries.map((entry) => entry.id),
      compatibleObservedStudies: cohortEntries.length,
      phaseGatePassRate: cohortEntries.length > 0 ? cohortEntries.filter((entry) => entry.phaseResult === "pass").length / cohortEntries.length : null,
      negativeStudiesPreserved: entries.filter((entry) => entry.evidenceKind === "observed" && entry.negative).length,
      replayStudies: replayReceipts.length,
      meanHoldoutRmse: mean(rmse),
      minHoldoutRmse: rmse.length > 0 ? Math.min(...rmse) : null,
      maxHoldoutRmse: rmse.length > 0 ? Math.max(...rmse) : null,
      meanIntervalCoverage: mean(coverage),
      assumptionRanges: {
        kappa: range(cohortReceipts.map((receipt) => receipt.assumptions.kappa)),
        chi: range(cohortReceipts.map((receipt) => receipt.assumptions.chi)),
        rho0: range(cohortReceipts.map((receipt) => receipt.assumptions.rho0)),
        rhoCrit: range(cohortReceipts.map((receipt) => receipt.assumptions.rhoCrit)),
      },
    },
    interpretationBoundary: "Only compatible observed receipts are summarized descriptively. Synthetic, partially comparable, and non-comparable receipts remain visible but are excluded. No raw observations are pooled, no watchlist tier is averaged, and these summaries are not a meta-analysis, causal estimate, or empirical validation of the theory. Non-combinability is a valid result.",
  });
}

export function buildEmpiricalRegistryBundle(
  receipts: ParsedEmpiricalReceipt[],
  anchorReceiptId: string | undefined,
  exportedAt = new Date().toISOString(),
): ParsedEmpiricalEvidenceRegistryBundle {
  const summary = aggregateEmpiricalReceipts({ receipts, anchorReceiptId });
  const ids = new Set(summary.receipts.map((receipt) => receipt.id));
  const uniqueReceipts = receipts.filter((receipt, index) => ids.has(empiricalReceiptId(receipt)) && receipts.findIndex((candidate) => empiricalReceiptId(candidate) === empiricalReceiptId(receipt)) === index);
  return empiricalEvidenceRegistryBundleSchema.parse({
    schemaVersion: CONTRACT_VERSION,
    kind: "empirical-evidence-registry",
    exportedAt,
    privacy: {
      browserLocal: true,
      rawObservationsIncluded: false,
      aggregation: "descriptive-compatible-receipts-only",
    },
    receipts: uniqueReceipts,
    anchorReceiptId: summary.anchorReceiptId,
    summary,
  });
}

export function mergeEmpiricalReceipts(current: ParsedEmpiricalReceipt[], additions: ParsedEmpiricalReceipt[]) {
  const result = new Map(current.map((receipt) => [empiricalReceiptId(receipt), receipt]));
  for (const receipt of additions) result.set(empiricalReceiptId(receipt), receipt);
  return [...result.values()];
}
