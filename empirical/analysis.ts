import {
  MIN_RHO,
  MODEL_VERSION,
  analyzeExternalTelemetry,
  classifyStatus,
  evaluateRadialBalance,
  type PhaseDiagnostics,
  type RadialBalanceInput,
  type SimulationParameters,
  type SimulationStatus,
} from "../engine/simulator.ts";
import type { ScenarioDefinition } from "../scenarios/catalog.ts";
import { EMPIRICAL_EXECUTION_LIMITS } from "../contracts/constants.ts";

export const EMPIRICAL_MAX_ROWS = EMPIRICAL_EXECUTION_LIMITS.maxRows;
export const EMPIRICAL_MAX_COLUMNS = EMPIRICAL_EXECUTION_LIMITS.maxColumns;
export const EMPIRICAL_CALIBRATION_FRACTION = 0.7;
export const EMPIRICAL_LOCKING_THRESHOLD = 0.985;
export const EMPIRICAL_COVERAGE_FLOOR = 0.12;

export type EmpiricalRole =
  | "time"
  | "thetaSignal"
  | "phiSignal"
  | "pressure"
  | "error"
  | "feedback"
  | "correction"
  | "drift"
  | "irreversibleLoss"
  | "debt"
  | "rho"
  | "outcome"
  | "intervention";

export type EmpiricalRoleDefinition = {
  role: EmpiricalRole;
  symbol: string;
  label: string;
  modelRole: string;
  required: boolean;
  numeric: boolean;
  defaultUnit: string;
  aliases: string[];
  bounds?: { min: number; max: number };
};

export const empiricalRoleDefinitions: readonly EmpiricalRoleDefinition[] = [
  { role: "time", symbol: "t", label: "Time", modelRole: "Observation time", required: true, numeric: true, defaultUnit: "declared time unit", aliases: ["time", "t", "timestamp"] },
  { role: "thetaSignal", symbol: "θ signal", label: "Internal-cycle signal", modelRole: "Observable used to estimate θ", required: true, numeric: true, defaultUnit: "source units", aliases: ["theta_signal", "theta", "internal_cycle_signal", "internal_signal"] },
  { role: "phiSignal", symbol: "φ signal", label: "External-cycle signal", modelRole: "Observable used to estimate φ", required: true, numeric: true, defaultUnit: "source units", aliases: ["phi_signal", "phi", "external_cycle_signal", "external_signal", "mismatch"] },
  { role: "pressure", symbol: "π", label: "Optimization pressure", modelRole: "Pressure proxy on the declared model scale", required: true, numeric: true, defaultUnit: "dimensionless proxy", bounds: { min: 0, max: 3 }, aliases: ["pressure", "pi", "optimization_pressure"] },
  { role: "error", symbol: "ε", label: "Misclassification error", modelRole: "Error proxy on [0,1]", required: true, numeric: true, defaultUnit: "proportion", bounds: { min: 0, max: 1 }, aliases: ["error", "epsilon", "misclassification", "misclassification_error"] },
  { role: "feedback", symbol: "γ", label: "Feedback fidelity", modelRole: "Constraint visibility proxy on [0,1]", required: true, numeric: true, defaultUnit: "proportion", bounds: { min: 0, max: 1 }, aliases: ["feedback", "gamma", "feedback_fidelity"] },
  { role: "correction", symbol: "C", label: "Correction capacity", modelRole: "Correction proxy on the declared model scale", required: true, numeric: true, defaultUnit: "dimensionless proxy", bounds: { min: 0, max: 2 }, aliases: ["correction", "c", "correction_capacity"] },
  { role: "drift", symbol: "Φ", label: "Viable-region drift", modelRole: "Environmental or target drift proxy", required: true, numeric: true, defaultUnit: "dimensionless rate", bounds: { min: 0, max: 0.5 }, aliases: ["drift", "phi_drift", "viable_region_drift"] },
  { role: "irreversibleLoss", symbol: "Λ", label: "Irreversible loss", modelRole: "Path-dependent loss proxy", required: true, numeric: true, defaultUnit: "dimensionless rate", bounds: { min: 0, max: 0.5 }, aliases: ["irreversible_loss", "loss", "lambda"] },
  { role: "debt", symbol: "Δ", label: "Alignment debt", modelRole: "Observed backlog or deferred correction proxy", required: true, numeric: true, defaultUnit: "dimensionless proxy", bounds: { min: 0, max: 100 }, aliases: ["debt", "delta", "alignment_debt", "backlog"] },
  { role: "rho", symbol: "ρ", label: "Radial excursion", modelRole: "Observed distance from the declared viable reference", required: true, numeric: true, defaultUnit: "dimensionless proxy", bounds: { min: MIN_RHO, max: 10 }, aliases: ["rho", "radial_excursion", "excursion", "risk_distance"] },
  { role: "outcome", symbol: "y", label: "Observed outcome", modelRole: "Optional outcome or viability annotation", required: false, numeric: false, defaultUnit: "category", aliases: ["outcome", "status", "viability_outcome"] },
  { role: "intervention", symbol: "I", label: "Intervention or event", modelRole: "Optional observed intervention marker", required: false, numeric: false, defaultUnit: "event label", aliases: ["intervention", "event", "action"] },
] as const;

