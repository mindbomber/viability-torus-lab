"use client";

/* eslint-disable @next/next/no-img-element -- Archived research images are served as exact, unmodified evidence assets. */

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  PAPER_LEGACY_EXPECTED_DIGESTS,
  analyzeExternalTelemetry,
  paperLegacyCases,
  simulateLegacyPaperCase,
  type ExternalTelemetryAnalysis,
  type PaperLegacyCaseId,
  type PaperLegacyResult,
  type SimulationFrame,
  type SimulationParameters,
  type SimulationSummary,
} from "@/engine/simulator";
import type { ScenarioDefinition } from "@/scenarios/catalog";
import {
  archivedResearchFindings,
  researchModules,
  runCoupledToriSweep,
  runHysteresisStudy,
  runNavigationStudy,
  topologyForCurrentRun,
  type HysteresisStudyResult,
  type NavigationStudyResult,
  type ResearchModuleId,
} from "@/research/studies";
import type { CoupledToriResult } from "@/engine/simulator";
import { AixPanel } from "./AixPanel";

type Props = {
  scenario: ScenarioDefinition;
  parameters: SimulationParameters;
  frames: SimulationFrame[];
  summary: SimulationSummary;
  announce: (message: string) => void;
};

const metricLabels: Record<keyof PaperLegacyResult["metrics"], string> = {
  meanRhoLast: "Mean radial excursion after burn-in",
  maxRho: "Maximum radial excursion",
  outsideFraction: "Fraction outside viable tube",
  finalDebt: "Final alignment debt",
  meanAlignmentLast: "Mean toy proxy A=e⁻ρ after burn-in",
  windingTheta: "Minor winding rate",
  windingPhi: "Major winding rate",
  windingRatio: "Winding ratio θ/φ",
  correctionMargin: "Correction margin C−D",
};

