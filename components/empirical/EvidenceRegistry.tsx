"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  empiricalEvidenceRegistryBundleSchema,
  empiricalEvidenceRegistryRequestSchema,
  empiricalReceiptSchema,
  type ParsedEmpiricalReceipt,
} from "@/contracts/schemas";
import {
  aggregateEmpiricalReceipts,
  buildEmpiricalRegistryBundle,
  empiricalReceiptId,
  mergeEmpiricalReceipts,
} from "@/empirical/registry";
import { createSyntheticRegistryDemo } from "@/empirical/registry-demo";
import type { ScenarioDefinition } from "@/scenarios/catalog";

type Props = {
  scenario: ScenarioDefinition;
  receipts: ParsedEmpiricalReceipt[];
  onReceiptsChange: (receipts: ParsedEmpiricalReceipt[]) => void;
  announce: (message: string) => void;
};

type RegistryFilter = "all" | "compatible" | "partial" | "non-comparable" | "negative" | "synthetic";
const registryStorageKey = "vtl:evidence-registry:v1";
const registryPersistenceKey = "vtl:evidence-registry:persist:v1";

const filters: { id: RegistryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "compatible", label: "Compatible" },
  { id: "partial", label: "Partial" },
  { id: "non-comparable", label: "Non-comparable" },
  { id: "negative", label: "Negative" },
  { id: "synthetic", label: "Synthetic" },
];