export const requiredEmpiricalRoles = empiricalRoleDefinitions.filter((item) => item.required).map((item) => item.role);

export type EmpiricalColumnMapping = Record<EmpiricalRole, {
  column: string;
  unit: string;
  evidence: "uploaded-observation" | "declared-proxy" | "not-mapped";
}>;

export type EmpiricalCsvRow = Record<string, string>;

export type EmpiricalDataset = {
  name: string;
  headers: string[];
  rows: EmpiricalCsvRow[];
  provenance: string;
  sourceKind: "imported-observation" | "bundled-observed-form-demo";
};

export type EmpiricalStudyDefinition = {
  name: string;
  objective: string;
  population: string;
  horizon: string;
  aggregation: string;
  viableRegion: string;
  internalCycle: string;
  externalCycle: string;
  falsification: string;
  provenance: string;
};

export type EmpiricalModelAssumptions = Pick<SimulationParameters, "kappa" | "rho0" | "chi" | "rhoCrit">;

export type MappedEmpiricalPoint = {
  time: number;
  thetaSignal: number;
  phiSignal: number;
  pressure: number;
  error: number;
  feedback: number;
  correction: number;
  drift: number;
  irreversibleLoss: number;
  debt: number;
  rho: number;
  outcome?: string;
  intervention?: string;
};

export type EmpiricalGate = {
  id: "data-quality" | "internal-recurrence" | "external-recurrence" | "phase-independence" | "holdout";
  label: string;
  passed: boolean;
  state: "pass" | "fail" | "ready" | "blocked";
  detail: string;
};

export type EmpiricalReplayPoint = MappedEmpiricalPoint & {
  index: number;
  predictedRho: number;
  lowerRho: number;
  upperRho: number;
  residual: number;
  observedRadialVelocity: number;
  observedDebtVelocity: number;
  balance: ReturnType<typeof evaluateRadialBalance>;
  status: SimulationStatus;
  statusLabel: string;
  thetaPhase?: number;
  phiPhase?: number;
};

export type EmpiricalReplay = {
  points: EmpiricalReplayPoint[];
  calibrationRows: number;
  holdoutRows: number;
  holdoutRmse: number;
  holdoutMae: number;
  holdoutIntervalCoverage: number;
  residualInterval: { lower: number; upper: number };
  uncertaintyMethod: "calibration-residual-90-percent";
  method: "one-step-observed-driver-replay";
};

export type EmpiricalPhaseRelationship = {
  lockingValue: number;
  lockingRatio?: string;
  jointCoverage: number;
  interpretation: string;
};

export type EmpiricalStudyAnalysis = {
  issues: string[];
  mappedPoints: MappedEmpiricalPoint[];
  internalPhase: PhaseDiagnostics;
  externalPhase: PhaseDiagnostics;
  phaseRelationship: EmpiricalPhaseRelationship;
  gates: EmpiricalGate[];
  replay: EmpiricalReplay | null;
  torusReplayReady: boolean;
  modelSupport: "insufficient-data" | "not-supported" | "provisional";
  evidenceLevel: "observed-descriptive";
};

