import { CONTRACT_VERSION } from "../contracts/constants.ts";
import { empiricalEvidenceBundleSchema, type ParsedEmpiricalReceipt } from "../contracts/schemas.ts";
import { MODEL_VERSION } from "../engine/simulator.ts";
import type { ScenarioDefinition } from "../scenarios/catalog.ts";
import { analyzeEmpiricalStudy, empiricalRoleDefinitions, exampleEmpiricalStudy } from "./analysis.ts";

export function createSyntheticRegistryDemo(scenario: ScenarioDefinition): ParsedEmpiricalReceipt[] {
  const example = exampleEmpiricalStudy(scenario);
  const analysis = analyzeEmpiricalStudy(example.dataset, example.mapping, example.study, example.assumptions);
  if (!analysis.replay) throw new Error("The bundled demonstration must produce replay results.");
  const finalStatus = analysis.replay.points.at(-1)?.statusLabel ?? "Replay complete";
  const baseReplay = {
    method: analysis.replay.method,
    uncertaintyMethod: analysis.replay.uncertaintyMethod,
    calibrationRows: analysis.replay.calibrationRows,
    holdoutRows: analysis.replay.holdoutRows,
    holdoutRmse: analysis.replay.holdoutRmse,
    holdoutMae: analysis.replay.holdoutMae,
    holdoutIntervalCoverage: analysis.replay.holdoutIntervalCoverage,
    finalStatus,
  };
  const baseValidation = {
    evidenceLevel: analysis.evidenceLevel,
    modelSupport: analysis.modelSupport,
    torusReplayReady: analysis.torusReplayReady,
    gates: analysis.gates,
    internalPhase: phaseReceipt(analysis.internalPhase),
    externalPhase: phaseReceipt(analysis.externalPhase),
    phaseRelationship: analysis.phaseRelationship,
  };
  const mapping = empiricalRoleDefinitions.map((definition) => ({ role: definition.role, symbol: definition.symbol, ...example.mapping[definition.role] }));

  type DemoReceiptOptions = {
    name: string;
    hash: string;
    rows: number;
    sourceKind?: "imported-observation" | "bundled-observed-form-demo";
    scenarioVersion?: string;
    horizon?: string;
    preprocessing?: string[];
    negative?: boolean;
    holdoutRmse?: number;
    intervalCoverage?: number;
  };
  const make = ({
    name,
    hash,
    rows,
    sourceKind = "imported-observation",
    scenarioVersion = scenario.version,
    horizon = example.study.horizon,
    preprocessing = ["CSV values were parsed without rescaling; mapped proxies were evaluated on their declared units or scales"] as string[] | undefined,
    negative = false,
    holdoutRmse = baseReplay.holdoutRmse,
    intervalCoverage = baseReplay.holdoutIntervalCoverage,
  }: DemoReceiptOptions) => empiricalEvidenceBundleSchema.parse({
    schemaVersion: CONTRACT_VERSION,
    kind: "browser-local-empirical-study",
    modelVersion: MODEL_VERSION,
    scenarioId: scenario.id,
    scenarioVersion,
    exportedAt: "2026-07-14T12:00:00.000Z",
    study: { ...example.study, name, horizon },
    source: {
      name: `${name.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-")}.csv`,
      kind: sourceKind,
      ...(preprocessing ? { preprocessing } : {}),
      rows,
      columns: example.dataset.headers.length,
      datasetSha256: hash.repeat(64),
      localOnly: true,
      rawDataIncluded: false,
    },
    mapping,
    assumptions: { ...example.assumptions, provenance: "declared-not-fitted" },
    validation: negative ? {
      ...baseValidation,
      modelSupport: "not-supported",
      torusReplayReady: false,
      gates: baseValidation.gates.map((gate) => gate.id === "external-recurrence"
        ? { ...gate, passed: false, state: "fail", detail: "The external recurrent phase was not identifiable; preserved as a negative result." }
        : gate.id === "phase-independence" || gate.id === "holdout"
          ? { ...gate, passed: false, state: "blocked", detail: "Blocked by the failed external recurrence gate." }
          : gate),
      externalPhase: { ...baseValidation.externalPhase, identifiable: false, reason: "low-amplitude" },
    } : baseValidation,
    replay: negative ? null : { ...baseReplay, holdoutRmse, holdoutIntervalCoverage: intervalCoverage },
    limitations: [
      "This is a synthetic registry demonstration and is not empirical evidence.",
      "Raw observations are excluded; the study record contains only redacted study details and diagnostics.",
      "Compatibility and cohort metrics are descriptive and do not establish causality or validate the theory.",
    ],
  });

  return [
    make({ name: "Study A — service operations", hash: "a", rows: 240, holdoutRmse: 0.103, intervalCoverage: 0.906 }),
    make({ name: "Study B — service operations", hash: "b", rows: 310, holdoutRmse: 0.118, intervalCoverage: 0.922 }),
    make({ name: "Study C — adjacent cohort", hash: "c", rows: 185, horizon: `${example.study.horizon} (extended observation window)`, preprocessing: [], negative: true }),
    make({ name: "Study D — different boundary", hash: "d", rows: 400, scenarioVersion: "1.0.0", holdoutRmse: 0.097, intervalCoverage: 0.934 }),
    make({ name: "Synthetic teaching example", hash: "e", rows: 240, sourceKind: "bundled-observed-form-demo", holdoutRmse: 0.103, intervalCoverage: 0.906 }),
  ];
}

function phaseReceipt(phase: ReturnType<typeof analyzeEmpiricalStudy>["internalPhase"]) {
  return {
    identifiable: phase.identifiable,
    reason: phase.reason,
    spectralConcentration: phase.spectralConcentration,
    estimatedCycles: phase.estimatedMajorCycles,
  };
}
