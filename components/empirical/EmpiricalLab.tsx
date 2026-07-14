"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CONTRACT_VERSION, PARAMETER_LIMITS } from "@/contracts/constants";
import { empiricalEvidenceBundleSchema, type ParsedEmpiricalEvidenceBundle } from "@/contracts/schemas";
import { MODEL_VERSION } from "@/engine/simulator";
import {
  analyzeEmpiricalStudy,
  autoMapEmpiricalColumns,
  empiricalAssumptionsForScenario,
  empiricalCursorExplanation,
  empiricalRoleDefinitions,
  emptyEmpiricalMapping,
  exampleEmpiricalStudy,
  parseEmpiricalCsv,
  studyDefinitionForScenario,
  type EmpiricalColumnMapping,
  type EmpiricalDataset,
  type EmpiricalModelAssumptions,
  type EmpiricalReplay,
  type EmpiricalReplayPoint,
  type EmpiricalRole,
  type EmpiricalStudyAnalysis,
  type EmpiricalStudyDefinition,
} from "@/empirical/analysis";
import type { ScenarioDefinition } from "@/scenarios/catalog";

type Props = {
  scenario: ScenarioDefinition;
  announce: (message: string) => void;
  onRegisterEvidence?: (receipt: ParsedEmpiricalEvidenceBundle) => void;
};

type WorkflowStep = "study" | "data" | "map" | "validate" | "replay" | "export";

const workflowSteps: { id: WorkflowStep; label: string }[] = [
  { id: "study", label: "Study" },
  { id: "data", label: "Data" },
  { id: "map", label: "Map" },
  { id: "validate", label: "Validate" },
  { id: "replay", label: "Replay" },
  { id: "export", label: "Export" },
];

const assumptionMeta: { key: keyof EmpiricalModelAssumptions; symbol: string; label: string; note: string }[] = [
  { key: "kappa", symbol: "κ", label: "Restoration", note: "Declared restoring coefficient" },
  { key: "rho0", symbol: "ρ₀", label: "Reference excursion", note: "Declared healthy reference" },
  { key: "chi", symbol: "χ", label: "Debt coupling", note: "Declared debt pressure" },
  { key: "rhoCrit", symbol: "ρcrit", label: "Viability boundary", note: "Declared and not calibrated here" },
];