const emptyPhaseDiagnostics: PhaseDiagnostics = {
  identifiable: false,
  reason: "insufficient-cycles",
  regime: "Not identifiable",
  spectralConcentration: 0,
  amplitude: 0,
  observedMajorCycles: 0,
  estimatedMajorCycles: 0,
  dominantAngularFrequency: 0,
  phaseLockingValue: 0,
};

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function parseCsvRecords(text: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      record.push(value.trim());
      value = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(value.trim());
      value = "";
      if (record.some((cell) => cell.length > 0)) records.push(record);
      record = [];
    } else value += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted value");
  record.push(value.trim());
  if (record.some((cell) => cell.length > 0)) records.push(record);
  return records;
}

export function parseEmpiricalCsv(text: string, name = "imported-study.csv"): EmpiricalDataset {
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  if (records.length < 9) throw new Error("Empirical CSV needs a header and at least eight observations");
  const headers = records[0].map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error("CSV headers cannot be empty");
  if (headers.length > EMPIRICAL_MAX_COLUMNS) throw new Error(`Empirical CSV may contain at most ${EMPIRICAL_MAX_COLUMNS} columns`);
  const normalized = headers.map(normalizedHeader);
  if (new Set(normalized).size !== normalized.length) throw new Error("CSV headers must be unique after case and spacing normalization");
  const body = records.slice(1);
  if (body.length > EMPIRICAL_MAX_ROWS) throw new Error(`Empirical CSV may contain at most ${EMPIRICAL_MAX_ROWS.toLocaleString()} observations`);
  const rows = body.map((cells, rowIndex) => {
    if (cells.length !== headers.length) throw new Error(`CSV row ${rowIndex + 2} has ${cells.length} cells; expected ${headers.length}`);
    return Object.fromEntries(headers.map((header, columnIndex) => [header, cells[columnIndex]]));
  });
  return {
    name,
    headers,
    rows,
    provenance: "Describe the instrument, collection process, preprocessing, exclusions, and responsible source.",
    sourceKind: "imported-observation",
  };
}

export function emptyEmpiricalMapping(): EmpiricalColumnMapping {
  return Object.fromEntries(empiricalRoleDefinitions.map((item) => [item.role, {
    column: "",
    unit: item.defaultUnit,
    evidence: "not-mapped" as const,
  }])) as EmpiricalColumnMapping;
}

export function autoMapEmpiricalColumns(dataset: EmpiricalDataset): EmpiricalColumnMapping {
  const mapping = emptyEmpiricalMapping();
  const byNormalized = new Map(dataset.headers.map((header) => [normalizedHeader(header), header]));
  for (const definition of empiricalRoleDefinitions) {
    const column = definition.aliases.map((alias) => byNormalized.get(normalizedHeader(alias))).find(Boolean) ?? "";
    mapping[definition.role] = {
      column,
      unit: definition.defaultUnit,
      evidence: column ? "uploaded-observation" : "not-mapped",
    };
  }
  return mapping;
}

export function studyDefinitionForScenario(scenario: ScenarioDefinition): EmpiricalStudyDefinition {
  return {
    name: `${scenario.shortTitle} observational study`,
    objective: scenario.optimizedOutcome,
    population: "",
    horizon: "",
    aggregation: "",
    viableRegion: scenario.viableRegion,
    internalCycle: scenario.cycles.minor.label,
    externalCycle: scenario.cycles.major.label,
    falsification: scenario.evidence.falsificationCriteria[0] ?? "A proposed phase fails recurrence or the paper-aligned replay does not outperform a simpler account.",
    provenance: "",
  };
}

export function empiricalAssumptionsForScenario(scenario: ScenarioDefinition): EmpiricalModelAssumptions {
  const { kappa, rho0, chi, rhoCrit } = scenario.defaults;
  return { kappa, rho0, chi, rhoCrit };
}