export function ExperimentsWorkspace({ scenario, parameters, frames, summary, announce }: Props) {
  const [moduleId, setModuleId] = useState<ResearchModuleId>("paper");
  const [paperCase, setPaperCase] = useState<PaperLegacyCaseId>("stable-quasiperiodic");
  const [paperResult, setPaperResult] = useState(() => simulateLegacyPaperCase("stable-quasiperiodic"));
  const [paperDigest, setPaperDigest] = useState("");
  const [hysteresis, setHysteresis] = useState<HysteresisStudyResult | null>(null);
  const [coupled, setCoupled] = useState<CoupledToriResult[] | null>(null);
  const [navigation, setNavigation] = useState<NavigationStudyResult | null>(null);
  const [telemetry, setTelemetry] = useState<ExternalTelemetryAnalysis>(() => analyzeExternalTelemetry(exampleTelemetry()));
  const [telemetrySource, setTelemetrySource] = useState("Bundled recurrent example");
  const [isPending, startTransition] = useTransition();
  const topology = useMemo(() => topologyForCurrentRun(frames), [frames]);
  const activeModule = researchModules.find((item) => item.id === moduleId)!;
  const digestMatches = paperDigest === PAPER_LEGACY_EXPECTED_DIGESTS[paperResult.caseId] && paperResult.matchesArchive;

  useEffect(() => {
    let active = true;
    void sha256Hex(paperResult.verificationPayload).then((digest) => {
      if (active) setPaperDigest(digest);
    });
    return () => { active = false; };
  }, [paperResult]);

  const runPaper = () => startTransition(() => {
    const result = simulateLegacyPaperCase(paperCase);
    setPaperResult(result);
    announce(`${result.title} reproduced against the archived reference run`);
  });

  const runActiveModule = () => {
    if (moduleId === "paper") return runPaper();
    startTransition(() => {
      if (moduleId === "hysteresis") setHysteresis(runHysteresisStudy(parameters.seed));
      if (moduleId === "coupled") setCoupled(runCoupledToriSweep(parameters.seed));
      if (moduleId === "navigation") setNavigation(runNavigationStudy(parameters.seed));
      announce(`${activeModule.title} live synthetic study complete`);
    });
  };

  const importTelemetry = async (file: File) => {
    try {
      if (file.size > 1_000_000) throw new Error("Telemetry CSV must be smaller than 1 MB");
      const samples = parseTelemetryCsv(await file.text());
      const analysis = analyzeExternalTelemetry(samples);
      setTelemetry(analysis);
      setTelemetrySource(file.name);
      announce(`${samples.length} telemetry samples analyzed`);
    } catch (error) {
      announce(error instanceof Error ? error.message : "Telemetry could not be analyzed");
    }
  };

  return (
    <div className="experiments-workspace">
      <header className="experiments-heading">
        <div><span>Reproducible synthetic studies</span><h1>Experiments</h1><p>Reproduce archived results, run live diagnostics, and keep each result&apos;s source visible at every step.</p></div>
        <div className="experiment-actions"><button className="primary" disabled={isPending || moduleId === "topology" || moduleId === "telemetry"} onClick={runActiveModule}>▶ {isPending ? "Running…" : "Run experiment"}</button><a className="button" href="/research/core/TOROIDAL_LAB_REPORT.md">Core report</a><a className="button" href="/research/navigation/TOROIDAL_NAVIGATION_LAB_REPORT.md">Navigation report</a></div>
      </header>

      <div className="experiments-grid">
        <aside className="module-rail" aria-label="Research studies">
          <header><strong>Available studies</strong><small>All results are synthetic</small></header>
          {researchModules.map((item) => <button key={item.id} className={moduleId === item.id ? "active" : ""} onClick={() => setModuleId(item.id)}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div></button>)}
          <div className="module-version"><span>Current engine</span><strong>torus-1.2.0</strong><span>Legacy engine</span><strong>paper-2026-legacy</strong></div>
        </aside>

        <section className="experiment-stage">
          {moduleId === "paper" && <PaperStudy caseId={paperCase} setCaseId={setPaperCase} result={paperResult} digest={paperDigest} verified={digestMatches} run={runPaper} pending={isPending} />}
          {moduleId === "topology" && <TopologyStudy topology={topology} phase={summary.phase} />}
          {moduleId === "hysteresis" && <HysteresisStudy result={hysteresis} />}
          {moduleId === "coupled" && <CoupledStudy result={coupled} />}
          {moduleId === "navigation" && <NavigationStudy result={navigation} />}
          {moduleId === "telemetry" && <TelemetryStudy analysis={telemetry} source={telemetrySource} importFile={importTelemetry} />}
        </section>

        <aside className="evidence-rail">
          <section><header><strong>Evidence</strong><span>{moduleId === "paper" && digestMatches ? "Verified match" : "Synthetic"}</span></header><img src={activeModule.asset} width="600" height="400" alt={`${activeModule.title} archived experiment evidence`} /><dl><div><dt>Selected study</dt><dd>{activeModule.title}</dd></div><div><dt>Live source</dt><dd>Current simulator</dd></div><div><dt>Archived source</dt><dd>Archived reference runs</dd></div><div><dt>Domain calibration</dt><dd>None</dd></div></dl><p>Archived figures are displayed as historical synthetic evidence. Live reruns and imported observations are labeled separately.</p></section>
          <div className="experiment-context-aix"><header><strong>Selected system context</strong><span>Separate from this study</span></header><p>This full-run synthetic AIx belongs to {scenario.system.shortTitle}. It is not an output of the selected {activeModule.title} study.</p><AixPanel assessment={summary.aix} scenario={scenario} /></div>
        </aside>
      </div>
    </div>
  );
}