export function EmpiricalLab({ scenario, announce, onRegisterEvidence }: Props) {
  const initial = useMemo(() => exampleEmpiricalStudy(scenario), [scenario]);
  const [activeStep, setActiveStep] = useState<WorkflowStep>("replay");
  const [dataset, setDataset] = useState<EmpiricalDataset | null>(initial.dataset);
  const [mapping, setMapping] = useState<EmpiricalColumnMapping>(initial.mapping);
  const [study, setStudy] = useState<EmpiricalStudyDefinition>(initial.study);
  const [assumptions, setAssumptions] = useState<EmpiricalModelAssumptions>(initial.assumptions);
  const [datasetHash, setDatasetHash] = useState("");
  const [cursor, setCursor] = useState(Math.floor(initial.dataset.rows.length * 0.58));
  const [playing, setPlaying] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(
    () => dataset ? analyzeEmpiricalStudy(dataset, mapping, study, assumptions) : null,
    [assumptions, dataset, mapping, study],
  );
  const replay = analysis?.replay;
  const isBundledExample = dataset?.sourceKind === "bundled-observed-form-demo";
  const safeCursor = Math.min(cursor, Math.max(0, (replay?.points.length ?? 1) - 1));
  const currentPoint = replay?.points[safeCursor];
  const cursorExplanation = useMemo(
    () => currentPoint ? empiricalCursorExplanation(currentPoint, assumptions) : null,
    [assumptions, currentPoint],
  );

  useEffect(() => {
    if (!dataset) return;
    let active = true;
    const fingerprintInput = JSON.stringify({ headers: dataset.headers, rows: dataset.rows });
    void sha256Hex(fingerprintInput).then((hash) => { if (active) setDatasetHash(hash); });
    return () => { active = false; };
  }, [dataset]);

  useEffect(() => {
    if (!playing || !replay) return;
    const timer = window.setInterval(() => {
      setCursor((value) => {
        if (value >= replay.points.length - 1) { setPlaying(false); return value; }
        return value + 1;
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [playing, replay]);

  const loadExample = () => {
    const example = exampleEmpiricalStudy(scenario);
    setDataset(example.dataset);
    setMapping(example.mapping);
    setStudy(example.study);
    setAssumptions(example.assumptions);
    setCursor(Math.floor(example.dataset.rows.length * 0.58));
    setPlaying(false);
    setActiveStep("replay");
    announce("Bundled observed-form demonstration loaded; it is synthetic, not empirical evidence");
  };

  const resetStudy = () => {
    setDataset(null);
    setMapping(emptyEmpiricalMapping());
    setStudy(studyDefinitionForScenario(scenario));
    setAssumptions(empiricalAssumptionsForScenario(scenario));
    setDatasetHash("");
    setCursor(0);
    setPlaying(false);
    setActiveStep("study");
    announce("Browser-local empirical study cleared");
  };

  const importDataset = async (file: File) => {
    try {
      if (file.size > 2_000_000) throw new Error("Empirical CSV must be smaller than 2 MB");
      const parsed = parseEmpiricalCsv(await file.text(), file.name);
      setDataset(parsed);
      setMapping(autoMapEmpiricalColumns(parsed));
      setStudy({
        ...studyDefinitionForScenario(scenario),
        name: file.name.replace(/\.csv$/i, "") || `${scenario.shortTitle} observational study`,
      });
      setAssumptions(empiricalAssumptionsForScenario(scenario));
      setCursor(0);
      setPlaying(false);
      setActiveStep("map");
      announce(`${parsed.rows.length} browser-local observations imported; complete mapping and provenance next`);
    } catch (error) {
      announce(error instanceof Error ? error.message : "Empirical CSV could not be imported");
    }
  };

  const setMappingEntry = (role: EmpiricalRole, patch: Partial<EmpiricalColumnMapping[EmpiricalRole]>) => {
    setMapping((current) => ({
      ...current,
      [role]: {
        ...current[role],
        ...patch,
        evidence: patch.column === "" ? "not-mapped" : patch.column ? "uploaded-observation" : current[role].evidence,
      },
    }));
    setPlaying(false);
  };

  const setAssumption = (key: keyof EmpiricalModelAssumptions, value: number) => {
    const limitKey = key === "rhoCrit" ? "rhoCrit" : key === "rho0" ? "rho0" : key;
    const limit = PARAMETER_LIMITS[limitKey];
    const bounded = Math.max(limit.min, Math.min(limit.max, value));
    setAssumptions((current) => ({
      ...current,
      [key]: key === "rho0" ? Math.min(bounded, current.rhoCrit - 0.001) : key === "rhoCrit" ? Math.max(bounded, current.rho0 + 0.001) : bounded,
    }));
  };

  const buildEvidenceBundle = (): ParsedEmpiricalEvidenceBundle | null => {
    if (!dataset || !analysis || !datasetHash) return null;
    const finalPoint = analysis.replay?.points.at(-1);
    return empiricalEvidenceBundleSchema.parse({
      schemaVersion: CONTRACT_VERSION,
      kind: "browser-local-empirical-study",
      modelVersion: MODEL_VERSION,
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      exportedAt: new Date().toISOString(),
      study,
      source: {
        name: dataset.name,
        kind: dataset.sourceKind,
        preprocessing: ["CSV values were parsed without rescaling; mapped proxies were evaluated on their declared units or scales"],
        rows: dataset.rows.length,
        columns: dataset.headers.length,
        datasetSha256: datasetHash,
        localOnly: true,
        rawDataIncluded: false,
      },
      mapping: empiricalRoleDefinitions.map((definition) => ({
        role: definition.role,
        symbol: definition.symbol,
        ...mapping[definition.role],
      })),
      assumptions: { ...assumptions, provenance: "declared-not-fitted" },
      validation: {
        evidenceLevel: analysis.evidenceLevel,
        modelSupport: analysis.modelSupport,
        torusReplayReady: analysis.torusReplayReady,
        gates: analysis.gates,
        internalPhase: phaseReceipt(analysis.internalPhase),
        externalPhase: phaseReceipt(analysis.externalPhase),
        phaseRelationship: analysis.phaseRelationship,
      },
      replay: analysis.replay ? {
        method: analysis.replay.method,
        uncertaintyMethod: analysis.replay.uncertaintyMethod,
        calibrationRows: analysis.replay.calibrationRows,
        holdoutRows: analysis.replay.holdoutRows,
        holdoutRmse: analysis.replay.holdoutRmse,
        holdoutMae: analysis.replay.holdoutMae,
        holdoutIntervalCoverage: analysis.replay.holdoutIntervalCoverage,
        finalStatus: finalPoint?.statusLabel ?? "Replay unavailable",
      } : null,
      limitations: [
        "The source data remain local and are not included in this receipt; the SHA-256 fingerprint covers the canonical parsed table, not the original file bytes.",
        "Canonical columns are declared proxies on documented scales; this first release does not infer or fit domain transformations or model parameters.",
        "Phase recurrence and non-locking gates are descriptive diagnostics and do not by themselves establish T² topology.",
        "The replay evaluates one-step radial predictions from observed drivers; it is not a causal model or empirical validation of ATS, AANA, AIx, or the torus hypothesis.",
      ],
    });
  };

  const exportEvidence = () => {
    const bundle = buildEvidenceBundle();
    if (!bundle) return;
    downloadJson(`${slug(study.name)}.empirical-evidence.json`, bundle);
    announce("Browser-local evidence receipt exported without raw observations");
  };

  const registerEvidence = () => {
    const bundle = buildEvidenceBundle();
    if (!bundle || !onRegisterEvidence) return;
    onRegisterEvidence(bundle);
  };

  return (
    <div className="page-view empirical-page">
      <section className="empirical-heading">
        <div>
          <h1>Empirical Lab</h1>
          <p>Bring observations into the model without calling a fit proof.</p>
        </div>
        <div className="empirical-evidence-labels" aria-label="Evidence classification">
          <span>Browser-local</span>
          <span>{isBundledExample ? "Synthetic example · observed-form" : "Observed descriptive"}</span>
          <span className={!isBundledExample && analysis?.modelSupport === "provisional" ? "support-provisional" : "support-pending"}>{isBundledExample ? "Synthetic demonstration only" : `Model support ${analysis?.modelSupport === "provisional" ? "provisional" : analysis?.modelSupport === "not-supported" ? "not supported" : "pending"}`}</span>
        </div>
      </section>

      <nav className="empirical-workflow" aria-label="Empirical study workflow">
        {workflowSteps.map((step, index) => <button key={step.id} className={activeStep === step.id ? "active" : ""} onClick={() => setActiveStep(step.id)}><span>{index + 1}</span>{step.label}</button>)}
      </nav>

      <section className="empirical-dataset-strip">
        <div><small>Study hypothesis</small><strong>{study.name || `${scenario.shortTitle} observational study`}</strong><span>{scenario.shortTitle} · {isBundledExample ? "bundled synthetic data" : "imported observations"} · parameters declared, not fitted</span></div>
        <dl>
          <div><dt>Rows</dt><dd>{dataset?.rows.length ?? 0}</dd></div>
          <div><dt>Columns</dt><dd>{dataset?.headers.length ?? 0}</dd></div>
          <div><dt>Units</dt><dd>{mappingUnitsDocumented(mapping) ? "Documented" : "Incomplete"}</dd></div>
          <div><dt>Provenance</dt><dd>{study.provenance.trim().length >= 8 ? "Documented" : "Required"}</dd></div>
        </dl>
        <div className="empirical-actions">
          <button className="primary" onClick={() => importRef.current?.click()}>⇧ Import CSV</button>
          <button onClick={loadExample}>Load example</button>
          <button onClick={resetStudy}>Reset study</button>
          <button disabled={!analysis || !datasetHash || !onRegisterEvidence} onClick={registerEvidence}>Add to registry</button>
          <button disabled={!analysis || !datasetHash} onClick={exportEvidence}>Export evidence</button>
        </div>
        <input ref={importRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importDataset(file); event.target.value = ""; }} />
      </section>

      {activeStep === "study" && <StudyStep study={study} setStudy={setStudy} assumptions={assumptions} setAssumption={setAssumption} scenario={scenario} next={() => setActiveStep("data")} />}
      {activeStep === "data" && <DataStep dataset={dataset} study={study} setStudy={setStudy} importFile={() => importRef.current?.click()} loadExample={loadExample} next={() => setActiveStep("map")} />}
      {activeStep === "map" && <MappingStep dataset={dataset} mapping={mapping} setMappingEntry={setMappingEntry} analysis={analysis} next={() => setActiveStep("validate")} />}
      {activeStep === "validate" && <ValidationStep analysis={analysis} assumptions={assumptions} setAssumption={setAssumption} next={() => setActiveStep("replay")} />}
      {activeStep === "replay" && <ReplayStep dataset={dataset} mapping={mapping} analysis={analysis} replay={replay} cursor={safeCursor} setCursor={setCursor} point={currentPoint} explanation={cursorExplanation} playing={playing} setPlaying={setPlaying} assumptions={assumptions} />}
      {activeStep === "export" && <ExportStep dataset={dataset} datasetHash={datasetHash} analysis={analysis} mapping={mapping} exportEvidence={exportEvidence} registerEvidence={registerEvidence} canRegister={Boolean(onRegisterEvidence)} />}
    </div>
  );
}

function StudyStep({ study, setStudy, assumptions, setAssumption, scenario, next }: { study: EmpiricalStudyDefinition; setStudy: React.Dispatch<React.SetStateAction<EmpiricalStudyDefinition>>; assumptions: EmpiricalModelAssumptions; setAssumption: (key: keyof EmpiricalModelAssumptions, value: number) => void; scenario: ScenarioDefinition; next: () => void }) {
  const fields: { key: keyof EmpiricalStudyDefinition; label: string; placeholder: string; wide?: boolean }[] = [
    { key: "name", label: "Study name", placeholder: "Recognizable study name" },
    { key: "objective", label: "Observed system objective", placeholder: "What is being optimized?" },
    { key: "population", label: "Reference population ω", placeholder: "Who or what must remain viable?" },
    { key: "horizon", label: "Time horizon τ", placeholder: "What time horizon does the evidence cover?" },
    { key: "aggregation", label: "Aggregation rule α", placeholder: "How are heterogeneous outcomes combined?", wide: true },
    { key: "viableRegion", label: "Viable region X*", placeholder: "What observed outcomes count as viable?", wide: true },
    { key: "internalCycle", label: "Internal recurrent cycle θ", placeholder: "Operational or correction cycle" },
    { key: "externalCycle", label: "External recurrent cycle φ", placeholder: "Environmental or adaptation cycle" },
    { key: "falsification", label: "Falsification condition", placeholder: "What result would count against this mapping?", wide: true },
  ];
  return <section className="empirical-step empirical-study-step"><header><div><span>Study design</span><h2>Pre-register what the data are meant to test</h2></div><p>The selected scenario supplies vocabulary, not calibration. Define perspective, horizon, two proposed cycles, and a result that would count against the mapping.</p></header><div className="empirical-study-grid">{fields.map((field) => <label key={field.key} className={field.wide ? "wide" : ""}><span>{field.label}</span>{field.wide ? <textarea value={study[field.key]} placeholder={field.placeholder} onChange={(event) => setStudy((current) => ({ ...current, [field.key]: event.target.value }))} /> : <input value={study[field.key]} placeholder={field.placeholder} onChange={(event) => setStudy((current) => ({ ...current, [field.key]: event.target.value }))} />}</label>)}</div><section className="empirical-assumptions"><header><strong>Declared radial assumptions</strong><span>No automated parameter fitting in this release</span></header><div>{assumptionMeta.map((item) => <label key={item.key}><span>{item.symbol} · {item.label}</span><input type="number" value={assumptions[item.key]} min={PARAMETER_LIMITS[item.key].min} max={PARAMETER_LIMITS[item.key].max} step="0.01" onChange={(event) => setAssumption(item.key, Number(event.target.value))} /><small>{item.note}</small></label>)}</div><p>Scenario source: <strong>{scenario.title}</strong>. These values remain hypotheses until independently calibrated.</p></section><footer><button className="primary" onClick={next}>Continue to data →</button></footer></section>;
}

function DataStep({ dataset, study, setStudy, importFile, loadExample, next }: { dataset: EmpiricalDataset | null; study: EmpiricalStudyDefinition; setStudy: React.Dispatch<React.SetStateAction<EmpiricalStudyDefinition>>; importFile: () => void; loadExample: () => void; next: () => void }) {
  return <section className="empirical-step empirical-data-step"><header><div><span>Browser-local source</span><h2>Import a documented multi-column observation table</h2></div><p>CSV values never leave this browser. The first release accepts up to 5,000 rows and 64 columns and does not retain data after the page session ends.</p></header><div className="empirical-dropzone"><strong>{dataset ? dataset.name : "Drop-in through the file chooser"}</strong><p>{dataset ? `${dataset.rows.length} rows × ${dataset.headers.length} columns currently loaded.` : "Required roles include time, two recurrent signals, π, ε, γ, C, Φ, Λ, Δ, and observed ρ."}</p><div><button className="primary" onClick={importFile}>Import CSV</button><button onClick={loadExample}>Load bundled example</button></div></div><label className="empirical-provenance"><span>Data provenance</span><textarea value={study.provenance} onChange={(event) => setStudy((current) => ({ ...current, provenance: event.target.value }))} placeholder="Instrument, collection process, preprocessing, exclusions, ownership, and data steward" /><small>A filename is not provenance. Document how each observation came to exist.</small></label>{dataset && <section className="empirical-preview"><header><strong>Source preview</strong><span>First 5 rows · raw values remain browser-local</span></header><div className="table-wrap"><table><thead><tr>{dataset.headers.slice(0, 8).map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{dataset.rows.slice(0, 5).map((row, index) => <tr key={index}>{dataset.headers.slice(0, 8).map((header) => <td key={header}>{row[header]}</td>)}</tr>)}</tbody></table></div></section>}<footer><button className="primary" disabled={!dataset} onClick={next}>Map columns →</button></footer></section>;
}

function MappingStep({ dataset, mapping, setMappingEntry, analysis, next }: { dataset: EmpiricalDataset | null; mapping: EmpiricalColumnMapping; setMappingEntry: (role: EmpiricalRole, patch: Partial<EmpiricalColumnMapping[EmpiricalRole]>) => void; analysis: EmpiricalStudyAnalysis | null; next: () => void }) {
  if (!dataset) return <EmptyEmpiricalState title="No observation table loaded" copy="Import a multi-column CSV or load the bundled demonstration before mapping variables." />;
  return <section className="empirical-step"><header><div><span>Evidence mapping</span><h2>Connect observed columns to the paper variables</h2></div><p>Mapping is explicit. The lab does not infer transformations or silently normalize domain units onto model scales.</p></header><MappingTable dataset={dataset} mapping={mapping} setMappingEntry={setMappingEntry} /><section className={`empirical-mapping-receipt ${analysis?.issues.length ? "has-issues" : "ready"}`}><strong>{analysis?.issues.length ? "Mapping or documentation needs attention" : "Mapping receipt is ready for evidence gates"}</strong>{analysis?.issues.length ? <ul>{analysis.issues.slice(0, 8).map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>Every required role uses a distinct column, declares units, and falls within the documented canonical scale.</p>}</section><footer><button className="primary" onClick={next}>Run evidence gates →</button></footer></section>;
}

function ValidationStep({ analysis, assumptions, setAssumption, next }: { analysis: EmpiricalStudyAnalysis | null; assumptions: EmpiricalModelAssumptions; setAssumption: (key: keyof EmpiricalModelAssumptions, value: number) => void; next: () => void }) {
  if (!analysis) return <EmptyEmpiricalState title="No study to validate" copy="Complete the study, data, and mapping steps first." />;
  return <section className="empirical-step"><header><div><span>Verifier stack</span><h2>Make failed evidence gates visible</h2></div><p>Passing recurrence and non-locking diagnostics permits a provisional replay. It does not establish topology or validate the domain mapping.</p></header><GateRail analysis={analysis} expanded /><div className="empirical-validation-grid"><section><h3>Internal phase θ</h3><dl><div><dt>Identifiable</dt><dd>{analysis.internalPhase.identifiable ? "Yes" : "No"}</dd></div><div><dt>Reason</dt><dd>{analysis.internalPhase.reason}</dd></div><div><dt>Estimated cycles</dt><dd>{analysis.internalPhase.estimatedMajorCycles.toFixed(1)}</dd></div><div><dt>Spectral concentration</dt><dd>{analysis.internalPhase.spectralConcentration.toFixed(3)}</dd></div></dl></section><section><h3>External phase φ</h3><dl><div><dt>Identifiable</dt><dd>{analysis.externalPhase.identifiable ? "Yes" : "No"}</dd></div><div><dt>Reason</dt><dd>{analysis.externalPhase.reason}</dd></div><div><dt>Estimated cycles</dt><dd>{analysis.externalPhase.estimatedMajorCycles.toFixed(1)}</dd></div><div><dt>Spectral concentration</dt><dd>{analysis.externalPhase.spectralConcentration.toFixed(3)}</dd></div></dl></section><section><h3>Joint relationship</h3><dl><div><dt>Strongest low-order locking</dt><dd>{analysis.phaseRelationship.lockingValue.toFixed(3)}</dd></div><div><dt>Candidate ratio</dt><dd>{analysis.phaseRelationship.lockingRatio ?? "None"}</dd></div><div><dt>Joint phase coverage</dt><dd>{(analysis.phaseRelationship.jointCoverage * 100).toFixed(1)}%</dd></div></dl><p>{analysis.phaseRelationship.interpretation}</p></section></div><section className="empirical-assumptions compact"><header><strong>Declared—not fitted—assumptions</strong><span>Changing these changes the replay hypothesis</span></header><div>{assumptionMeta.map((item) => <label key={item.key}><span>{item.symbol}</span><input type="number" value={assumptions[item.key]} min={PARAMETER_LIMITS[item.key].min} max={PARAMETER_LIMITS[item.key].max} step="0.01" onChange={(event) => setAssumption(item.key, Number(event.target.value))} /><small>{item.label}</small></label>)}</div></section><footer><button className="primary" disabled={!analysis.torusReplayReady} onClick={next}>{analysis.torusReplayReady ? "Open provisional replay →" : "Replay withheld until gates pass"}</button></footer></section>;
}

function ReplayStep({ dataset, mapping, analysis, replay, cursor, setCursor, point, explanation, playing, setPlaying, assumptions }: { dataset: EmpiricalDataset | null; mapping: EmpiricalColumnMapping; analysis: EmpiricalStudyAnalysis | null; replay: EmpiricalReplay | null | undefined; cursor: number; setCursor: (value: number) => void; point?: EmpiricalReplayPoint; explanation: ReturnType<typeof empiricalCursorExplanation> | null; playing: boolean; setPlaying: (value: boolean) => void; assumptions: EmpiricalModelAssumptions }) {
  if (!dataset || !analysis || !replay) return <EmptyEmpiricalState title="Replay is not available" copy="Complete the study, data, and mapping steps before evaluating observed drivers." />;
  if (!analysis.torusReplayReady) return <section className="empirical-step"><header><div><span>Valid negative result</span><h2>Torus replay withheld</h2></div><p>The radial equation can be evaluated, but the full two-phase replay is not shown because one or more evidence gates failed.</p></header><GateRail analysis={analysis} expanded /><section className="empirical-withheld"><strong>Do not force the geometry</strong><p>{analysis.gates.find((gate) => !gate.passed)?.detail} Use the validation receipt to improve measurement or choose a simpler state-space model.</p></section></section>;
  return <div className="empirical-replay-stage"><div className="empirical-replay-grid"><section className="empirical-mapping-compact"><header><strong>Variable mapping to theory</strong><span>{dataset.name}</span></header><MappingTable dataset={dataset} mapping={mapping} compact /></section><div className="empirical-replay-main"><GateRail analysis={analysis} /><div className="empirical-chart-pair"><ReplayChart replay={replay} cursor={cursor} rhoCrit={assumptions.rhoCrit} /><PhaseCoverageChart replay={replay} cursor={cursor} /></div></div></div>{point && explanation && <ObservedRunExplanation point={point} explanation={explanation} replay={replay} />}{point && <section className="empirical-timeline"><header><div><strong>Observed replay timeline</strong><span>Observed ρ</span><span>One-step prediction</span><span>Calibration-residual interval</span></div><b>{point.statusLabel}</b></header><ReplayChart replay={replay} cursor={cursor} rhoCrit={assumptions.rhoCrit} compact /><div className="empirical-playback"><button onClick={() => setCursor(0)} aria-label="First observation">|‹</button><button onClick={() => setCursor(Math.max(0, cursor - 1))} aria-label="Previous observation">‹</button><button className="primary" onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? "Pause" : "Play"}</button><button onClick={() => setCursor(Math.min(replay.points.length - 1, cursor + 1))} aria-label="Next observation">›</button><button onClick={() => setCursor(replay.points.length - 1)} aria-label="Last observation">›|</button><input aria-label="Observed replay cursor" type="range" min="0" max={replay.points.length - 1} value={cursor} onChange={(event) => { setPlaying(false); setCursor(Number(event.target.value)); }} /></div><footer><span>t={point.time.toFixed(2)}</span><span>row {point.index + 1}/{replay.points.length}</span><span>observed ρ={point.rho.toFixed(3)}</span><span>predicted ρ={point.predictedRho.toFixed(3)}</span><span>residual={signed(point.residual)}</span>{point.intervention && <strong>{point.intervention}</strong>}</footer></section>}</div>;
}

function ExportStep({ dataset, datasetHash, analysis, mapping, exportEvidence, registerEvidence, canRegister }: { dataset: EmpiricalDataset | null; datasetHash: string; analysis: EmpiricalStudyAnalysis | null; mapping: EmpiricalColumnMapping; exportEvidence: () => void; registerEvidence: () => void; canRegister: boolean }) {
  if (!dataset || !analysis) return <EmptyEmpiricalState title="No evidence receipt is available" copy="Complete at least the data-quality gate before exporting a browser-local study receipt." />;
  return <section className="empirical-step"><header><div><span>Reproducible receipt</span><h2>Export evidence without exporting raw observations</h2></div><p>The JSON bundle records the canonical parsed-table fingerprint, mapping, declared assumptions, gates, holdout metrics when available, model version, and limitations. Failed gates remain exportable negative evidence. Keep the original CSV separately.</p></header><div className="empirical-export-grid"><section><h3>Canonical table fingerprint</h3><code>{datasetHash || "Computing SHA-256…"}</code><dl><div><dt>Rows</dt><dd>{dataset.rows.length}</dd></div><div><dt>Columns</dt><dd>{dataset.headers.length}</dd></div><div><dt>Raw data included</dt><dd>No</dd></div><div><dt>Browser-local</dt><dd>Yes</dd></div></dl></section><section><h3>Evidence classification</h3><dl><div><dt>Evidence level</dt><dd>Observed descriptive</dd></div><div><dt>Model support</dt><dd>{analysis.modelSupport}</dd></div><div><dt>Torus replay</dt><dd>{analysis.torusReplayReady ? "Provisional" : "Withheld"}</dd></div><div><dt>Required mappings</dt><dd>{mappingUnitsDocumented(mapping) ? "Documented" : "Incomplete"}</dd></div></dl></section>{analysis.replay && <section><h3>Holdout receipt</h3><dl><div><dt>Calibration rows</dt><dd>{analysis.replay.calibrationRows}</dd></div><div><dt>Holdout rows</dt><dd>{analysis.replay.holdoutRows}</dd></div><div><dt>Holdout RMSE</dt><dd>{analysis.replay.holdoutRmse.toFixed(4)}</dd></div><div><dt>Interval coverage</dt><dd>{(analysis.replay.holdoutIntervalCoverage * 100).toFixed(1)}%</dd></div></dl></section>}</div><section className="empirical-export-boundary"><strong>What this receipt does not claim</strong><p>No parameter fit, domain calibration, causal effect, universal threshold, or empirical validation of the foundational theory is asserted.</p></section><footer><button disabled={!datasetHash || !canRegister} onClick={registerEvidence}>Add to Evidence Registry</button><button className="primary" disabled={!datasetHash} onClick={exportEvidence}>Export evidence bundle</button></footer></section>;
}

function MappingTable({ dataset, mapping, setMappingEntry, compact = false }: { dataset: EmpiricalDataset; mapping: EmpiricalColumnMapping; setMappingEntry?: (role: EmpiricalRole, patch: Partial<EmpiricalColumnMapping[EmpiricalRole]>) => void; compact?: boolean }) {
  const definitions = compact ? empiricalRoleDefinitions.filter((item) => item.required) : empiricalRoleDefinitions;
  return <div className={`empirical-mapping-table table-wrap ${compact ? "compact" : ""}`}><table><thead><tr><th>Symbol</th><th>Observed field</th>{!compact && <th>Equation role</th>}<th>Units / declared scale</th><th>Evidence</th></tr></thead><tbody>{definitions.map((definition) => { const entry = mapping[definition.role]; return <tr key={definition.role}><td><strong>{definition.symbol}</strong><small>{definition.label}</small></td><td>{setMappingEntry ? <select aria-label={`${definition.label} source column`} value={entry.column} onChange={(event) => setMappingEntry(definition.role, { column: event.target.value })}><option value="">{definition.required ? "Select required column" : "Not mapped (optional)"}</option>{dataset.headers.map((header) => <option key={header}>{header}</option>)}</select> : <span>{entry.column || "Not mapped"}</span>}</td>{!compact && <td>{definition.modelRole}</td>}<td>{setMappingEntry ? <input aria-label={`${definition.label} units`} value={entry.unit} onChange={(event) => setMappingEntry(definition.role, { unit: event.target.value })} /> : entry.unit}</td><td><span className={entry.column ? "mapping-pass" : definition.required ? "mapping-fail" : "mapping-optional"}>{entry.column ? "Mapped" : definition.required ? "Required" : "Optional"}</span></td></tr>; })}</tbody></table></div>;
}

function GateRail({ analysis, expanded = false }: { analysis: EmpiricalStudyAnalysis; expanded?: boolean }) {
  return <section className={`empirical-gate-rail ${expanded ? "expanded" : ""}`} aria-label="Empirical validation gates">{analysis.gates.map((gate) => <article key={gate.id} className={`gate-${gate.state}`}><span>{gate.passed ? "✓" : gate.state === "blocked" ? "·" : "!"}</span><div><small>{gate.label}</small><strong>{gate.state === "pass" ? "PASS" : gate.state === "ready" ? "READY" : gate.state === "blocked" ? "BLOCKED" : "FAIL"}</strong>{expanded && <p>{gate.detail}</p>}</div></article>)}</section>;
}

function ReplayChart({ replay, cursor, rhoCrit, compact = false }: { replay: EmpiricalReplay; cursor: number; rhoCrit: number; compact?: boolean }) {
  const width = 960;
  const height = compact ? 190 : 270;
  const pad = compact ? 24 : 34;
  const all = replay.points.flatMap((point) => [point.rho, point.predictedRho, point.lowerRho, point.upperRho, rhoCrit]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(max - min, 1e-9);
  const firstTime = replay.points[0].time;
  const lastTime = replay.points.at(-1)!.time;
  const timeSpan = Math.max(lastTime - firstTime, 1e-9);
  const x = (point: EmpiricalReplayPoint) => pad + (point.time - firstTime) / timeSpan * (width - pad * 2);
  const y = (value: number) => height - pad - (value - min) / span * (height - pad * 2);
  const line = (value: (point: EmpiricalReplayPoint) => number) => replay.points.map((point, index) => `${index ? "L" : "M"}${x(point).toFixed(2)},${y(value(point)).toFixed(2)}`).join(" ");
  const band = `${replay.points.map((point, index) => `${index ? "L" : "M"}${x(point).toFixed(2)},${y(point.upperRho).toFixed(2)}`).join(" ")} ${[...replay.points].reverse().map((point) => `L${x(point).toFixed(2)},${y(point.lowerRho).toFixed(2)}`).join(" ")} Z`;
  const cursorPoint = replay.points[cursor];
  return <section className={`empirical-chart ${compact ? "compact" : ""}`}><header><strong>Observed versus paper-aligned replay</strong><div><span className="observed">Observed ρ</span><span className="predicted">One-step prediction</span><span className="interval">Residual interval</span></div></header><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Observed versus one-step predicted radial excursion. Cursor time ${cursorPoint.time.toFixed(2)}, observed ${cursorPoint.rho.toFixed(3)}, predicted ${cursorPoint.predictedRho.toFixed(3)}.`}><g className="chart-grid-lines">{Array.from({ length: 5 }, (_, index) => <path key={index} d={`M${pad} ${pad + index * (height - pad * 2) / 4}H${width - pad}`} />)}</g><path className="empirical-band" d={band} /><path className="empirical-boundary" d={`M${pad},${y(rhoCrit)}H${width - pad}`} /><path className="empirical-predicted" d={line((point) => point.predictedRho)} /><path className="empirical-observed" d={line((point) => point.rho)} /><path className="empirical-cursor" d={`M${x(cursorPoint)},${pad}V${height - pad}`} /><circle className="empirical-observed-point" cx={x(cursorPoint)} cy={y(cursorPoint.rho)} r="5" /></svg><footer><span>t {firstTime.toFixed(2)}</span><span>ρcrit {rhoCrit.toFixed(3)}</span><span>t {lastTime.toFixed(2)}</span></footer></section>;
}

function PhaseCoverageChart({ replay, cursor }: { replay: EmpiricalReplay; cursor: number }) {
  const size = 270;
  const pad = 28;
  const points = replay.points.filter((point) => point.thetaPhase !== undefined && point.phiPhase !== undefined);
  const x = (value: number) => pad + value / (Math.PI * 2) * (size - pad * 2);
  const y = (value: number) => size - pad - value / (Math.PI * 2) * (size - pad * 2);
  const current = replay.points[cursor];
  return <section className="empirical-chart phase-coverage"><header><strong>Estimated joint phase coverage</strong><span>Descriptive gate, not topology proof</span></header><svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Estimated theta phi phase occupancy with ${points.length} plotted observations.`}><g className="phase-grid">{Array.from({ length: 7 }, (_, index) => <g key={index}><path d={`M${pad + index * (size - pad * 2) / 6},${pad}V${size - pad}`} /><path d={`M${pad},${pad + index * (size - pad * 2) / 6}H${size - pad}`} /></g>)}</g>{points.filter((_, index) => index % Math.max(1, Math.floor(points.length / 180)) === 0).map((point) => <circle key={point.index} cx={x(point.thetaPhase!)} cy={y(point.phiPhase!)} r="2.2" />)}{current.thetaPhase !== undefined && current.phiPhase !== undefined && <circle className="phase-current" cx={x(current.thetaPhase)} cy={y(current.phiPhase)} r="6" />}<text x={size / 2} y={size - 7}>θ̂</text><text x="7" y={size / 2}>φ̂</text></svg></section>;
}

function ObservedRunExplanation({ point, explanation, replay }: { point: EmpiricalReplayPoint; explanation: ReturnType<typeof empiricalCursorExplanation>; replay: EmpiricalReplay }) {
  const max = Math.max(...explanation.contributions.map((item) => Math.abs(item.value)), Math.abs(explanation.residualRate), 0.001);
  return <section className="empirical-explanation"><header><div><span>Paper-equation contribution trace · cursor t={point.time.toFixed(2)}</span><h2>Why this observed run looks this way</h2><p>{explanation.statement}</p></div><strong>{point.statusLabel}</strong></header><div className="empirical-contribution-grid">{explanation.contributions.map((item) => <article key={item.symbol}><span>{item.symbol}</span><b>{signed(item.value)}</b><i><em className={item.value >= 0 ? "positive" : "negative"} style={{ width: `${Math.abs(item.value) / max * 100}%` }} /></i><small>{item.label}</small></article>)}<article><span>residual</span><b>{signed(explanation.residualRate)}</b><i><em className="residual" style={{ width: `${Math.abs(explanation.residualRate) / max * 100}%` }} /></i><small>observed minus model rate</small></article></div><footer><p><strong>Interpretation boundary</strong>{explanation.boundary}</p><dl><div><dt>Holdout RMSE</dt><dd>{replay.holdoutRmse.toFixed(4)}</dd></div><div><dt>90% residual interval coverage</dt><dd>{(replay.holdoutIntervalCoverage * 100).toFixed(1)}%</dd></div></dl></footer></section>;
}

function EmptyEmpiricalState({ title, copy }: { title: string; copy: string }) {
  return <section className="empirical-step empirical-empty"><span>○</span><h2>{title}</h2><p>{copy}</p></section>;
}

function mappingUnitsDocumented(mapping: EmpiricalColumnMapping) {
  return empiricalRoleDefinitions.filter((item) => item.required).every((item) => mapping[item.role].column && mapping[item.role].unit.trim());
}

function phaseReceipt(phase: EmpiricalStudyAnalysis["internalPhase"]) {
  return {
    identifiable: phase.identifiable,
    reason: phase.reason,
    spectralConcentration: phase.spectralConcentration,
    estimatedCycles: phase.estimatedMajorCycles,
  };
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "empirical-study";
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function sha256Hex(value: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