function greatestCommonDivisor(left: number, right: number) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function phaseRelationship(theta: (number | undefined)[], phi: (number | undefined)[]): EmpiricalPhaseRelationship {
  const pairs = theta.flatMap((thetaValue, index) => thetaValue === undefined || phi[index] === undefined ? [] : [[thetaValue, phi[index]!] as const]);
  if (pairs.length === 0) return { lockingValue: 0, jointCoverage: 0, interpretation: "Both phase estimates must pass before their relationship can be assessed." };
  let lockingValue = 0;
  let lockingRatio: string | undefined;
  for (let numerator = 1; numerator <= 4; numerator += 1) {
    for (let denominator = 1; denominator <= 4; denominator += 1) {
      if (greatestCommonDivisor(numerator, denominator) !== 1) continue;
      let real = 0;
      let imaginary = 0;
      for (const [thetaValue, phiValue] of pairs) {
        const residual = denominator * thetaValue - numerator * phiValue;
        real += Math.cos(residual);
        imaginary += Math.sin(residual);
      }
      const candidate = Math.hypot(real, imaginary) / pairs.length;
      if (candidate > lockingValue) {
        lockingValue = candidate;
        lockingRatio = `${numerator}:${denominator}`;
      }
    }
  }
  const bins = new Set(pairs.map(([thetaValue, phiValue]) => `${Math.floor(thetaValue / (Math.PI * 2) * 12) % 12}:${Math.floor(phiValue / (Math.PI * 2) * 12) % 12}`));
  const jointCoverage = bins.size / 144;
  const interpretation = lockingValue >= EMPIRICAL_LOCKING_THRESHOLD
    ? `The estimated phases show strong ${lockingRatio ?? "low-order"} locking; this sample behaves more like a recurrent loop than broad T² coverage.`
    : jointCoverage < EMPIRICAL_COVERAGE_FLOOR
      ? "The phases are not strongly locked, but joint phase coverage is too sparse for the provisional torus gate."
      : "The estimates are not strongly low-order locked and cover enough joint phase bins for a provisional two-phase replay.";
  return { lockingValue, lockingRatio, jointCoverage, interpretation };
}