function PaperStudy({ caseId, setCaseId, result, digest, verified, run, pending }: { caseId: PaperLegacyCaseId; setCaseId: (value: PaperLegacyCaseId) => void; result: PaperLegacyResult; digest: string; verified: boolean; run: () => void; pending: boolean }) {
  return <>
    <section className="protocol-row">
      <div><span>Study setup</span><strong>Archived companion-model regime suite</strong><p>{result.protocol}</p></div>
      <label><span>Reference case</span><select value={caseId} onChange={(event) => setCaseId(event.target.value as PaperLegacyCaseId)}>{paperLegacyCases.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
      <div className="engine-lock"><span>Engine</span><strong>Paper 2026 legacy</strong><small>Unit-step · zero noise · archived initial phase</small><button className="primary" disabled={pending} onClick={run}>Run selected case</button></div>
    </section>
    <section className={`verification-strip ${verified ? "verified" : ""}`}><span>{verified ? "✓" : "…"}</span><div><strong>{verified ? "Archived result reproduced" : "Computing verification"}</strong><small>maximum absolute metric error {result.maximumAbsoluteError.toExponential(2)}</small></div><code title={digest}>{digest || "SHA-256 pending"}</code></section>
    <section className="research-table-panel"><header><strong>Primary results</strong><span>Archived expected vs live legacy rerun</span></header><div className="table-wrap"><table><thead><tr><th>Metric</th><th>Archived</th><th>Live rerun</th><th>|Δ|</th><th>Status</th></tr></thead><tbody>{(Object.keys(result.metrics) as (keyof typeof result.metrics)[]).map((key) => { const delta = Math.abs(result.metrics[key] - result.expected[key]); return <tr key={key}><td>{metricLabels[key]}</td><td>{formatMetric(result.expected[key])}</td><td>{formatMetric(result.metrics[key])}</td><td>{delta.toExponential(2)}</td><td className={delta <= 1e-9 ? "match" : "mismatch"}>{delta <= 1e-9 ? "Match" : "Mismatch"}</td></tr>; })}</tbody></table></div></section>
    <div className="research-chart-grid"><ResearchLineChart title="Legacy radial excursion and debt" series={[{ label: "ρ", color: "#49bfff", values: result.frames.map((frame) => frame.rho) }, { label: "Δ", color: "#ff6a63", values: result.frames.map((frame) => frame.debt) }]} /><ResearchLineChart title="Legacy unwrapped phase travel" series={[{ label: "θ", color: "#8c76ff", values: result.frames.map((frame) => frame.thetaUnwrapped) }, { label: "φ", color: "#ff9a4a", values: result.frames.map((frame) => frame.phiUnwrapped) }]} /></div>
  </>;
}

function TopologyStudy({ topology, phase }: { topology: ReturnType<typeof topologyForCurrentRun>; phase: SimulationSummary["phase"] }) {
  return <><section className="study-intro"><div><span>Latent synthetic topology diagnostic</span><h2>Topology & phase</h2><p>Phase occupancy uses the simulator’s latent synthetic θ and φ. It is not an empirically recovered manifold; archived Betti tests remain the stronger topology evidence.</p></div><div className="study-stats"><Stat label="Grid coverage" value={`${(topology.coverage * 100).toFixed(1)}%`} /><Stat label="Components" value={String(topology.connectedComponents)} /><Stat label="Heuristic Betti tuple" value={`(${topology.heuristicBetti.join(", ")})`} /><Stat label="Winding" value={phase.regime} /></div></section><section className="archive-compare"><div><strong>Archived quasiperiodic torus</strong><span>Betti ({archivedResearchFindings.topology.quasiperiodicBetti.join(", ")})</span><small>{archivedResearchFindings.topology.provenance}</small></div><div><strong>Archived periodic loop</strong><span>Betti ({archivedResearchFindings.topology.periodicBetti.join(", ")})</span><small>One recurrent loop does not establish T² occupancy.</small></div></section><section className="research-note"><strong>Interpretation boundary</strong><p>{topology.limitation} A toroidal claim still requires two identifiable recurrent phases, not merely a torus-shaped rendering.</p></section></>;
}

function HysteresisStudy({ result }: { result: HysteresisStudyResult | null }) {
  if (!result) return <EmptyStudy title="Hysteresis" copy="Run the live grid to estimate how recovery correction changes with stress duration and accumulated debt." asset="/research/core/fig_13_hysteresis_recovery_heatmap.png" />;
  const max = Math.max(...result.rows.map((row) => row.minimumRecoveryCorrection ?? result.preventionCorrection));
  return <><section className="study-intro"><div><span>Live current-engine rerun</span><h2>Debt-dependent recovery</h2><p>Prevention and recovery are compared under the same synthetic divergence pressure.</p></div><div className="study-stats"><Stat label="Divergence D" value={result.divergence.toFixed(3)} /><Stat label="Prevention C" value={result.preventionCorrection.toFixed(3)} /><Stat label="Durations" value={String(result.rows.length)} /></div></section><section className="bar-study">{result.rows.map((row) => <div key={row.duration}><span>{row.duration} steps</span><i><em style={{ width: `${((row.minimumRecoveryCorrection ?? max) / max) * 100}%` }} /></i><strong>{row.minimumRecoveryCorrection?.toFixed(3) ?? "no recovery"}</strong></div>)}</section><section className="research-note"><strong>Hysteresis result</strong><p>Longer stress tends to require more recovery correction than the prevention threshold. This live grid is model-behavior evidence, not a domain recovery prescription.</p></section></>;
}

function CoupledStudy({ result }: { result: CoupledToriResult[] | null }) {
  if (!result) return <EmptyStudy title="Coupled tori" copy="Run the ring-network experiment to test whether phase synchronization improves—or merely coordinates—collective alignment." asset="/research/core/fig_26_coupled_network_order_vs_risk.png" />;
  return <><section className="study-intro"><div><span>Live coupled-agent model</span><h2>Coordination is not alignment</h2><p>Coupling can increase phase order while propagated misclassification expands collective risk.</p></div><div className="study-stats"><Stat label="Coupling values" value={String(result.length)} /><Stat label="Agents" value={String(result[0].agents)} /><Stat label="Steps" value={String(result[0].steps)} /></div></section><div className="research-chart-grid"><ResearchLineChart title="Phase order vs coupling" xValues={result.map((item) => item.coupling)} xLabel="coupling" series={[{ label: "order", color: "#8c76ff", values: result.map((item) => item.meanOrderLast) }]} /><ResearchLineChart title="Mean radial risk vs coupling" xValues={result.map((item) => item.coupling)} xLabel="coupling" series={[{ label: "ρ", color: "#ff6a63", values: result.map((item) => item.meanRhoLast) }]} /></div><section className="research-table-panel"><div className="table-wrap"><table><thead><tr><th>Coupling</th><th>Phase order</th><th>Mean ρ</th><th>Mean debt</th><th>Interpretation</th></tr></thead><tbody>{result.map((item) => <tr key={item.coupling}><td>{item.coupling.toFixed(3)}</td><td>{item.meanOrderLast.toFixed(3)}</td><td>{item.meanRhoLast.toFixed(3)}</td><td>{item.finalDebtMean.toFixed(3)}</td><td>{item.coordinationWithoutAlignment ? "Coordinated risk" : "No joint-risk flag"}</td></tr>)}</tbody></table></div></section></>;
}

function NavigationStudy({ result }: { result: NavigationStudyResult | null }) {
  return <><section className="study-intro"><div><span>Archived benchmark + compact live rerun</span><h2>Navigation & early warning</h2><p>Dynamic toroidal telemetry is compared with scalar alignment warnings before boundary crossing.</p></div><div className="study-stats"><Stat label="Archived full AUC" value={archivedResearchFindings.navigation.fullTelemetryRocAuc.toFixed(3)} /><Stat label="Archived dynamic AUC" value={archivedResearchFindings.navigation.dynamicRocAuc.toFixed(3)} /><Stat label="Archived scalar AUC" value={archivedResearchFindings.navigation.scalarRocAuc.toFixed(3)} /><Stat label="Archived Brier" value={archivedResearchFindings.navigation.fullTelemetryBrier.toFixed(3)} /></div></section>{result ? <section className="archive-compare"><div><strong>Live radial warning lead</strong><span>{result.radialWarningMeanLead.toFixed(1)} steps</span><small>{result.detectedBoundaryCrossings} boundary-crossing episodes detected</small></div><div><strong>Live alignment-only lead</strong><span>{result.alignmentWarningMeanLead.toFixed(1)} steps</span><small>Radial advantage {result.radialWarningAdvantage.toFixed(1)} steps</small></div></section> : <section className="research-note"><strong>Ready to run</strong><p>Run the study to generate a compact seeded early-warning ensemble. The archived 260-episode benchmark remains available in the evidence image and report.</p></section>}<section className="research-note"><strong>Archive coverage</strong><p>Forecast calibration, matched-score divergent futures, observer mismatch, sensor ablation, OOD families, missing telemetry, intervention timing, policy utility, hidden regimes, change points, and recurrence restructuring are documented in the navigation report.</p></section></>;
}

function TelemetryStudy({ analysis, source, importFile }: { analysis: ExternalTelemetryAnalysis; source: string; importFile: (file: File) => Promise<void> }) {
  const phaseValues = analysis.samples.map((sample) => sample.estimatedPhase === undefined ? undefined : sample.estimatedPhase / (Math.PI * 2));
  const phaseAvailable = analysis.diagnostics.identifiable && phaseValues.some((value) => value !== undefined);
  return <><section className="study-intro"><div><span>Imported observation path</span><h2>External mismatch telemetry</h2><p>Upload CSV with <code>time,mismatch</code>. The revised signed temporal estimator runs only after the identifiability gates pass.</p></div><label className="telemetry-upload">Import CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; }} /></label></section><section className="study-stats wide"><Stat label="Source" value={source} /><Stat label="Samples" value={String(analysis.samples.length)} /><Stat label="Identifiable" value={analysis.diagnostics.identifiable ? "Yes" : "No"} /><Stat label="Gate reason" value={analysis.diagnostics.reason} /><Stat label="Spectral concentration" value={analysis.diagnostics.spectralConcentration.toFixed(3)} /><Stat label="Estimated cycles" value={analysis.diagnostics.estimatedMajorCycles.toFixed(1)} /></section><ResearchLineChart title={phaseAvailable ? "Imported mismatch and normalized phase estimate" : "Imported mismatch · phase estimate withheld"} xValues={analysis.samples.map((sample) => sample.time)} xLabel="time" series={[{ label: "mismatch", color: "#49bfff", values: analysis.samples.map((sample) => sample.mismatch) }, ...(phaseAvailable ? [{ label: "φ / 2π", color: "#ff9a4a", values: phaseValues }] : [])]} />{!phaseAvailable && <section className="research-note phase-withheld"><strong>Phase not plotted</strong><p>The identifiability gate failed ({analysis.diagnostics.reason}), so φ̂ remains undefined. The chart does not replace missing phase with an arbitrary zero angle.</p></section>}<section className="research-note"><strong>What this establishes</strong><p>{analysis.warnings.join(" ")}</p></section></>;
}