export function EvidenceRegistry({ scenario, receipts, onReceiptsChange, announce }: Props) {
  const [anchorReceiptId, setAnchorReceiptId] = useState<string>();
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>();
  const [filter, setFilter] = useState<RegistryFilter>("all");
  const [search, setSearch] = useState("");
  const [persistOnDevice, setPersistOnDevice] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);

  const validAnchorReceiptId = anchorReceiptId && receipts.some((receipt) => empiricalReceiptId(receipt) === anchorReceiptId)
    ? anchorReceiptId
    : undefined;
  const summary = useMemo(() => receipts.length > 0
    ? aggregateEmpiricalReceipts({ receipts, anchorReceiptId: validAnchorReceiptId })
    : null, [receipts, validAnchorReceiptId]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (window.localStorage.getItem(registryPersistenceKey) !== "true") return;
    const saved = window.localStorage.getItem(registryStorageKey);
    if (!saved) {
      queueMicrotask(() => setPersistOnDevice(true));
      return;
    }
    try {
      const bundle = empiricalEvidenceRegistryBundleSchema.parse(JSON.parse(saved));
      queueMicrotask(() => {
        setPersistOnDevice(true);
        onReceiptsChange(mergeEmpiricalReceipts(receipts, bundle.receipts));
        setAnchorReceiptId(bundle.anchorReceiptId);
        announce(`${bundle.receipts.length} redacted study records restored from this device`);
      });
    } catch {
      window.localStorage.removeItem(registryStorageKey);
      announce("The saved registry was invalid and was not restored");
    }
  }, [announce, onReceiptsChange, receipts]);

  useEffect(() => {
    window.localStorage.setItem(registryPersistenceKey, persistOnDevice ? "true" : "false");
    if (!persistOnDevice) {
      window.localStorage.removeItem(registryStorageKey);
      return;
    }
    if (!summary || receipts.length === 0) return;
    const bundle = buildEmpiricalRegistryBundle(receipts, summary.anchorReceiptId);
    window.localStorage.setItem(registryStorageKey, JSON.stringify(bundle));
  }, [persistOnDevice, receipts, summary]);

  const selected = summary?.receipts.find((receipt) => receipt.id === selectedReceiptId)
    ?? summary?.receipts.find((receipt) => receipt.compatibility === "partially-comparable")
    ?? summary?.receipts.find((receipt) => receipt.compatibility !== "anchor")
    ?? summary?.receipts[0];
  const anchorCandidates = summary?.receipts.filter((receipt) => receipt.evidenceKind === "observed") ?? [];
  const availableAnchors = anchorCandidates.length > 0 ? anchorCandidates : summary?.receipts ?? [];
  const visibleReceipts = (summary?.receipts ?? []).filter((receipt) => {
    const searchMatches = `${receipt.studyName} ${receipt.sourceName} ${receipt.scenarioId}`.toLocaleLowerCase("en-US").includes(search.trim().toLocaleLowerCase("en-US"));
    if (!searchMatches) return false;
    if (filter === "compatible") return receipt.compatibility === "anchor" || receipt.compatibility === "compatible";
    if (filter === "partial") return receipt.compatibility === "partially-comparable";
    if (filter === "non-comparable") return receipt.compatibility === "non-comparable";
    if (filter === "negative") return receipt.negative;
    if (filter === "synthetic") return receipt.evidenceKind === "synthetic";
    return true;
  });

  const importReceipts = async (files: FileList) => {
    try {
      const additions: ParsedEmpiricalReceipt[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 10_000_000) throw new Error(`${file.name} exceeds the 10 MB registry import limit`);
        additions.push(...parseReceiptPayload(JSON.parse(await file.text())));
      }
      const merged = mergeEmpiricalReceipts(receipts, additions);
      onReceiptsChange(merged);
      announce(`${merged.length - receipts.length} new redacted study record${merged.length - receipts.length === 1 ? "" : "s"} added; duplicates were ignored`);
    } catch (error) {
      announce(error instanceof Error ? error.message : "Study records could not be imported");
    }
  };

  const loadDemo = () => {
    const demo = createSyntheticRegistryDemo(scenario);
    onReceiptsChange(demo);
    setAnchorReceiptId(empiricalReceiptId(demo[0]));
    setSelectedReceiptId(empiricalReceiptId(demo[2]));
    setFilter("all");
    announce("Synthetic registry demonstration loaded; none of its rows are empirical evidence");
  };

  const exportRegistry = () => {
    if (!summary) return;
    const bundle = buildEmpiricalRegistryBundle(receipts, summary.anchorReceiptId);
    downloadJson("viability-torus-lab.evidence-registry.json", bundle);
    announce("Redacted evidence registry exported without raw observations");
  };

  const removeSelected = () => {
    if (!selected) return;
    onReceiptsChange(receipts.filter((receipt) => empiricalReceiptId(receipt) !== selected.id));
    announce(`${selected.studyName} removed from the browser-local registry`);
  };

  return <div className="page-view registry-page">
    <section className="registry-heading">
      <div>
        <h1>Evidence Registry</h1>
        <p>Compare redacted study records without pooling incompatible evidence.</p>
        <div className="registry-labels" aria-label="Registry evidence boundaries"><span>Browser-local registry</span><span>Raw observations excluded</span><span>Descriptive aggregation</span></div>
      </div>
      <div className="registry-actions">
        <button className="primary" onClick={() => importRef.current?.click()}>⇧ Import study records</button>
        <button onClick={loadDemo}>◇ Load synthetic demonstration</button>
        <button disabled={!summary} onClick={exportRegistry}>⇩ Export registry</button>
        <input ref={importRef} hidden multiple type="file" accept="application/json,.json" onChange={(event) => { if (event.target.files) void importReceipts(event.target.files); event.target.value = ""; }} />
      </div>
    </section>

    {!summary ? <section className="registry-empty">
      <span aria-hidden="true">⌘</span>
      <h2>Start with a redacted study record</h2>
      <p>Import JSON study records from the Empirical Lab, local MCP, CLI, or opt-in API. The registry stores no raw observations and will not combine studies until their boundaries, variables, and model versions are compatible.</p>
      <div><button className="primary" onClick={() => importRef.current?.click()}>Import study records</button><button onClick={loadDemo}>Explore a synthetic demonstration</button></div>
    </section> : <>
      <section className="registry-summary-strip" aria-label="Evidence registry summary">
        <RegistryStat label="Total records" value={summary.counts.totalReceipts} />
        <RegistryStat label="Observed studies" value={summary.counts.observedStudies} />
        <RegistryStat label="Negative studies" value={summary.counts.negativeStudies} tone="negative" />
        <RegistryStat label="Compatible with anchor" value={summary.counts.compatibleWithAnchor} tone="positive" />
        <label className="registry-persistence"><input type="checkbox" checked={persistOnDevice} onChange={(event) => setPersistOnDevice(event.target.checked)} /><span><strong>{persistOnDevice ? "Saved on this device" : "Session-only registry"}</strong><small>{persistOnDevice ? "Only redacted study records are retained." : "Nothing is retained after this browser session."}</small></span></label>
      </section>

      <section className="registry-workspace">
        <div className="registry-table-panel">
          <header className="registry-controls">
            <label>Anchor study <select aria-label="Anchor study" value={summary.anchorReceiptId} onChange={(event) => { setAnchorReceiptId(event.target.value); setSelectedReceiptId(event.target.value); }}>
              {availableAnchors.map((receipt) => <option key={receipt.id} value={receipt.id}>{receipt.studyName}{receipt.evidenceKind === "synthetic" ? " (synthetic; aggregation disabled)" : ""}</option>)}
            </select></label>
            <label className="registry-search"><span className="sr-only">Search study records</span><input value={search} placeholder="Search study records…" onChange={(event) => setSearch(event.target.value)} /></label>
          </header>
          <nav className="registry-filters" aria-label="Registry filters">{filters.map((item) => <button key={item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</nav>
          <div className="registry-table-wrap"><table>
            <thead><tr><th>Study</th><th>Source</th><th>Scenario / version</th><th>Evidence</th><th>Phase result</th><th>Compatibility</th><th>Rows</th><th>Holdout RMSE</th></tr></thead>
            <tbody>{visibleReceipts.map((receipt) => <tr key={receipt.id} className={selected?.id === receipt.id ? "selected" : ""} onClick={() => setSelectedReceiptId(receipt.id)}>
              <td><button className="registry-study-link" onClick={() => setSelectedReceiptId(receipt.id)}>{receipt.studyName}</button></td>
              <td>{receipt.receiptKind === "browser-local-empirical-study" ? "Browser study" : "API or MCP study"}</td>
              <td>{receipt.scenarioId} / {receipt.scenarioVersion}</td>
              <td><span className={`registry-pill ${receipt.evidenceKind}`}>{receipt.evidenceKind === "observed" ? "Observed" : "Synthetic"}</span></td>
              <td><span className={`registry-pill phase-${receipt.phaseResult}`}>{receipt.phaseResult[0].toUpperCase() + receipt.phaseResult.slice(1)}</span></td>
              <td><span className={`registry-pill compatibility-${receipt.compatibility}`}>{compatibilityLabel(receipt.compatibility)}</span></td>
              <td>{receipt.rows}</td><td>{receipt.replay ? receipt.replay.holdoutRmse.toFixed(3) : "—"}</td>
            </tr>)}</tbody>
          </table>{visibleReceipts.length === 0 && <p className="registry-no-results">No study records match this filter.</p>}</div>
          <footer>Showing {visibleReceipts.length} of {summary.counts.totalReceipts} study records <span>Duplicates removed: {summary.counts.deduplicatedReceipts}</span></footer>
        </div>

        {selected && <aside className="registry-inspector">
          <header><h2>Compatibility with anchor</h2><span>Anchor: {summary.receipts.find((receipt) => receipt.id === summary.anchorReceiptId)?.studyName}</span><strong>Selected: {selected.studyName}</strong></header>
          <div className="registry-dimensions">{selected.dimensions.map((entry) => <article key={entry.id} className={`dimension-${entry.status}`}><div><span>{entry.label}</span><b>{dimensionLabel(entry.status)}</b></div><p>{entry.explanation}</p></article>)}</div>
          <section className={`registry-verdict verdict-${selected.compatibility}`}><strong>{compatibilityVerdict(selected.compatibility)}</strong>{selected.dimensions.some((entry) => entry.status !== "match") && <small>{selected.dimensions.filter((entry) => entry.status !== "match").map((entry) => `${entry.label}: ${entry.status}`).join(" · ")}</small>}<span>Non-combinability is a valid result.</span></section>
          <p className="registry-inspector-boundary">This study record remains visible for transparency. Only an anchor or fully compatible observed study enters the descriptive cohort.</p>
          <button onClick={removeSelected}>Remove selected record</button>
        </aside>}
      </section>

      <section className="registry-cohort">
        <header><h2>Compatible cohort summary</h2><span>Descriptive only — no averaged watchlist tier</span></header>
        <div className="registry-cohort-body">
          <div className="registry-cohort-stats">
            <RegistryStat label="Compatible observed studies" value={summary.cohort.compatibleObservedStudies} tone="positive" />
            <RegistryStat label="Phase-check pass rate" value={formatPercent(summary.cohort.phaseGatePassRate)} tone="positive" />
            <RegistryStat label="Mean holdout RMSE" value={formatMetric(summary.cohort.meanHoldoutRmse)} tone="data" />
            <RegistryStat label="Interval coverage" value={formatPercent(summary.cohort.meanIntervalCoverage)} tone="data" />
            <RegistryStat label="Negative studies preserved" value={summary.cohort.negativeStudiesPreserved} tone="negative" />
          </div>
          <RmseRange minimum={summary.cohort.minHoldoutRmse} maximum={summary.cohort.maxHoldoutRmse} mean={summary.cohort.meanHoldoutRmse} />
        </div>
        <p className="registry-boundary"><strong>Interpretation boundary:</strong> {summary.interpretationBoundary}</p>
      </section>
    </>}
  </div>;
}

function RegistryStat({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "positive" | "negative" | "data" }) {
  return <div className={`registry-stat tone-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function RmseRange({ minimum, maximum, mean }: { minimum: number | null; maximum: number | null; mean: number | null }) {
  if (minimum === null || maximum === null || mean === null) return <section className="registry-range"><h3>Descriptive heterogeneity</h3><p>No compatible replay metrics are available.</p></section>;
  const domainMin = Math.max(0, minimum - Math.max(0.02, (maximum - minimum) * 2));
  const domainMax = maximum + Math.max(0.02, (maximum - minimum) * 2);
  const x = (value: number) => 40 + ((value - domainMin) / Math.max(0.0001, domainMax - domainMin)) * 360;
  return <section className="registry-range"><header><h3>Descriptive heterogeneity</h3><span>Holdout RMSE · compatible observed studies</span></header><svg viewBox="0 0 440 90" role="img" aria-label={`Holdout RMSE ranges from ${formatMetric(minimum)} to ${formatMetric(maximum)}, mean ${formatMetric(mean)}`}><line x1="40" y1="56" x2="400" y2="56" className="range-axis"/><line x1={x(minimum)} y1="38" x2={x(maximum)} y2="38" className="range-line"/><circle cx={x(minimum)} cy="38" r="5"/><circle cx={x(maximum)} cy="38" r="5"/><line x1={x(mean)} y1="18" x2={x(mean)} y2="62" className="range-mean"/><text x={x(minimum)} y="28">{formatMetric(minimum)}</text><text x={x(maximum)} y="28">{formatMetric(maximum)}</text><text x={x(mean)} y="80">Mean {formatMetric(mean)}</text></svg></section>;
}

function parseReceiptPayload(payload: unknown): ParsedEmpiricalReceipt[] {
  const bundle = empiricalEvidenceRegistryBundleSchema.safeParse(payload);
  if (bundle.success) return bundle.data.receipts;
  const request = empiricalEvidenceRegistryRequestSchema.safeParse(payload);
  if (request.success) return request.data.receipts;
  if (Array.isArray(payload)) return payload.map((entry) => empiricalReceiptSchema.parse(entry));
  return [empiricalReceiptSchema.parse(payload)];
}

function compatibilityLabel(value: ReturnType<typeof aggregateEmpiricalReceipts>["receipts"][number]["compatibility"]) {
  return value === "partially-comparable" ? "Partial" : value === "non-comparable" ? "Non-comparable" : value[0].toUpperCase() + value.slice(1);
}

function compatibilityVerdict(value: ReturnType<typeof aggregateEmpiricalReceipts>["receipts"][number]["compatibility"]) {
  if (value === "anchor") return "Anchor study — defines this comparison";
  if (value === "compatible") return "Compatible — included descriptively";
  if (value === "partially-comparable") return "Partially comparable — do not aggregate";
  if (value === "non-comparable") return "Non-comparable — do not aggregate";
  return "Synthetic evidence — excluded";
}

function dimensionLabel(value: "match" | "differs" | "unknown" | "excluded") {
  return value === "match" ? "✓ Match" : value === "differs" ? "△ Differs" : value === "unknown" ? "? Unknown" : "Excluded";
}

function formatMetric(value: number | null) {
  return value === null ? "—" : (value + 1e-12).toFixed(3);
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(value === 1 ? 0 : 1)}%`;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
