import { createHash } from "node:crypto";
import { CONTRACT_VERSION, EMPIRICAL_EXECUTION_LIMITS } from "../contracts/constants.ts";
import { ContractError } from "../contracts/experiments.ts";
import {
  empiricalResearchExplanationRequestSchema,
  empiricalResearchReceiptSchema,
  empiricalResearchRequestSchema,
  type ParsedEmpiricalResearchReceipt,
  type ParsedEmpiricalResearchRequest,
} from "../contracts/schemas.ts";
import { MODEL_VERSION } from "../engine/simulator.ts";
import { scenarioById } from "../scenarios/catalog.ts";
import {
  analyzeEmpiricalStudy,
  empiricalCursorExplanation,
  empiricalRoleDefinitions,
  parseEmpiricalCsv,
  type EmpiricalCsvRow,
  type EmpiricalDataset,
  type EmpiricalReplay,
  type EmpiricalStudyAnalysis,
} from "./analysis.ts";

export type EmpiricalProcessingMode = "local-mcp" | "remote-mcp" | "http-api";

export type EmpiricalProcessingPolicy = {
  mode: EmpiricalProcessingMode;
  tokenAuthenticated: boolean;
  allowSensitiveRemoteData: boolean;
  maxReturnedReplayPoints: number;
};

export const LOCAL_EMPIRICAL_POLICY: EmpiricalProcessingPolicy = {
  mode: "local-mcp",
  tokenAuthenticated: false,
  allowSensitiveRemoteData: true,
  maxReturnedReplayPoints: EMPIRICAL_EXECUTION_LIMITS.maxLocalReturnedReplayPoints,
};

function contractError(label: string, issues: { path: string; message: string }[]) {
  return new ContractError(`${label} failed contract validation.`, issues);
}

function parseResearchRequest(input: unknown) {
  const parsed = empiricalResearchRequestSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw contractError("Empirical research request", parsed.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  })));
}

function enforceProcessingPolicy(request: ParsedEmpiricalResearchRequest, policy: EmpiricalProcessingPolicy) {
  const remote = policy.mode !== "local-mcp";
  const sensitive = request.privacy.containsSensitiveData || request.source.dataClassification === "restricted";
  const issues: { path: string; message: string }[] = [];
  if (remote && !request.privacy.remoteProcessingAuthorized) {
    issues.push({ path: "privacy.remoteProcessingAuthorized", message: "Remote API or MCP processing requires explicit authorization." });
  }
  if (remote && sensitive && !request.privacy.deidentified && !policy.allowSensitiveRemoteData) {
    issues.push({ path: "privacy.deidentified", message: "Sensitive or restricted remote data must be deidentified unless the self-hosted operator explicitly enables sensitive-data processing." });
  }
  if (remote && !policy.tokenAuthenticated) {
    issues.push({ path: "authorization", message: "Remote empirical processing requires an authenticated deployment token." });
  }
  if (issues.length) throw contractError("Empirical processing policy", issues);
}