function EmptyStudy({ title, copy, asset }: { title: string; copy: string; asset: string }) {
  return <section className="empty-study"><img src={asset} width="900" height="620" alt={`${title} archived experiment`} /><div><span>Versioned research study</span><h2>{title}</h2><p>{copy}</p><small>Use “Run experiment” above to execute the live synthetic study.</small></div></section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <span><small>{label}</small><strong>{value}</strong></span>;
}

function ResearchLineChart({ title, series, xValues, xLabel = "sample" }: { title: string; xValues?: number[]; xLabel?: string; series: { label: string; color: string; values: (number | undefined)[] }[] }) {
  const width = 760;
  const height = 250;
  const pad = 26;
  const all = series.flatMap((item) => item.values).filter((value): value is number => value !== undefined && Number.isFinite(value));
  const min = Math.min(0, ...all);
  const max = Math.max(1e-9, ...all);
  const span = Math.max(max - min, 1e-9);
  const xMin = xValues?.length ? Math.min(...xValues) : 0;
  const xMax = xValues?.length ? Math.max(...xValues) : Math.max(0, ...series.map((item) => item.values.length - 1));
  const xSpan = Math.max(xMax - xMin, 1e-9);
  const path = (values: (number | undefined)[]) => {
    let drawing = false;
    return values.map((value, index) => {
      if (value === undefined || !Number.isFinite(value)) { drawing = false; return ""; }
      const rawX = xValues?.[index] ?? index;
      const x = pad + (rawX - xMin) / xSpan * (width - pad * 2);
      const y = height - pad - (value - min) / span * (height - pad * 2);
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  };
  return <section className="research-chart"><header><strong>{title}</strong><div>{series.map((item) => <span key={item.label} style={{ color: item.color }}>{item.label}</span>)}</div></header><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. ${xLabel} range ${xMin.toFixed(3)} to ${xMax.toFixed(3)}; y range ${min.toFixed(3)} to ${max.toFixed(3)}.`}><g className="chart-grid-lines">{Array.from({ length: 6 }, (_, index) => <path key={index} d={`M${pad} ${pad + index * (height - pad * 2) / 5}H${width - pad}`} />)}</g>{series.map((item) => <path key={item.label} d={path(item.values)} fill="none" stroke={item.color} strokeWidth="2.4" />)}</svg><footer><span>{xLabel} {xMin.toFixed(3)}</span><span>y {min.toFixed(2)}…{max.toFixed(2)}</span><span>{xLabel} {xMax.toFixed(3)}</span></footer></section>;
}

function exampleTelemetry() {
  return Array.from({ length: 320 }, (_, index) => {
    const phase = index / 320 * Math.PI * 10;
    return { time: index * 0.25, mismatch: 0.5 + 0.28 * Math.cos(phase) + 0.04 * Math.cos(phase * 2) };
  });
}

function parseTelemetryCsv(text: string) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length < 9) throw new Error("Telemetry CSV needs a header and at least eight samples");
  const headers = rows[0].split(",").map((value) => value.trim().toLowerCase());
  const timeIndex = headers.findIndex((value) => ["time", "t", "timestamp"].includes(value));
  const mismatchIndex = headers.findIndex((value) => ["mismatch", "externalmismatch", "external_mismatch", "value"].includes(value));
  if (timeIndex < 0 || mismatchIndex < 0) throw new Error("CSV header must include time and mismatch columns");
  return rows.slice(1).map((row, index) => {
    const cells = row.split(",");
    const time = Number(cells[timeIndex]);
    const mismatch = Number(cells[mismatchIndex]);
    if (!Number.isFinite(time) || !Number.isFinite(mismatch)) throw new Error(`Invalid numeric value on CSV row ${index + 2}`);
    return { time, mismatch };
  });
}

async function sha256Hex(value: string) {
  if (!globalThis.crypto?.subtle) return "Web Crypto unavailable";
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatMetric(value: number) {
  if (Math.abs(value) >= 100 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) return value.toExponential(6);
  return value.toFixed(9);
}
