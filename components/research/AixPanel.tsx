"use client";

import type { AixAssessment, AixComponentKey } from "@/engine/simulator";
import type { ScenarioDefinition } from "@/scenarios/catalog";

const componentNames: Record<AixComponentKey, string> = {
  P: "Physical alignment",
  B: "Biological viability",
  C: "Constructed coherence",
  F: "Feedback integrity",
  M: "Misclassification control",
  G: "Graceful degradation",
  R: "Correction capacity",
  Pi: "Pressure control",
};

const colors: Record<AixComponentKey, string> = {
  P: "#6f8cff",
  B: "#4bc7ff",
  C: "#6ddd83",
  F: "#ffd05a",
  M: "#ff9a52",
  G: "#bd79ff",
  R: "#9d72ff",
  Pi: "#42d7ea",
};

export function AixPanel({ assessment, scenario, compact = false }: { assessment: AixAssessment; scenario: ScenarioDefinition; compact?: boolean }) {
  const labels: Partial<Record<AixComponentKey, string>> = {
    P: scenario.aixLabels.physical,
    B: scenario.aixLabels.biological,
    C: scenario.aixLabels.constructed,
    F: scenario.aixLabels.feedback,
  };
  return (
    <section className={`aix-panel ${compact ? "compact" : ""}`} aria-label="ATS 4.0 Alignment Index and AANA gate">
      <header>
        <div><strong>ATS 4.0 AIx product extension</strong><small>Eight-domain illustrative synthetic diagnostic</small></div>
        <span className={`aix-decision ${assessment.decision}`}>{assessment.decision.toUpperCase()}</span>
      </header>
      <div className="aix-score"><span><b>{assessment.score.toFixed(1)}</b><small>/ 100</small></span><div><strong>{assessment.riskTier} risk tier</strong><small>illustrative compound-risk factor {assessment.beta.toFixed(3)} · accept ≥ {(assessment.thresholds.accept * 100).toFixed(0)}</small></div></div>
      <div className="aix-components">
        {(Object.keys(assessment.components) as AixComponentKey[]).map((key) => {
          const component = assessment.components[key];
          return <div className="aix-component" key={key} title={`${labels[key] ?? componentNames[key]} · ${component.evidence}`}><b style={{ color: colors[key] }}>{key}</b><span>{labels[key] ?? componentNames[key]}</span><i><em style={{ width: `${component.score * 100}%`, background: colors[key] }} /></i><strong>{(component.score * 100).toFixed(0)}</strong></div>;
        })}
      </div>
      <div className={`aana-gate ${assessment.hardBlockers.length ? "blocked" : ""}`}>
        <span aria-hidden="true">{assessment.hardBlockers.length ? "!" : "✓"}</span>
        <div><strong>AANA gate: {assessment.recommendedAction}</strong><small>{assessment.hardBlockers.length ? `Hard blockers: ${assessment.hardBlockers.join(", ")}` : "No synthetic hard blockers detected"}</small></div>
      </div>
      {!compact && <p>{assessment.calibrationStatus} This product extension is separate from the attached torus paper and from the simulator’s βrepay debt coefficient.</p>}
    </section>
  );
}