function quantile(values: number[], fraction: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function buildReplay(points: MappedEmpiricalPoint[], assumptions: EmpiricalModelAssumptions, thetaPhase: (number | undefined)[], phiPhase: (number | undefined)[]): EmpiricalReplay {
  const provisional = points.map((point, index) => {
    const prior = points[Math.max(0, index - 1)];
    const dt = index === 0 ? 0 : point.time - prior.time;
    const input: RadialBalanceInput = {
      pressure: prior.pressure,
      error: prior.error,
      feedback: prior.feedback,
      correction: prior.correction,
      drift: prior.drift,
      irreversibleLoss: prior.irreversibleLoss,
      debt: prior.debt,
      rho: prior.rho,
      ...assumptions,
    };
    const balance = evaluateRadialBalance(input);
    const predictedRho = index === 0 ? point.rho : Math.max(MIN_RHO, prior.rho + balance.radialRate * dt);
    const observedRadialVelocity = index === 0 ? 0 : (point.rho - prior.rho) / dt;
    const observedDebtVelocity = index === 0 ? 0 : (point.debt - prior.debt) / dt;
    const currentBalance = evaluateRadialBalance({
      pressure: point.pressure,
      error: point.error,
      feedback: point.feedback,
      correction: point.correction,
      drift: point.drift,
      irreversibleLoss: point.irreversibleLoss,
      debt: point.debt,
      rho: point.rho,
      ...assumptions,
    });
    const status = classifyStatus(point.rho, point.debt, currentBalance.correctionMargin, observedRadialVelocity, observedDebtVelocity, assumptions.rhoCrit);
    return {
      ...point,
      index,
      predictedRho,
      lowerRho: predictedRho,
      upperRho: predictedRho,
      residual: point.rho - predictedRho,
      observedRadialVelocity,
      observedDebtVelocity,
      balance,
      status,
      statusLabel: point.rho >= assumptions.rhoCrit ? (index > 0 && prior.rho < assumptions.rhoCrit ? "Boundary crossed" : "Recoverable excursion") : status,
      thetaPhase: thetaPhase[index],
      phiPhase: phiPhase[index],
    } satisfies EmpiricalReplayPoint;
  });
  const splitIndex = Math.max(2, Math.min(points.length - 1, Math.floor(points.length * EMPIRICAL_CALIBRATION_FRACTION)));
  const calibrationResiduals = provisional.slice(1, splitIndex).map((point) => point.residual);
  const residualInterval = { lower: quantile(calibrationResiduals, 0.05), upper: quantile(calibrationResiduals, 0.95) };
  const replayPoints = provisional.map((point) => ({
    ...point,
    lowerRho: Math.max(MIN_RHO, point.predictedRho + residualInterval.lower),
    upperRho: Math.max(MIN_RHO, point.predictedRho + residualInterval.upper),
  }));
  const holdout = replayPoints.slice(splitIndex);
  const holdoutRmse = Math.sqrt(holdout.reduce((sum, point) => sum + point.residual ** 2, 0) / Math.max(1, holdout.length));
  const holdoutMae = holdout.reduce((sum, point) => sum + Math.abs(point.residual), 0) / Math.max(1, holdout.length);
  const holdoutIntervalCoverage = holdout.filter((point) => point.rho >= point.lowerRho && point.rho <= point.upperRho).length / Math.max(1, holdout.length);
  return {
    points: replayPoints,
    calibrationRows: splitIndex,
    holdoutRows: holdout.length,
    holdoutRmse,
    holdoutMae,
    holdoutIntervalCoverage,
    residualInterval,
    uncertaintyMethod: "calibration-residual-90-percent",
    method: "one-step-observed-driver-replay",
  };
}

function cadenceIssue(points: MappedEmpiricalPoint[]) {
  const gaps = points.slice(1).map((point, index) => point.time - points[index].time);
  const median = quantile(gaps, 0.5);
  const mean = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
  const deviation = Math.sqrt(gaps.reduce((sum, value) => sum + (value - mean) ** 2, 0) / gaps.length);
  if (median <= 0) return "Time values must be strictly increasing.";
  if (Math.max(...gaps) / median > 2.5 || deviation / Math.max(mean, Number.EPSILON) > 0.35) {
    return "Sampling cadence is too irregular for this first-release phase estimator; resample or document a regular analysis grid.";
  }
  return "";
}

function mapPoints(dataset: EmpiricalDataset, mapping: EmpiricalColumnMapping, study: EmpiricalStudyDefinition) {
  const issues: string[] = [];
  const requiredDefinitions = empiricalRoleDefinitions.filter((item) => item.required);
  for (const definition of requiredDefinitions) {
    const entry = mapping[definition.role];
    if (!entry.column || !dataset.headers.includes(entry.column)) issues.push(`${definition.symbol} requires a mapped source column.`);
    if (!entry.unit.trim()) issues.push(`${definition.symbol} requires documented units or a declared dimensionless scale.`);
  }
  const selectedRequired = requiredDefinitions.map((item) => mapping[item.role].column).filter(Boolean);
  if (new Set(selectedRequired).size !== selectedRequired.length) issues.push("Each required canonical role must use a distinct observed column.");
  const studyFields = [study.name, study.objective, study.population, study.horizon, study.aggregation, study.viableRegion, study.internalCycle, study.externalCycle, study.falsification, study.provenance];
  if (studyFields.some((value) => value.trim().length < 8)) issues.push("Study definition, provenance, viable region, and falsification fields must be documented before replay.");
  if (issues.length) return { points: [] as MappedEmpiricalPoint[], issues };

  const points: MappedEmpiricalPoint[] = [];
  for (let rowIndex = 0; rowIndex < dataset.rows.length; rowIndex += 1) {
    const row = dataset.rows[rowIndex];
    const values = {} as Record<EmpiricalRole, number | string | undefined>;
    for (const definition of empiricalRoleDefinitions) {
      const column = mapping[definition.role].column;
      if (!column) continue;
      const raw = row[column];
      if (definition.numeric) {
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          issues.push(`Row ${rowIndex + 2}: ${definition.symbol} must be numeric.`);
          continue;
        }
        if (definition.bounds && (value < definition.bounds.min || value > definition.bounds.max)) {
          issues.push(`Row ${rowIndex + 2}: ${definition.symbol}=${value} is outside the declared model scale ${definition.bounds.min}…${definition.bounds.max}.`);
        }
        values[definition.role] = value;
      } else values[definition.role] = raw?.trim() || undefined;
    }
    points.push({
      time: values.time as number,
      thetaSignal: values.thetaSignal as number,
      phiSignal: values.phiSignal as number,
      pressure: values.pressure as number,
      error: values.error as number,
      feedback: values.feedback as number,
      correction: values.correction as number,
      drift: values.drift as number,
      irreversibleLoss: values.irreversibleLoss as number,
      debt: values.debt as number,
      rho: values.rho as number,
      outcome: values.outcome as string | undefined,
      intervention: values.intervention as string | undefined,
    });
    if (issues.length >= 20) break;
  }
  if (!issues.length) {
    const cadence = cadenceIssue(points);
    if (cadence) issues.push(cadence);
  }
  return { points, issues };
}