function normalizeScalar(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function datasetFromRequest(request: ParsedEmpiricalResearchRequest): EmpiricalDataset {
  if (request.data.format === "csv") {
    const bytes = new TextEncoder().encode(request.data.csv).byteLength;
    if (bytes > EMPIRICAL_EXECUTION_LIMITS.maxCsvBytes) {
      throw contractError("Empirical CSV", [{ path: "data.csv", message: `CSV input exceeds ${EMPIRICAL_EXECUTION_LIMITS.maxCsvBytes} bytes.` }]);
    }
    const parsed = parseEmpiricalCsv(request.data.csv, request.source.name);
    return { ...parsed, provenance: request.study.provenance, sourceKind: "imported-observation" };
  }

  const headers = request.data.columns.map((header) => header.trim());
  const unique = new Set(headers);
  const issues: { path: string; message: string }[] = [];
  if (headers.some((header) => !header)) issues.push({ path: "data.columns", message: "Column names cannot be blank after trimming." });
  if (unique.size !== headers.length) issues.push({ path: "data.columns", message: "Column names must be unique after trimming." });
  request.data.rows.forEach((row, index) => {
    const unknown = Object.keys(row).filter((key) => !unique.has(key));
    if (unknown.length) issues.push({ path: `data.rows.${index}`, message: `Unknown columns: ${unknown.slice(0, 5).join(", ")}.` });
  });
  if (issues.length) throw contractError("Empirical table", issues.slice(0, 30));

  const rows: EmpiricalCsvRow[] = request.data.rows.map((row) => Object.fromEntries(
    headers.map((header) => [header, normalizeScalar(row[header])]),
  ));
  const canonicalBytes = new TextEncoder().encode(JSON.stringify({ headers, rows: rows.map((row) => headers.map((header) => row[header])) })).byteLength;
  if (canonicalBytes > EMPIRICAL_EXECUTION_LIMITS.maxCsvBytes) {
    throw contractError("Empirical table", [{ path: "data.rows", message: `Canonical table exceeds ${EMPIRICAL_EXECUTION_LIMITS.maxCsvBytes} bytes.` }]);
  }
  return {
    name: request.source.name,
    headers,
    rows,
    provenance: request.study.provenance,
    sourceKind: "imported-observation",
  };
}

function canonicalTableHash(dataset: EmpiricalDataset) {
  const canonical = JSON.stringify({
    headers: dataset.headers,
    rows: dataset.rows.map((row) => dataset.headers.map((header) => row[header] ?? "")),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function phaseReceipt(phase: EmpiricalStudyAnalysis["internalPhase"]) {
  return {
    identifiable: phase.identifiable,
    reason: phase.reason,
    spectralConcentration: phase.spectralConcentration,
    estimatedCycles: phase.estimatedMajorCycles,
  };
}

function validationReceipt(analysis: EmpiricalStudyAnalysis) {
  return {
    evidenceLevel: analysis.evidenceLevel,
    modelSupport: analysis.modelSupport,
    torusReplayReady: analysis.torusReplayReady,
    issues: analysis.issues,
    gates: analysis.gates,
    internalPhase: phaseReceipt(analysis.internalPhase),
    externalPhase: phaseReceipt(analysis.externalPhase),
    phaseRelationship: analysis.phaseRelationship,
  };
}

function replayReceipt(replay: EmpiricalReplay | null) {
  if (!replay) return null;
  return {
    method: replay.method,
    uncertaintyMethod: replay.uncertaintyMethod,
    calibrationRows: replay.calibrationRows,
    holdoutRows: replay.holdoutRows,
    holdoutRmse: replay.holdoutRmse,
    holdoutMae: replay.holdoutMae,
    holdoutIntervalCoverage: replay.holdoutIntervalCoverage,
    finalStatus: replay.points.at(-1)?.statusLabel ?? "Unavailable",
  };
}

function buildReceipt(
  request: ParsedEmpiricalResearchRequest,
  dataset: EmpiricalDataset,
  analysis: EmpiricalStudyAnalysis,
  policy: EmpiricalProcessingPolicy,
  analyzedAt: string,
): ParsedEmpiricalResearchReceipt {
  const scenario = scenarioById[request.scenarioId];
  return empiricalResearchReceiptSchema.parse({
    schemaVersion: CONTRACT_VERSION,
    kind: "empirical-research-receipt",
    modelVersion: MODEL_VERSION,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    analyzedAt,
    processing: {
      mode: policy.mode,
      retention: "request-only",
      remoteProcessingAuthorized: request.privacy.remoteProcessingAuthorized,
      sensitiveDataDeclared: request.privacy.containsSensitiveData,
      deidentified: request.privacy.deidentified,
      tokenAuthenticated: policy.tokenAuthenticated,
      rawInputLogged: false,
    },
    source: {
      name: request.source.name,
      resourceUri: request.source.resourceUri,
      dataClassification: request.source.dataClassification,
      preprocessing: request.source.preprocessing,
      rows: dataset.rows.length,
      columns: dataset.headers.length,
      canonicalTableSha256: canonicalTableHash(dataset),
      rawDataIncluded: false,
    },
    study: request.study,
    mapping: empiricalRoleDefinitions.map((definition) => ({
      role: definition.role,
      symbol: definition.symbol,
      ...request.mapping[definition.role],
    })),
    assumptions: { ...request.assumptions, provenance: "declared-not-fitted" },
    evidence: {
      level: analysis.evidenceLevel,
      empiricalValidation: false,
      modelSupport: analysis.modelSupport,
      interpretationBoundary: "This study record describes an observed-data model evaluation. It does not establish causal identification, domain calibration, toroidal topology, or empirical validation of ATS, AANA, or AIx.",
    },
    validation: validationReceipt(analysis),
    replay: replayReceipt(analysis.replay),
    limitations: [
      "Raw observations are excluded from this study record; the fingerprint covers the standardized table used by the lab, not the original source bytes.",
      "Model parameters and source-to-variable mappings are declared by the researcher and are not fitted by this service.",
      "Phase recurrence, independence, and coverage diagnostics are necessary gates but do not independently establish toroidal topology.",
      "One-step replay and cursor explanations are model-based attribution, not causal identification or intervention-effect estimation.",
      "Model support remains provisional until replicated with independent studies, domain review, and preregistered falsification tests.",
    ],
  });
}

function replayResult(replay: EmpiricalReplay | null, request: ParsedEmpiricalResearchRequest, policy: EmpiricalProcessingPolicy) {
  if (!replay) return null;
  const stride = Math.max(request.options.replayStride, Math.ceil(replay.points.length / Math.max(1, policy.maxReturnedReplayPoints)));
  const points = request.options.includeReplayPoints
    ? replay.points.filter((_, index) => index % stride === 0 || index === replay.points.length - 1).map((point) => ({
      index: point.index,
      time: point.time,
      observedRho: point.rho,
      predictedRho: point.predictedRho,
      lowerRho: point.lowerRho,
      upperRho: point.upperRho,
      residual: point.residual,
      status: point.statusLabel,
      thetaPhase: point.thetaPhase,
      phiPhase: point.phiPhase,
      intervention: point.intervention,
    }))
    : undefined;
  return {
    ...replayReceipt(replay),
    torusInterpretationWithheld: false,
    returnedPointStride: stride,
    returnedPointCount: points?.length ?? 0,
    points,
  };
}

export function analyzeEmpiricalRequest(
  input: unknown,
  policy: EmpiricalProcessingPolicy = LOCAL_EMPIRICAL_POLICY,
  analyzedAt = new Date().toISOString(),
) {
  const request = parseResearchRequest(input);
  enforceProcessingPolicy(request, policy);
  const scenario = scenarioById[request.scenarioId];
  if (!scenario) throw contractError("Empirical research request", [{ path: "scenarioId", message: `Unknown scenario '${request.scenarioId}'.` }]);
  const dataset = datasetFromRequest(request);
  const analysis = analyzeEmpiricalStudy(dataset, request.mapping, request.study, request.assumptions);
  const receipt = buildReceipt(request, dataset, analysis, policy, analyzedAt);
  const replay = replayResult(analysis.replay, request, policy);
  if (replay) replay.torusInterpretationWithheld = !analysis.torusReplayReady;
  return {
    schemaVersion: CONTRACT_VERSION,
    modelVersion: MODEL_VERSION,
    scenario: { id: scenario.id, version: scenario.version, title: scenario.title },
    evidence: receipt.evidence,
    processing: receipt.processing,
    source: receipt.source,
    validation: receipt.validation,
    replay,
    receipt,
  };
}

export function explainEmpiricalObservation(
  input: unknown,
  policy: EmpiricalProcessingPolicy = LOCAL_EMPIRICAL_POLICY,
  analyzedAt = new Date().toISOString(),
) {
  const parsed = empiricalResearchExplanationRequestSchema.safeParse(input);
  if (!parsed.success) throw contractError("Empirical explanation request", parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message })));
  const { observationIndex, ...request } = parsed.data;
  const result = analyzeEmpiricalRequest({ ...request, options: { ...request.options, includeReplayPoints: false } }, policy, analyzedAt);
  const normalized = parseResearchRequest(request);
  const dataset = datasetFromRequest(normalized);
  const analysis = analyzeEmpiricalStudy(dataset, normalized.mapping, normalized.study, normalized.assumptions);
  const point = analysis.replay?.points[observationIndex];
  if (!point) throw contractError("Empirical explanation request", [{ path: "observationIndex", message: `Observation ${observationIndex} is unavailable because the replay has ${analysis.replay?.points.length ?? 0} points.` }]);
  return {
    schemaVersion: CONTRACT_VERSION,
    modelVersion: MODEL_VERSION,
    scenario: result.scenario,
    source: result.source,
    observation: {
      index: point.index,
      time: point.time,
      observedRho: point.rho,
      predictedRho: point.predictedRho,
      residual: point.residual,
      status: point.statusLabel,
    },
    explanation: empiricalCursorExplanation(point, normalized.assumptions),
    torusInterpretationWithheld: !analysis.torusReplayReady,
    evidence: result.evidence,
  };
}