export function analyzeEmpiricalStudy(dataset: EmpiricalDataset, mapping: EmpiricalColumnMapping, study: EmpiricalStudyDefinition, assumptions: EmpiricalModelAssumptions): EmpiricalStudyAnalysis {
  const mapped = mapPoints(dataset, mapping, study);
  const dataReady = mapped.issues.length === 0 && mapped.points.length >= 32;
  if (!dataReady) {
    const issues = [...mapped.issues];
    if (mapped.points.length < 32) issues.push("At least 32 clean observations are required for the first-release empirical replay.");
    return {
      issues,
      mappedPoints: mapped.points,
      internalPhase: emptyPhaseDiagnostics,
      externalPhase: emptyPhaseDiagnostics,
      phaseRelationship: { lockingValue: 0, jointCoverage: 0, interpretation: "Phase relationship is withheld until data-quality gates pass." },
      gates: [
        { id: "data-quality", label: "Data quality", passed: false, state: "fail", detail: issues[0] ?? "Data are incomplete." },
        { id: "internal-recurrence", label: "Internal recurrence", passed: false, state: "blocked", detail: "Blocked by data quality." },
        { id: "external-recurrence", label: "External recurrence", passed: false, state: "blocked", detail: "Blocked by data quality." },
        { id: "phase-independence", label: "Phase independence", passed: false, state: "blocked", detail: "Blocked until both phases are identifiable." },
        { id: "holdout", label: "Holdout", passed: false, state: "blocked", detail: "Blocked by data quality." },
      ],
      replay: null,
      torusReplayReady: false,
      modelSupport: "insufficient-data",
      evidenceLevel: "observed-descriptive",
    };
  }

  const internalAnalysis = analyzeExternalTelemetry(mapped.points.map((point) => ({ time: point.time, mismatch: point.thetaSignal })));
  const externalAnalysis = analyzeExternalTelemetry(mapped.points.map((point) => ({ time: point.time, mismatch: point.phiSignal })));
  const thetaPhase = internalAnalysis.samples.map((sample) => sample.estimatedPhase);
  const phiPhase = externalAnalysis.samples.map((sample) => sample.estimatedPhase);
  const relationship = phaseRelationship(thetaPhase, phiPhase);
  const phaseIndependent = internalAnalysis.diagnostics.identifiable && externalAnalysis.diagnostics.identifiable && relationship.lockingValue < EMPIRICAL_LOCKING_THRESHOLD && relationship.jointCoverage >= EMPIRICAL_COVERAGE_FLOOR;
  const holdoutReady = mapped.points.length >= 80;
  const replay = buildReplay(mapped.points, assumptions, thetaPhase, phiPhase);
  const torusReplayReady = internalAnalysis.diagnostics.identifiable && externalAnalysis.diagnostics.identifiable && phaseIndependent && holdoutReady;
  const gates: EmpiricalGate[] = [
    { id: "data-quality", label: "Data quality", passed: true, state: "pass", detail: `${mapped.points.length} rows; mapped values, units, provenance, and cadence pass.` },
    { id: "internal-recurrence", label: "Internal recurrence", passed: internalAnalysis.diagnostics.identifiable, state: internalAnalysis.diagnostics.identifiable ? "pass" : "fail", detail: internalAnalysis.diagnostics.identifiable ? `${internalAnalysis.diagnostics.estimatedMajorCycles.toFixed(1)} cycles; spectral concentration ${internalAnalysis.diagnostics.spectralConcentration.toFixed(3)}.` : `Gate failed: ${internalAnalysis.diagnostics.reason}.` },
    { id: "external-recurrence", label: "External recurrence", passed: externalAnalysis.diagnostics.identifiable, state: externalAnalysis.diagnostics.identifiable ? "pass" : "fail", detail: externalAnalysis.diagnostics.identifiable ? `${externalAnalysis.diagnostics.estimatedMajorCycles.toFixed(1)} cycles; spectral concentration ${externalAnalysis.diagnostics.spectralConcentration.toFixed(3)}.` : `Gate failed: ${externalAnalysis.diagnostics.reason}.` },
    { id: "phase-independence", label: "Phase independence", passed: phaseIndependent, state: phaseIndependent ? "pass" : "fail", detail: relationship.interpretation },
    { id: "holdout", label: "Holdout", passed: holdoutReady, state: holdoutReady ? "ready" : "fail", detail: holdoutReady ? `${replay.holdoutRows} rows reserved for evaluation; no model parameters were fitted.` : "At least 80 rows are required to reserve a meaningful holdout segment." },
  ];
  return {
    issues: [],
    mappedPoints: mapped.points,
    internalPhase: internalAnalysis.diagnostics,
    externalPhase: externalAnalysis.diagnostics,
    phaseRelationship: relationship,
    gates,
    replay,
    torusReplayReady,
    modelSupport: torusReplayReady ? "provisional" : "not-supported",
    evidenceLevel: "observed-descriptive",
  };
}

export function empiricalCursorExplanation(point: EmpiricalReplayPoint, assumptions: EmpiricalModelAssumptions) {
  const contributions = [
    { label: "pressure-weighted error", symbol: "π·ε·(1−γ)", value: point.balance.pressureWeightedError },
    { label: "drift and irreversible loss", symbol: "Φ+Λ", value: point.balance.driftAndLoss },
    { label: "debt pressure", symbol: "χΔ", value: point.balance.debtPressure },
    { label: "restoration", symbol: "−κ(ρ−ρ₀)", value: point.balance.restoration },
    { label: "correction", symbol: "−C", value: -point.balance.correction },
  ];
  const dominant = [...contributions].sort((left, right) => Math.abs(right.value) - Math.abs(left.value))[0];
  const direction = point.observedRadialVelocity > 0.01 ? "expansion" : point.observedRadialVelocity < -0.01 ? "contraction" : "near-flat movement";
  const residualRate = point.observedRadialVelocity - point.balance.radialRate;
  return {
    direction,
    dominant,
    contributions,
    residualRate,
    statement: `At this cursor, the declared model attributes the largest modeled contribution to ${dominant.label} (${dominant.symbol}=${dominant.value >= 0 ? "+" : ""}${dominant.value.toFixed(3)}). Observed ${direction} differs from the model rate by ${residualRate >= 0 ? "+" : ""}${residualRate.toFixed(3)} per time unit.`,
    boundary: `The status uses the declared ρcrit=${assumptions.rhoCrit.toFixed(3)}. This is model-based attribution, not causal identification or empirical validation of the theory.`,
  };
}

export function exampleEmpiricalStudy(scenario: ScenarioDefinition) {
  const assumptions = empiricalAssumptionsForScenario(scenario);
  const headers = ["time", "internal_cycle_signal", "external_cycle_signal", "pressure", "error", "feedback", "correction", "drift", "irreversible_loss", "debt", "rho", "outcome", "intervention"];
  const rows: EmpiricalCsvRow[] = [];
  let rho = Math.max(0.48, assumptions.rho0 + 0.1);
  let debt = 0.18;
  const dt = 0.5;
  for (let index = 0; index < 240; index += 1) {
    const theta = index / 20 * Math.PI * 2;
    const phi = index / (20 * Math.SQRT2) * Math.PI * 2;
    const stressed = index >= 72 && index < 128;
    const recovery = index >= 128;
    const pressure = stressed ? 2.15 + 0.12 * Math.sin(phi) : recovery ? 0.95 + 0.08 * Math.sin(phi) : 1.2 + 0.1 * Math.sin(phi);
    const error = stressed ? 0.52 + 0.04 * Math.sin(theta) : recovery ? 0.22 + 0.03 * Math.sin(theta) : 0.32 + 0.035 * Math.sin(theta);
    const feedback = stressed ? 0.42 + 0.03 * Math.cos(theta) : recovery ? 0.76 + 0.025 * Math.cos(theta) : 0.62 + 0.03 * Math.cos(theta);
    const correction = stressed ? 0.32 + 0.04 * Math.cos(theta) : recovery ? 0.3 + 0.03 * Math.cos(theta) : 0.24 + 0.035 * Math.cos(theta);
    const drift = stressed ? 0.14 + 0.015 * Math.sin(phi) : 0.05 + 0.008 * Math.sin(phi);
    const irreversibleLoss = stressed ? 0.06 : 0.015;
    const balance = evaluateRadialBalance({ pressure, error, feedback, correction, drift, irreversibleLoss, debt, rho, ...assumptions });
    const residual = index === 0 ? 0 : 0.012 * Math.sin(index * 0.73) + 0.006 * Math.cos(index * 0.19);
    if (index > 0) rho = Math.max(MIN_RHO, rho + balance.radialRate * dt + residual);
    const debtRate = 0.16 * Math.max(balance.divergence - correction, 0) - 0.1 * Math.max(correction - balance.divergence, 0) * Math.exp(-rho);
    if (index > 0) debt = Math.max(0, debt + debtRate * dt);
    const outcome = rho >= assumptions.rhoCrit ? "outside-declared-boundary" : rho >= assumptions.rhoCrit * 0.84 ? "warning-band" : "inside-declared-boundary";
    const intervention = index === 72 ? "demand shock begins" : index === 128 ? "recovery protocol begins" : "";
    const values = [
      (index * dt).toFixed(3),
      (0.55 + 0.32 * Math.cos(theta) + 0.04 * Math.cos(theta * 2)).toFixed(6),
      (0.5 + 0.28 * Math.cos(phi) + 0.04 * Math.cos(phi * 2)).toFixed(6),
      pressure.toFixed(6), error.toFixed(6), feedback.toFixed(6), correction.toFixed(6), drift.toFixed(6), irreversibleLoss.toFixed(6), debt.toFixed(6), rho.toFixed(6), outcome, intervention,
    ];
    rows.push(Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex]])));
  }
  const dataset: EmpiricalDataset = {
    name: "bundled-observed-form-demonstration.csv",
    headers,
    rows,
    provenance: `Bundled deterministic observed-form demonstration generated with ${MODEL_VERSION}; replace it with documented real measurements before drawing empirical conclusions.`,
    sourceKind: "bundled-observed-form-demo",
  };
  const mapping = autoMapEmpiricalColumns(dataset);
  const study = {
    ...studyDefinitionForScenario(scenario),
    name: `${scenario.shortTitle} observed-form demonstration`,
    population: "Illustrative units in the bundled demonstration; no real people or systems are represented.",
    horizon: "120 dimensionless observation-time units sampled every 0.5 units.",
    aggregation: "One aggregate observed-form trajectory; subgroup inference is not available.",
    provenance: dataset.provenance,
  };
  return { dataset, mapping, study, assumptions };
}
