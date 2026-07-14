"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TorusCanvas } from "@/components/simulation/TorusCanvas";
import {
  DifferenceChart,
  RadialStabilityChart,
  TimeSeriesChart,
  UnwrappedChart,
} from "@/components/charts/SimulationCharts";
import {
  createSignedDifferenceFrames,
  phaseAnalysisAvailable,
} from "@/components/charts/visualizationMath";
import {
  MODEL_VERSION,
  defaultParameters,
  deterministicExplanation,
  simulate,
  type ScheduledIntervention,
  type SimulationFrame,
  type SimulationParameters,
} from "@/engine/simulator";
import {
  scenarioById,
  scenarios,
  type ParameterKey,
  type ScenarioDefinition,
} from "@/scenarios/catalog";
import { CONTRACT_VERSION, PARAMETER_LIMITS } from "@/contracts/constants";
import { experimentSpecSchema, simulationParametersSchema } from "@/contracts/schemas";

type View = "home" | "scenarios" | "lab" | "compare" | "builder" | "learn" | "theory";
type Mode = "guided" | "research";

const parameterMeta: Record<ParameterKey, { symbol: string; min: number; max: number; step: number; color: string; description: string }> = {
  pressure: { symbol: "π", min: 0, max: 3, step: 0.01, color: "violet", description: "Intensity of optimization or output pressure." },
  feedback: { symbol: "γ", min: 0, max: 1, step: 0.01, color: "blue", description: "How faithfully consequences return as usable feedback." },
  correction: { symbol: "C", min: 0, max: 1.5, step: 0.01, color: "green", description: "Capacity to detect, repair, and gate misaligned behavior." },
  error: { symbol: "ε", min: 0, max: 1, step: 0.01, color: "amber", description: "Chance that a relevant constraint is misunderstood." },
  initialDebt: { symbol: "Δ", min: 0, max: 2, step: 0.01, color: "red", description: "Unresolved alignment work carried into the run." },
  drift: { symbol: "Φ", min: 0, max: 0.5, step: 0.01, color: "violet", description: "Rate at which the viable region changes." },
  irreversibleLoss: { symbol: "Λ", min: 0, max: 0.35, step: 0.01, color: "neutral", description: "Damage that cannot be repaid through ordinary correction." },
};

const visibleParameters: ParameterKey[] = ["pressure", "feedback", "correction", "error", "initialDebt", "drift", "irreversibleLoss"];

const navItems: { id: View; icon: string; label: string; description: string }[] = [
  { id: "home", icon: "⌂", label: "Home", description: "Live simulation dashboard" },
  { id: "scenarios", icon: "▦", label: "Scenarios", description: "Explore six systems" },
  { id: "lab", icon: "⚗", label: "Simulation Lab", description: "Advanced experiments" },
  { id: "compare", icon: "⇆", label: "Compare", description: "Side-by-side outcomes" },
  { id: "builder", icon: "◇", label: "Build Your Own System", description: "Template-based builder" },
  { id: "learn", icon: "▤", label: "Learn", description: "Guides & exercises" },
  { id: "theory", icon: "Σ", label: "About the Theory", description: "Paper & foundations" },
];

const interventions = [
  { id: "increase-correction", icon: "♢", label: "Increase Correction", detail: "Boost C", cost: 2, build: (p: SimulationParameters) => ({ correction: Math.min(1.5, p.correction + 0.14) }) },
  { id: "improve-feedback", icon: "▣", label: "Improve Feedback", detail: "Improve γ", cost: 2, build: (p: SimulationParameters) => ({ feedback: Math.min(1, p.feedback + 0.12) }) },
  { id: "reduce-pressure", icon: "↓", label: "Reduce Pressure", detail: "Reduce π", cost: 1, build: (p: SimulationParameters) => ({ pressure: Math.max(0, p.pressure - 0.42) }) },
  { id: "add-audit", icon: "⌕", label: "Add Audit", detail: "Reduce ε", cost: 2, build: (p: SimulationParameters) => ({ error: Math.max(0, p.error - 0.09), feedback: Math.min(1, p.feedback + 0.05) }) },
  { id: "pause-optimization", icon: "Ⅱ", label: "Pause Optimization", detail: "Stabilize & observe", cost: 1, build: (p: SimulationParameters) => ({ pressure: Math.max(0, p.pressure - 0.72), correction: Math.min(1.5, p.correction + 0.04) }) },
  { id: "repay-debt", icon: "↺", label: "Repay Debt", detail: "Increase β", cost: 3, build: (p: SimulationParameters) => ({ beta: Math.min(0.5, p.beta + 0.12), correction: Math.min(1.5, p.correction + 0.08) }) },
];

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<Mode>("guided");
  const [scenarioId, setScenarioId] = useState("llm-deployment");
  const [params, setParams] = useState<SimulationParameters>(scenarioById["llm-deployment"].defaults);
  const [scheduled, setScheduled] = useState<ScheduledIntervention[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [mobileNav, setMobileNav] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [toast, setToast] = useState("");
  const [locked, setLocked] = useState<ParameterKey[]>([]);
  const [scenarioFilter, setScenarioFilter] = useState<string>("All");
  const importRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const scenario = scenarioById[scenarioId];

  const run = useMemo(() => simulate(params, scheduled), [params, scheduled]);

  useEffect(() => {
    shellRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  const announce = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const track = useCallback((event: string, detail: Record<string, unknown> = {}) => {
    try {
      const log = JSON.parse(sessionStorage.getItem("torus-analytics") || "[]") as unknown[];
      sessionStorage.setItem("torus-analytics", JSON.stringify([...log.slice(-49), { event, detail, at: new Date().toISOString() }]));
    } catch { /* private local analytics only */ }
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const sharedConfig = query.get("config");
    if (sharedConfig) {
      try {
        const envelope = JSON.parse(sharedConfig);
        if (envelope.modelVersion !== MODEL_VERSION) throw new Error("Shared run uses an incompatible model version");
        const parsed = experimentSpecSchema.safeParse(envelope.experiment);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Shared run contract is invalid");
        const selected = scenarioById[parsed.data.scenarioId];
        if (!selected) throw new Error("Shared run references an unknown scenario");
        const validated = simulationParametersSchema.safeParse({ ...selected.defaults, ...parsed.data.parameters });
        if (!validated.success) throw new Error(validated.error.issues[0]?.message ?? "Shared run parameters are invalid");
        setScenarioId(selected.id);
        setParams(validated.data as SimulationParameters);
        setScheduled(parsed.data.interventions);
        setFrameIndex(0);
        setPlaying(false);
        announce("Shared seeded run and interventions restored");
      } catch (error) {
        announce(error instanceof Error ? error.message : "Shared run could not be restored");
      }
      return;
    }
    const sharedScenario = query.get("scenario");
    if (sharedScenario && scenarioById[sharedScenario]) {
      const base = { ...scenarioById[sharedScenario].defaults };
      const mapped: [keyof SimulationParameters, string][] = [
        ["seed", "seed"], ["pressure", "pi"], ["feedback", "gamma"], ["correction", "c"], ["error", "epsilon"], ["initialDebt", "debt"],
      ];
      mapped.forEach(([key, name]) => {
        const raw = query.get(name);
        const value = raw === null ? Number.NaN : Number(raw);
        if (Number.isFinite(value)) (base[key] as number) = value;
      });
      const validated = simulationParametersSchema.safeParse(base);
      if (validated.success) {
        setScenarioId(sharedScenario);
        setParams(validated.data as SimulationParameters);
        announce("Shared seeded run restored");
      } else {
        announce("Shared run was rejected because its parameters are invalid");
      }
    }
  }, [announce]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setFrameIndex((index) => {
        const next = Math.min(run.frames.length - 1, index + speed);
        if (next >= run.frames.length - 1) setPlaying(false);
        return next;
      });
    }, 42);
    return () => window.clearInterval(id);
  }, [playing, run.frames.length, speed]);

  const selectScenario = (selected: ScenarioDefinition) => {
    setScenarioId(selected.id);
    setParams({ ...selected.defaults });
    setScheduled([]);
    setFrameIndex(0);
    setPlaying(false);
    setView("home");
    setMobileNav(false);
    track("scenario_selected", { scenario: selected.id });
    announce(`${selected.title} loaded`);
  };

  const updateParam = (key: keyof SimulationParameters, value: number) => {
    if (locked.includes(key as ParameterKey)) return;
    if (!Number.isFinite(value)) return;
    setParams((current) => {
      const limit = PARAMETER_LIMITS[key];
      let bounded = Math.max(limit.min, Math.min(limit.max, value));
      if (limit.integer) bounded = Math.round(bounded);
      if (key === "rho0") bounded = Math.min(bounded, current.rhoCrit - 0.001);
      if (key === "rhoCrit") bounded = Math.max(bounded, current.rho0 + 0.001);
      return { ...current, [key]: bounded };
    });
    track("parameter_changed", { key, value });
  };

  const startRun = () => {
    if (frameIndex >= run.frames.length - 1) setFrameIndex(0);
    setPlaying(true);
    track("simulation_started", { scenario: scenario.id, seed: params.seed });
  };

  const resetRun = () => {
    setPlaying(false);
    setFrameIndex(0);
    setScheduled([]);
    announce("Run reset to initial conditions");
  };

  const applyIntervention = (definition: (typeof interventions)[number]) => {
    const step = Math.min(frameIndex + 1, params.steps - 1);
    const activeParameters = scheduled
      .filter((event) => event.step <= step)
      .sort((left, right) => left.step - right.step)
      .reduce((current, event) => ({ ...current, ...event.effects }), { ...params });
    const event: ScheduledIntervention = {
      id: `${definition.id}-${Date.now()}`,
      label: definition.label,
      step,
      effects: definition.build(activeParameters),
      cost: definition.cost,
    };
    setScheduled((items) => [...items, event]);
    setPlaying(true);
    track("intervention_applied", { intervention: definition.id, step: frameIndex });
    announce(`${definition.label} scheduled at t=${(event.step * params.dt).toFixed(1)}`);
  };

  const applyScenarioPreset = (name: string) => {
    const preset = scenario.presets.find((candidate) => candidate.name === name);
    if (!preset) return;
    setParams((current) => {
      const next = { ...current };
      Object.entries(preset.values).forEach(([key, value]) => {
        if (!locked.includes(key as ParameterKey) && typeof value === "number") {
          (next[key as keyof SimulationParameters] as number) = value;
        }
      });
      return next;
    });
    setScheduled([]);
    setFrameIndex(0);
    setPlaying(false);
    track("preset_selected", { scenario: scenario.id, preset: name });
    announce(`${name} preset loaded`);
  };

  const restoreDefaults = () => {
    setParams({ ...scenario.defaults });
    setScheduled([]);
    setFrameIndex(0);
    setPlaying(false);
    announce("Scenario defaults restored");
  };

  const savePreset = () => {
    const saved = { scenarioId, params, createdAt: new Date().toISOString(), modelVersion: MODEL_VERSION };
    localStorage.setItem("viability-torus-preset", JSON.stringify(saved));
    track("preset_selected", { action: "save" });
    announce("Preset saved on this device");
  };

  const loadSavedPreset = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("viability-torus-preset") || "null");
      if (!saved?.params || !scenarioById[saved.scenarioId]) throw new Error();
      if (saved.modelVersion !== MODEL_VERSION) throw new Error("Saved preset uses an incompatible model version");
      const selected = scenarioById[saved.scenarioId];
      const validated = simulationParametersSchema.safeParse({ ...selected.defaults, ...saved.params });
      if (!validated.success) throw new Error("Saved preset contains invalid parameters");
      setScenarioId(saved.scenarioId);
      setParams(validated.data as SimulationParameters);
      setScheduled([]);
      setFrameIndex(0);
      setPlaying(false);
      announce("Saved preset loaded");
    } catch (error) {
      announce(error instanceof Error && error.message ? error.message : "No valid saved preset found");
    }
  };

  const exportConfiguration = () => {
    downloadJson(`${scenario.id}-configuration.json`, configurationPayload(scenario, params, scheduled, run.summary));
    track("data_exported", { type: "configuration" });
  };

  const shareRun = async () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("config", JSON.stringify({
      modelVersion: MODEL_VERSION,
      experiment: {
        schemaVersion: CONTRACT_VERSION,
        scenarioId: scenario.id,
        parameters: params,
        interventions: scheduled,
        seeds: [params.seed],
        includeFrames: false,
      },
    }));
    await navigator.clipboard.writeText(url.toString());
    track("configuration_shared");
    announce("Reproducible run link copied");
  };

  const importConfiguration = async (file: File) => {
    try {
      if (file.size > 250_000) throw new Error("File is too large");
      const data = JSON.parse(await file.text());
      if (data?.modelVersion && data.modelVersion !== MODEL_VERSION) throw new Error(`Configuration requires model ${data.modelVersion}; this site runs ${MODEL_VERSION}`);
      const candidate = data?.experiment ?? (data?.configuration ? {
        schemaVersion: CONTRACT_VERSION,
        scenarioId: data.configuration.scenarioId,
        parameters: data.configuration.parameters,
        interventions: data.configuration.interventions,
      } : data);
      const parsed = experimentSpecSchema.safeParse(candidate);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid configuration schema");
      const selected = scenarioById[parsed.data.scenarioId];
      if (!selected) throw new Error("Unknown scenario id");
      const validatedParameters = simulationParametersSchema.safeParse({ ...selected.defaults, ...parsed.data.parameters });
      if (!validatedParameters.success) throw new Error(validatedParameters.error.issues[0]?.message ?? "Parameter values are out of range");
      setScenarioId(parsed.data.scenarioId);
      const imported = validatedParameters.data as SimulationParameters;
      setParams(imported);
      setScheduled(parsed.data.interventions);
      setFrameIndex(0);
      setPlaying(false);
      announce("Configuration imported safely");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Could not import this file");
    }
  };

  return (
    <div ref={shellRef} className={`app-shell ${highContrast ? "high-contrast" : ""}`}>
      <a className="skip-link" href="#main-content">Skip to simulator</a>
      <aside id="primary-nav" className={`sidebar ${mobileNav ? "open" : ""}`} aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>VIABILITY TORUS LAB</strong><small>Toroidal Geometry in ATS/AANA/AIx</small></span>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMobileNav(false); track(`${item.id}_viewed`); }}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </nav>
        <div className="category-nav" aria-label="Scenario categories">
          <span>SCENARIO DOMAINS</span>
          {["AI", "Organizations", "Healthcare", "Ecology"].map((category) => (
            <button key={category} onClick={() => { setScenarioFilter(category); setView("scenarios"); setMobileNav(false); }}><span aria-hidden="true">{category === "AI" ? "✦" : category === "Organizations" ? "▥" : category === "Healthcare" ? "+" : "≈"}</span>{category}</button>
          ))}
        </div>
        <div className="lab-card"><strong>Toroidal Systems Lab</strong><span>Reproducible synthetic simulations for viability and alignment</span><div><small>{MODEL_VERSION}</small><small><i /> Online</small></div></div>
      </aside>
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu" aria-label={`${mobileNav ? "Close" : "Open"} primary navigation menu`} onClick={() => setMobileNav((v) => !v)} aria-expanded={mobileNav} aria-controls="primary-nav"><span aria-hidden="true">☰</span><span>Menu</span></button>
          <label className="scenario-select"><span>Scenario</span><select value={scenarioId} onChange={(event) => selectScenario(scenarioById[event.target.value])}>{scenarios.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
          <div className="mode-switch" role="group" aria-label="Interface mode"><button className={mode === "guided" ? "active" : ""} onClick={() => setMode("guided")}>Guided</button><button className={mode === "research" ? "active" : ""} onClick={() => setMode("research")}>Research</button></div>
          <div className="top-actions">
            <button className="primary" onClick={startRun}><span aria-hidden="true">▶</span>{playing ? "Running" : frameIndex > 0 ? "Resume" : "Run Simulation"}</button>
            <button onClick={() => setView("compare")}>⇆ <span>Compare</span></button>
            <button onClick={savePreset}>♡ <span>Save Preset</span></button>
            <button onClick={() => setView("theory")}>ⓘ <span>About the Theory</span></button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          {view === "home" && (
            <SimulatorView
              scenario={scenario}
              params={params}
              updateParam={updateParam}
              locked={locked}
              toggleLock={(key) => setLocked((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key])}
              frames={run.frames}
              summary={run.summary}
              frameIndex={frameIndex}
              setFrameIndex={setFrameIndex}
              playing={playing}
              setPlaying={setPlaying}
              speed={speed}
              setSpeed={setSpeed}
              resetRun={resetRun}
              startRun={startRun}
              applyIntervention={applyIntervention}
              scheduled={scheduled}
              mode={mode}
              restoreDefaults={restoreDefaults}
              applyPreset={applyScenarioPreset}
              loadSavedPreset={loadSavedPreset}
              setParams={setParams}
              selectScenario={selectScenario}
              shareRun={shareRun}
              exportConfiguration={exportConfiguration}
              importConfiguration={() => importRef.current?.click()}
            />
          )}
          {view === "scenarios" && <ScenarioLibrary filter={scenarioFilter} setFilter={setScenarioFilter} selectScenario={selectScenario} />}
          {view === "lab" && <SimulationLab scenario={scenario} params={params} setParams={setParams} frames={run.frames} summary={run.summary} exportConfiguration={exportConfiguration} importConfiguration={() => importRef.current?.click()} announce={announce} />}
          {view === "compare" && <CompareMode scenario={scenario} params={params} scheduled={scheduled} primaryFrames={run.frames} primarySummary={run.summary} />}
          {view === "builder" && <SystemBuilder announce={announce} />}
          {view === "learn" && <LearnSection />}
          {view === "theory" && <TheorySection announce={announce} />}
        </main>
        <footer className="site-footer"><span>Model {MODEL_VERSION} · Synthetic model behavior, not empirical validation.</span><button onClick={() => setHighContrast((v) => !v)} aria-pressed={highContrast}>◐ High contrast</button><a href="/api/v1/model">Agent API</a><a href="/llms.txt">llms.txt</a><a href="/paper.pdf" download>Download paper</a></footer>
      </div>
      <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importConfiguration(file); event.target.value = ""; }} />
      <div className="sr-status" aria-live="polite">{toast}</div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

type SimulatorProps = {
  scenario: ScenarioDefinition;
  params: SimulationParameters;
  updateParam: (key: keyof SimulationParameters, value: number) => void;
  locked: ParameterKey[];
  toggleLock: (key: ParameterKey) => void;
  frames: SimulationFrame[];
  summary: ReturnType<typeof simulate>["summary"];
  frameIndex: number;
  setFrameIndex: (value: number | ((value: number) => number)) => void;
  playing: boolean;
  setPlaying: (value: boolean) => void;
  speed: number;
  setSpeed: (value: number) => void;
  resetRun: () => void;
  startRun: () => void;
  applyIntervention: (item: (typeof interventions)[number]) => void;
  scheduled: ScheduledIntervention[];
  mode: Mode;
  restoreDefaults: () => void;
  applyPreset: (name: string) => void;
  loadSavedPreset: () => void;
  setParams: (value: SimulationParameters | ((current: SimulationParameters) => SimulationParameters)) => void;
  selectScenario: (scenario: ScenarioDefinition) => void;
  shareRun: () => void;
  exportConfiguration: () => void;
  importConfiguration: () => void;
};

function SimulatorView(props: SimulatorProps) {
  const { scenario, params, frames, summary, frameIndex, setFrameIndex, playing, scheduled, mode } = props;
  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const phaseReady = phaseAnalysisAvailable(frameIndex, frames.length);
  const statusTone = statusToneFor(frame.status);
  const metricRows = [
    ["Alignment score", frame.alignment, 1, "green"],
    ["Radial excursion", frame.rho, params.rhoCrit, "cyan"],
    ["Debt level", frame.debt, 2, "orange"],
    ["Correction margin", frame.correctionMargin, 1, frame.correctionMargin >= 0 ? "green" : "red"],
  ] as const;
  return (
    <div className="dashboard-view">
      <section className="scenario-title-row">
        <div><div className="eyebrow"><span>{scenario.category}</span><span>{scenario.difficulty}</span><span>Scenario v{scenario.version}</span><span>{scenario.evidence.status}</span></div><h1>{scenario.title}</h1><p>{scenario.summary}</p></div>
        <div className="scenario-facts"><span><small>Optimizes</small>{scenario.optimizedOutcome}</span><span><small>Current seed</small>{params.seed}</span><span><small>Calibration</small>{scenario.evidence.calibrationStatus}</span></div>
      </section>
      <div className="dashboard-grid">
        <Panel className="torus-panel" title="Alignment Maintenance Torus" subtitle={`${scenario.cycles.minor.label} × ${scenario.cycles.major.label}`} action={<span className="panel-chip">3D interactive</span>}>
          <TorusCanvas frames={frames} frameIndex={frameIndex} params={params} playing={playing} onSelectFrame={(index) => { setFrameIndex(index); props.setPlaying(false); }} />
        </Panel>
        <Panel className="parameter-panel" title="System Parameters" subtitle={mode === "guided" ? "Plain-language controls" : "Canonical ATS/AANA/AIx variables"} action={<button className="text-button" onClick={props.restoreDefaults}>Reset</button>}>
          <div className="preset-row"><select aria-label="Load scenario preset" value="" onChange={(event) => props.applyPreset(event.target.value)}><option value="" disabled>Load preset…</option>{scenario.presets.map((preset) => <option key={preset.name} value={preset.name}>{preset.name}</option>)}</select>{scenario.presets.map((preset) => <button key={preset.name} onClick={() => props.applyPreset(preset.name)}>{preset.name}</button>)}</div>
          <div className="parameter-list">
            {visibleParameters.map((key) => <ParameterControl key={key} label={scenario.labels[key]} value={params[key]} meta={parameterMeta[key]} locked={props.locked.includes(key)} onLock={() => props.toggleLock(key)} onChange={(value) => props.updateParam(key, value)} />)}
          </div>
          {mode === "research" && <details className="advanced-params" open><summary>Advanced dynamics</summary><div className="advanced-grid">
            <NumberField label="κ restoration" value={params.kappa} min={PARAMETER_LIMITS.kappa.min} max={PARAMETER_LIMITS.kappa.max} step={.01} onChange={(value) => props.updateParam("kappa", value)} />
            <NumberField label="χ debt pressure" value={params.chi} min={PARAMETER_LIMITS.chi.min} max={PARAMETER_LIMITS.chi.max} step={.01} onChange={(value) => props.updateParam("chi", value)} />
            <NumberField label="ωθ local frequency" value={params.omegaTheta} min={PARAMETER_LIMITS.omegaTheta.min} max={PARAMETER_LIMITS.omegaTheta.max} step={.005} onChange={(value) => props.updateParam("omegaTheta", value)} />
            <NumberField label="ωφ external frequency" value={params.omegaPhi} min={PARAMETER_LIMITS.omegaPhi.min} max={PARAMETER_LIMITS.omegaPhi.max} step={.005} onChange={(value) => props.updateParam("omegaPhi", value)} />
            <NumberField label="ρ₀ reference" value={params.rho0} min={PARAMETER_LIMITS.rho0.min} max={Math.min(PARAMETER_LIMITS.rho0.max, params.rhoCrit - .001)} step={.05} onChange={(value) => props.updateParam("rho0", value)} />
            <NumberField label="ρcrit threshold" value={params.rhoCrit} min={Math.max(PARAMETER_LIMITS.rhoCrit.min, params.rho0 + .001)} max={PARAMETER_LIMITS.rhoCrit.max} step={.05} onChange={(value) => props.updateParam("rhoCrit", value)} />
          </div></details>}
        </Panel>
        <div className="status-column">
          <Panel className="status-panel" title="System Status" subtitle={`t = ${frame.time.toFixed(1)} · step ${frame.step}`}>
            <div className={`status-banner ${statusTone}`}><span className="status-orb" aria-hidden="true" /><div><strong>{frame.status.toUpperCase()}</strong><small>{statusMessage(frame)}</small></div><span className="shield" aria-hidden="true">◇</span></div>
            <div className="metric-list">{metricRows.map(([label, value, max, tone]) => <Metric key={label} label={label} value={value} max={max} tone={tone} />)}</div>
            <div className="status-mini-grid"><span><small>Radial velocity</small>{signed(frame.radialVelocity)}</span><span><small>Divergence</small>{frame.divergence.toFixed(3)}</span><span><small>Minor phase (simulated)</small>{phaseName(frame.theta, scenario.cycles.minor.stages)}</span><span><small>Offline major phase estimate</small>{phaseReady ? frame.phaseIdentifiable && frame.estimatedPhi !== undefined ? phaseName(frame.estimatedPhi, scenario.cycles.major.stages) : "Not identifiable" : "Available after full run"}</span><span><small>Full-run phase regime</small>{phaseReady ? frame.phaseRegime : "Pending"}</span><span><small>Full-run spectral concentration</small>{phaseReady ? `${Math.round(frame.phaseConfidence * 100)}%` : "Pending"}</span></div>
          </Panel>
          <Panel className="intervention-panel" title="Interventions" subtitle="Act while the simulation is running">
            <div className="intervention-grid">{interventions.map((item) => <button key={item.id} className={item.id === "pause-optimization" ? "wide warning" : ""} onClick={() => props.applyIntervention(item)}><span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong><small>{item.detail} · cost {item.cost}</small></button>)}</div>
            {scheduled.length > 0 && <div className="intervention-log"><strong>Active run log</strong>{scheduled.slice(-3).map((event) => <span key={event.id}><i />t {(event.step * params.dt).toFixed(1)} · {event.label} · cost {event.cost}</span>)}</div>}
          </Panel>
        </div>
      </div>

      <div className="simulation-bar" role="toolbar" aria-label="Simulation playback">
        <button className="primary" onClick={props.startRun}>▶ {playing ? "Running" : frameIndex > 0 ? "Resume" : "Run"}</button>
        <button onClick={() => props.setPlaying(!playing)}>{playing ? "Ⅱ Pause" : "▶ Resume"}</button>
        <button onClick={() => props.setPlaying(false)}>■ Stop</button>
        <button onClick={() => { props.resetRun(); props.startRun(); }}>↻ Restart</button>
        <button onClick={() => { props.setPlaying(false); setFrameIndex((i) => Math.min(frames.length - 1, i + 1)); }}>Step +1</button>
        <button onClick={props.resetRun}>↺ Reset</button>
        <button onClick={() => props.setParams((current) => ({ ...current, seed: Math.floor(Math.random() * 999999) }))}>⌁ Randomize seed</button>
        <label>Speed<select value={props.speed} onChange={(event) => props.setSpeed(Number(event.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option><option value={8}>8×</option></select></label>
        <input className="timeline" aria-label="Simulation time" type="range" min={0} max={frames.length - 1} value={frameIndex} onChange={(event) => { props.setPlaying(false); setFrameIndex(Number(event.target.value)); }} />
      </div>

      <section className="chart-grid">
        <Panel title="Unwrapped Torus" subtitle="Simulated θ vs latent φ · click to link time"><UnwrappedChart frames={frames} frameIndex={frameIndex} params={params} onSelect={(index) => { props.setPlaying(false); setFrameIndex(index); }} /></Panel>
        <Panel className="wide-chart" title="Alignment & Debt Over Time" subtitle="Alignment A · Debt Δ · Excursion ρ"><TimeSeriesChart frames={frames} frameIndex={frameIndex} params={params} onSelect={(index) => { props.setPlaying(false); setFrameIndex(index); }} /></Panel>
        <Panel title="Radial Stability" subtitle="dρ/dt vs ρ"><RadialStabilityChart frames={frames} frameIndex={frameIndex} params={params} /></Panel>
      </section>

      <section className="run-insight"><div><span className="insight-icon">◎</span><div><strong>Why this run looks this way</strong><p>{deterministicExplanation(frames.slice(0, Math.max(1, frameIndex + 1)), summary, { complete: frameIndex >= frames.length - 1 })}</p></div></div><div className="insight-actions"><button onClick={props.shareRun}>⌘ Copy share link</button><button onClick={props.exportConfiguration}>⇩ Config JSON</button><button onClick={() => downloadJson(`${scenario.id}-summary.json`, { schemaVersion: CONTRACT_VERSION, exportedAt: new Date().toISOString(), modelVersion: MODEL_VERSION, scenarioVersion: scenario.version, seed: params.seed, evidence: scenario.evidence, summary })}>⇩ Summary JSON</button><button onClick={() => exportCanvas(".torus-panel canvas", `${scenario.id}-torus.png`)}>◉ Torus PNG</button><button onClick={() => exportCanvas(".chart-grid canvas", `${scenario.id}-chart.png`)}>▥ Chart PNG</button><button onClick={() => exportChartSvg(frames, params, `${scenario.id}-timeseries.svg`)}>◇ Chart SVG</button><button onClick={props.importConfiguration}>⇧ Import</button><button onClick={props.loadSavedPreset}>♡ Load saved</button></div></section>

      <details className="scenario-evidence"><summary>Scenario evidence, assumptions, and falsification criteria</summary><div><p><strong>{scenario.evidence.status} · {scenario.evidence.calibrationStatus}</strong> {scenario.evidence.parameterUnits}</p><h3>Assumptions</h3><ul>{scenario.evidence.assumptions.map((item) => <li key={item}>{item}</li>)}</ul><h3>What would challenge this mapping</h3><ul>{scenario.evidence.falsificationCriteria.map((item) => <li key={item}>{item}</li>)}</ul><p>{scenario.evidence.references.map((reference, index) => <span key={reference.title}>{index ? " · " : ""}{reference.url ? <a href={reference.url}>{reference.title}</a> : reference.title}</span>)}</p></div></details>

      <section className="scenario-strip"><div className="section-heading"><div><h2>Explore Scenarios</h2><p>Real-world systems modeled with toroidal geometry</p></div><button onClick={() => document.querySelector<HTMLElement>(".sidebar nav button:nth-child(2)")?.click()}>View all scenarios →</button></div><div className="scenario-cards">{scenarios.map((item) => <ScenarioCard key={item.id} scenario={item} active={item.id === scenario.id} onClick={() => props.selectScenario(item)} compact />)}</div></section>

      <details className="data-table-fallback"><summary>Accessible data table for the current run</summary><div className="table-wrap"><table><caption>Latest simulation frames, linked to the charts above</caption><thead><tr><th>Step</th><th>Time</th><th>Alignment</th><th>Excursion</th><th>Debt</th><th>Margin</th><th>Viability</th><th>Phase regime</th></tr></thead><tbody>{frames.slice(Math.max(0, frameIndex - 12), frameIndex + 1).map((item) => <tr key={item.step}><td>{item.step}</td><td>{item.time.toFixed(2)}</td><td>{item.alignment.toFixed(3)}</td><td>{item.rho.toFixed(3)}</td><td>{item.debt.toFixed(3)}</td><td>{item.correctionMargin.toFixed(3)}</td><td>{item.status}</td><td>{item.phaseRegime}</td></tr>)}</tbody></table></div></details>
    </div>
  );
}

function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><header className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>{children}</section>;
}

function ParameterControl({ label, value, meta, locked, onLock, onChange }: { label: string; value: number; meta: (typeof parameterMeta)[ParameterKey]; locked: boolean; onLock: () => void; onChange: (value: number) => void }) {
  return <div className={`parameter-control tone-${meta.color} ${locked ? "locked" : ""}`}><div className="parameter-label"><span><strong>{label}</strong><small>{meta.symbol} · {meta.description}</small></span><button onClick={onLock} aria-label={`${locked ? "Unlock" : "Lock"} ${label}`} aria-pressed={locked}>{locked ? "▣" : "▢"}</button></div><div className="slider-row"><input type="range" aria-label={`${label}, ${meta.symbol}`} min={meta.min} max={meta.max} step={meta.step} value={value} disabled={locked} onChange={(event) => onChange(Number(event.target.value))} /><input aria-label={`${label} numeric value`} type="number" min={meta.min} max={meta.max} step={meta.step} value={value} disabled={locked} onChange={(event) => { if (event.target.value !== "") onChange(Math.max(meta.min, Math.min(meta.max, Number(event.target.value)))); }} /></div></div>;
}

function NumberField({ label, value, step, min, max, onChange }: { label: string; value: number; step: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label><span>{label}</span><input type="number" value={value} step={step} min={min} max={max} onChange={(event) => { if (event.target.value !== "") onChange(Number(event.target.value)); }} /></label>;
}

function Metric({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return <div className={`metric tone-${tone}`}><div><span>{label}</span><strong>{value >= 0 ? value.toFixed(2) : signed(value)} <small>/ {max.toFixed(1)}</small></strong></div><div className="metric-track"><i style={{ width: `${percent}%` }} /></div></div>;
}

function ScenarioLibrary({ filter, setFilter, selectScenario }: { filter: string; setFilter: (value: string) => void; selectScenario: (scenario: ScenarioDefinition) => void }) {
  const filtered = filter === "All" ? scenarios : scenarios.filter((item) => item.category === filter);
  return <div className="page-view"><section className="page-hero"><div className="eyebrow"><span>Scenario library</span><span>6 published systems</span></div><h1>Choose a familiar system.<br /><em>Then test its future.</em></h1><p>Every scenario maps the same canonical dynamics to domain-specific language, events, viable regions, and interventions.</p></section><div className="filter-row" role="group" aria-label="Filter scenarios">{["All", "AI", "Organizations", "Healthcare", "Ecology"].map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="library-grid">{filtered.map((item) => <ScenarioCard key={item.id} scenario={item} onClick={() => selectScenario(item)} />)}</div></div>;
}

function ScenarioCard({ scenario, onClick, compact = false, active = false }: { scenario: ScenarioDefinition; onClick: () => void; compact?: boolean; active?: boolean }) {
  return <button className={`scenario-card ${compact ? "compact" : ""} ${active ? "active" : ""}`} onClick={onClick} style={{ "--scenario-accent": scenario.accent } as React.CSSProperties}><div className="scenario-art"><span>{scenario.icon}</span><i /><i /><i /></div><div className="scenario-card-body"><div><span className="category-pill">{scenario.category}</span><span>{scenario.difficulty}</span><span>{scenario.evidence.status}</span></div><h3>{scenario.shortTitle}</h3><p>{scenario.summary}</p>{!compact && <dl><div><dt>Minor cycle</dt><dd>{scenario.cycles.minor.label}</dd></div><div><dt>Major cycle</dt><dd>{scenario.cycles.major.label}</dd></div><div><dt>Debt</dt><dd>{scenario.debtMechanism}</dd></div><div><dt>Calibration</dt><dd>{scenario.evidence.calibrationStatus}</dd></div></dl>}<strong className="launch-link">Launch scenario <span>→</span></strong></div></button>;
}

function SimulationLab({ scenario, params, setParams, frames, summary, exportConfiguration, importConfiguration, announce }: { scenario: ScenarioDefinition; params: SimulationParameters; setParams: (p: SimulationParameters) => void; frames: SimulationFrame[]; summary: ReturnType<typeof simulate>["summary"]; exportConfiguration: () => void; importConfiguration: () => void; announce: (message: string) => void }) {
  const [batchSize, setBatchSize] = useState(12);
  const [batch, setBatch] = useState<ReturnType<typeof simulate>["summary"][]>([]);
  const runBatch = () => {
    const results = Array.from({ length: batchSize }, (_, index) => simulate({ ...params, seed: params.seed + index }).summary);
    setBatch(results);
    announce(`${batchSize}-seed ensemble completed`);
  };
  const avg = (key: "finalAlignment" | "finalDebt" | "maxRho") => batch.length ? batch.reduce((sum, item) => sum + item[key], 0) / batch.length : 0;
  return <div className="page-view">
    <section className="page-hero compact"><div className="eyebrow"><span>Research mode</span><span>Model {MODEL_VERSION}</span></div><h1>Simulation Laboratory</h1><p>Configure deterministic runs, execute seeded ensembles, inspect model metadata, and export reproducible synthetic evidence.</p></section>
    <div className="lab-layout">
      <Panel title="Run configuration" subtitle={scenario.title}>
        <div className="form-grid">
          <NumberField label="Seed" value={params.seed} min={PARAMETER_LIMITS.seed.min} max={PARAMETER_LIMITS.seed.max} step={1} onChange={(value) => setParams({ ...params, seed: Math.max(0, Math.min(PARAMETER_LIMITS.seed.max, Math.round(value))) })} />
          <NumberField label="Steps (≤10,000)" value={params.steps} min={PARAMETER_LIMITS.steps.min} max={PARAMETER_LIMITS.steps.max} step={100} onChange={(value) => setParams({ ...params, steps: Math.max(1, Math.min(10000, Math.round(value))) })} />
          <NumberField label="Integration step Δt" value={params.dt} min={PARAMETER_LIMITS.dt.min} max={PARAMETER_LIMITS.dt.max} step={.05} onChange={(value) => setParams({ ...params, dt: Math.max(PARAMETER_LIMITS.dt.min, Math.min(PARAMETER_LIMITS.dt.max, value)) })} />
          <NumberField label="Ensemble seeds" value={batchSize} min={2} max={100} step={1} onChange={(value) => setBatchSize(Math.max(2, Math.min(100, Math.round(value))))} />
        </div>
        <div className="button-row"><button className="primary" onClick={runBatch}>Run batch</button><button onClick={exportConfiguration}>Export configuration</button><button onClick={importConfiguration}>Import configuration</button><button onClick={() => downloadCsv(`${scenario.id}-timeseries.csv`, frames)}>Export CSV</button></div>
      </Panel>
      <Panel title="Current run summary" subtitle={`Seed ${params.seed}`}>
        <div className="summary-cards"><SummaryStat label="Final viability" value={summary.finalStatus} /><SummaryStat label="Stable time" value={`${(summary.stableFraction * 100).toFixed(1)}%`} /><SummaryStat label="Max excursion" value={summary.maxRho.toFixed(3)} /><SummaryStat label="Final alignment" value={summary.finalAlignment.toFixed(3)} /><SummaryStat label="Winding ratio" value={summary.windingRatio.toFixed(3)} /><SummaryStat label="Phase regime" value={summary.phase.regime} /><SummaryStat label="Spectral concentration" value={`${(summary.phase.spectralConcentration * 100).toFixed(1)}%`} /><SummaryStat label="First warning" value={summary.firstWarningStep?.toString() ?? "None"} /><SummaryStat label="Rupture" value={summary.ruptureStep?.toString() ?? "Prevented"} /></div>
      </Panel>
      {batch.length > 0 && <Panel className="full-span" title="Ensemble result" subtitle={`${batch.length} deterministic seeds`}><div className="ensemble-strip"><SummaryStat label="Mean final alignment" value={avg("finalAlignment").toFixed(3)} /><SummaryStat label="Mean final debt" value={avg("finalDebt").toFixed(3)} /><SummaryStat label="Mean max excursion" value={avg("maxRho").toFixed(3)} /><SummaryStat label="Rupture probability" value={`${(batch.filter((item) => item.ruptureStep !== undefined).length / batch.length * 100).toFixed(1)}%`} /></div></Panel>}
      <Panel className="full-span" title="Scenario registry" subtitle="Published mappings are versioned; calibration status remains explicit"><div className="table-wrap"><table><thead><tr><th>Scenario</th><th>Category</th><th>Version</th><th>State</th><th>Evidence</th><th>Parameters</th></tr></thead><tbody>{scenarios.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.category}</td><td>{item.version}</td><td><span className="published">● Published</span></td><td>{item.evidence.status} · {item.evidence.calibrationStatus}</td><td>{Object.keys(item.defaults).length} mapped</td></tr>)}</tbody></table></div></Panel>
    </div>
  </div>;
}

function CompareMode({ scenario, params, scheduled, primaryFrames, primarySummary }: { scenario: ScenarioDefinition; params: SimulationParameters; scheduled: ScheduledIntervention[]; primaryFrames: SimulationFrame[]; primarySummary: ReturnType<typeof simulate>["summary"] }) {
  const [compareParams, setCompareParams] = useState({ ...params });
  const [interventionOffset, setInterventionOffset] = useState(0);
  const comparisonInterventions = useMemo(() => scheduled.map((event) => ({ ...event, step: Math.max(0, Math.min(compareParams.steps - 1, event.step + interventionOffset)) })), [compareParams.steps, interventionOffset, scheduled]);
  const comparison = useMemo(() => simulate(compareParams, comparisonInterventions), [compareParams, comparisonInterventions]);
  const index = Math.min(primaryFrames.length, comparison.frames.length) - 1;
  const changedParameters = (Object.keys(params) as (keyof SimulationParameters)[]).filter((key) => params[key] !== compareParams[key]).length + (interventionOffset === 0 ? 0 : 1);
  const delta = {
    alignment: primarySummary.finalAlignment - comparison.summary.finalAlignment,
    rho: primarySummary.maxRho - comparison.summary.maxRho,
    debt: primarySummary.finalDebt - comparison.summary.finalDebt,
  };
  return <div className="page-view">
    <section className="page-hero compact"><div className="eyebrow"><span>Controlled comparison</span><span>Seed {params.seed}</span><span>{changedParameters} controlled change{changedParameters === 1 ? "" : "s"}</span></div><h1>Compare two futures</h1><p>Both runs begin with the same scenario, seed, parameters, and intervention schedule. Change one B control to isolate its effect.</p></section>
    <div className="compare-controls">
      <label>Comparison scenario<input value={scenario.title} readOnly /></label>
      <label>B pressure π<input type="range" min={PARAMETER_LIMITS.pressure.min} max={PARAMETER_LIMITS.pressure.max} step={.01} value={compareParams.pressure} onChange={(event) => setCompareParams({ ...compareParams, pressure: Number(event.target.value) })} /><strong>{compareParams.pressure.toFixed(2)}</strong></label>
      <label>B correction C<input type="range" min={PARAMETER_LIMITS.correction.min} max={PARAMETER_LIMITS.correction.max} step={.01} value={compareParams.correction} onChange={(event) => setCompareParams({ ...compareParams, correction: Number(event.target.value) })} /><strong>{compareParams.correction.toFixed(2)}</strong></label>
      <label>B feedback γ<input type="range" min={PARAMETER_LIMITS.feedback.min} max={PARAMETER_LIMITS.feedback.max} step={.01} value={compareParams.feedback} onChange={(event) => setCompareParams({ ...compareParams, feedback: Number(event.target.value) })} /><strong>{compareParams.feedback.toFixed(2)}</strong></label>
      {scheduled.length > 0 && <label>B intervention timing<input type="range" min={-Math.min(100, scheduled[0].step)} max={100} step={1} value={interventionOffset} onChange={(event) => setInterventionOffset(Number(event.target.value))} /><strong>{interventionOffset >= 0 ? "+" : ""}{interventionOffset} steps</strong></label>}
      <button onClick={() => { setCompareParams({ ...params }); setInterventionOffset(0); }}>Reset B to A</button>
    </div>
    <div className="compare-grid">
      <Panel title="A · Active configuration" subtitle={`${scenario.shortTitle} · ${scheduled.length} intervention${scheduled.length === 1 ? "" : "s"}`}><TorusCanvas compact frames={primaryFrames} frameIndex={index} params={params} playing={false} onSelectFrame={() => {}} /><CompareSummary summary={primarySummary} /></Panel>
      <Panel title="B · Controlled variation" subtitle={`${scenario.shortTitle} · same seed · ${comparisonInterventions.length} intervention${comparisonInterventions.length === 1 ? "" : "s"}`}><TorusCanvas compact frames={comparison.frames} frameIndex={index} params={compareParams} playing={false} onSelectFrame={() => {}} /><CompareSummary summary={comparison.summary} /></Panel>
      <Panel className="full-span" title="Outcome difference · A minus B" subtitle={`${changedParameters} controlled change${changedParameters === 1 ? "" : "s"} · all other inputs held constant`}><div className="difference-cards"><SummaryStat label="Δ alignment" value={signed(delta.alignment)} tone={delta.alignment >= 0 ? "good" : "bad"} /><SummaryStat label="Δ max excursion" value={signed(delta.rho)} tone={delta.rho <= 0 ? "good" : "bad"} /><SummaryStat label="Δ debt" value={signed(delta.debt)} tone={delta.debt <= 0 ? "good" : "bad"} /><SummaryStat label="Time to warning" value={`${primarySummary.firstWarningStep ?? "∞"} / ${comparison.summary.firstWarningStep ?? "∞"}`} /></div><DifferenceChart frames={createSignedDifferenceFrames(primaryFrames, comparison.frames)} frameIndex={index} params={params} label="Signed difference chart for alignment, debt, and radial excursion" /><p className="compare-conclusion">{changedParameters === 0 ? "A and B are identical controls; their outcomes match exactly." : delta.alignment > .04 ? "Configuration A preserves meaningfully more alignment." : Math.abs(delta.alignment) < .02 ? "The runs finish with similar alignment, but their debt and recovery requirements may differ." : "Configuration B preserves more alignment under these settings."}</p></Panel>
    </div>
  </div>;
}

function CompareSummary({ summary }: { summary: ReturnType<typeof simulate>["summary"] }) { return <div className="compare-summary"><SummaryStat label="Final A" value={summary.finalAlignment.toFixed(3)} /><SummaryStat label="Final Δ" value={summary.finalDebt.toFixed(3)} /><SummaryStat label="Max ρ" value={summary.maxRho.toFixed(3)} /><SummaryStat label="Outcome" value={summary.ruptureStep !== undefined ? "Ruptured" : summary.recovered ? "Recovered" : summary.finalStatus} /></div>; }

const builderQuestions = ["What is the system optimizing?", "What is its recurring operating cycle?", "What is its external adaptation cycle?", "What feedback does it receive?", "What can it misclassify?", "What counts as correction?", "What accumulates as debt?", "What damage becomes irreversible?", "What defines viable operation?", "What events or shocks can occur?"];

function SystemBuilder({ announce }: { announce: (message: string) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(builderQuestions.length).fill(""));
  const complete = answers.filter(Boolean).length;
  const generate = () => {
    if (complete < builderQuestions.length) { announce("Complete all ten system questions first"); return; }
    const definition = { id: `custom-${Date.now()}`, title: answers[0], version: "0.1.0", sourceTemplate: "generic-recurrent-system", cycles: { minor: answers[1], major: answers[2] }, mappings: { feedback: answers[3], error: answers[4], correction: answers[5], debt: answers[6], irreversibleLoss: answers[7], viableRegion: answers[8], events: answers[9] }, defaults: defaultParameters };
    downloadJson("custom-torus-scenario.json", definition);
    announce("Shareable scenario definition generated");
  };
  return <div className="page-view builder-page"><section className="page-hero"><div className="eyebrow"><span>Template-based system builder</span><span>{complete}/10 mapped</span></div><h1>Turn a real system into<br /><em>a testable torus.</em></h1><p>Describe two meaningful recurrent cycles, what the system can see, how it corrects, and where recovery stops being cheap.</p></section><div className="builder-shell"><aside><div className="progress-ring" style={{ "--progress": `${complete * 10}%` } as React.CSSProperties}><span>{complete}<small>/10</small></span></div>{builderQuestions.map((question, index) => <button key={question} className={step === index ? "active" : answers[index] ? "done" : ""} onClick={() => setStep(index)}><span>{answers[index] ? "✓" : index + 1}</span>{question}</button>)}</aside><Panel title={`Question ${step + 1} of 10`} subtitle="Your answer becomes a scenario parameter mapping"><div className="builder-question"><span className="question-number">0{step + 1}</span><h2>{builderQuestions[step]}</h2><p>{builderHint(step)}</p><textarea autoFocus value={answers[step]} onChange={(event) => setAnswers((items) => items.map((item, index) => index === step ? event.target.value : item))} placeholder={builderPlaceholder(step)} /><div className="builder-actions"><button disabled={step === 0} onClick={() => setStep((value) => value - 1)}>← Back</button>{step < 9 ? <button className="primary" disabled={!answers[step].trim()} onClick={() => setStep((value) => value + 1)}>Continue →</button> : <button className="primary" onClick={generate}>Generate scenario JSON</button>}</div></div></Panel><Panel className="builder-preview" title="Live mapping preview" subtitle="Canonical variables remain distinct from your labels"><div className="mapping-list"><span><i>π</i><strong>{answers[0] || "Optimization target"}</strong></span><span><i>θ</i><strong>{answers[1] || "Local correction cycle"}</strong></span><span><i>φ</i><strong>{answers[2] || "External adaptation cycle"}</strong></span><span><i>γ</i><strong>{answers[3] || "Feedback channel"}</strong></span><span><i>ε</i><strong>{answers[4] || "Misclassification risk"}</strong></span><span><i>C</i><strong>{answers[5] || "Correction capacity"}</strong></span><span><i>Δ</i><strong>{answers[6] || "Alignment debt"}</strong></span><span><i>Λ</i><strong>{answers[7] || "Irreversible loss"}</strong></span></div></Panel></div></div>;
}

const learnTopics = [
  ["ATS", "Layered constraints", "Alignment is maintained relative to physical, human, constructed, hidden, and feedback constraints.", "A hospital cannot optimize flow while ignoring clinical harm."],
  ["AANA", "Correction architecture", "A system repeatedly proposes, verifies, grounds, corrects, gates, and repeats.", "An agent runs tests and reviews before integrating a change."],
  ["AIx", "Alignment measurement", "A vector of observable alignment signals, not a single universal score.", "Different metrics track safety, usefulness, fairness, and recoverability."],
  ["Why a torus?", "Two recurrent phases", "Two meaningful cycles combine as S¹ × S¹: a local correction cycle and an external adaptation cycle.", "Daily recovery interacts with longer life-season changes."],
  ["Correction cycle", "Minor phase θ", "The fast internal loop that detects and repairs local divergence.", "Verify, ground, correct, gate, repeat."],
  ["Adaptation cycle", "Major phase φ", "The slower loop through which the system learns a changing viable region.", "Observe the environment, revise policy, and reallocate capacity."],
  ["Radial excursion", "Distance from viability", "ρ tracks how far the current state sits from its recurrent viable tube.", "High excursion can be recoverable before the critical boundary."],
  ["Alignment debt", "Deferred correction Δ", "Unresolved divergence accumulates and raises the future correction required for recovery.", "Skipped audits make later remediation more expensive."],
  ["Hysteresis", "History changes recovery", "Returning pressure to its old value may not restore the old state after debt accumulates.", "Prevention can require less correction than late recovery."],
  ["Phase locking", "Synchronized cycles", "Two phases can fall into a rational frequency ratio, reducing coverage of the torus.", "Coordination can improve—or synchronize a shared mistake."],
  ["Viable region", "Where constraints hold", "A set of states that preserve the conditions needed for continued operation and correction.", "A fishery must stay above a recoverable stock threshold."],
  ["Irreversibility", "Loss Λ", "Some damage cannot be repaid through ordinary feedback and correction.", "Extinction, data leakage, or loss of patient life changes the state space."],
];

function LearnSection() {
  const [selected, setSelected] = useState(0);
  const topic = learnTopics[selected];
  return <div className="page-view learn-page"><section className="page-hero"><div className="eyebrow"><span>Learn</span><span>12 interactive concepts</span></div><h1>Understand the geometry<br /><em>through systems you know.</em></h1><p>Start in plain language, then reveal the mathematical structure and test your understanding.</p></section><div className="learn-layout"><div className="topic-grid">{learnTopics.map((item, index) => <button key={item[0]} className={selected === index ? "active" : ""} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item[0]}</strong><small>{item[1]}</small></button>)}</div><Panel className="lesson-panel" title={topic[0]} subtitle={topic[1]}><div className="lesson-visual" aria-hidden="true"><i /><i /><i /><span>θ</span><span>φ</span></div><div className="lesson-copy"><h3>Plain-language explanation</h3><p>{topic[2]}</p><h3>Scenario example</h3><p>{topic[3]}</p><h3>Mathematical view</h3><code>{learnEquation(selected)}</code><div className="exercise"><strong>Try it in the lab</strong><p>{learnExercise(selected)}</p><button onClick={() => document.querySelector<HTMLElement>(".sidebar nav button:nth-child(1)")?.click()}>Open simulator →</button></div></div></Panel></div></div>;
}

function TheorySection({ announce }: { announce: (message: string) => void }) {
  const citation = "Sori, A. (2026). Toroidal Geometry in ATS/AANA/AIx: Stable Recurrence, Invariant Tori, and Viability-Preserving Cycles in Layered Alignment Systems. Revised phase-coordinate edition.";
  return <div className="page-view theory-page"><section className="page-hero"><div className="eyebrow"><span>Research foundations</span><span>Revised phase-coordinate edition</span></div><h1>Alignment may be stable<br /><em>without standing still.</em></h1><p>The theory reframes alignment as the maintenance of viable recurrent motion across a fast correction cycle and a slower environmental adaptation cycle.</p><div className="hero-actions"><a className="button primary" href="/paper.pdf" target="_blank">Read the complete paper</a><button onClick={async () => { await navigator.clipboard.writeText(citation); announce("Citation copied"); }}>Copy citation</button></div></section><div className="theory-grid"><Panel className="theory-summary" title="The central claim" subtitle="Conservative by design"><blockquote>When alignment requires two coupled recurrent processes—internal correction and external adaptation—the natural geometric object is a torus.</blockquote><p>The ATS/AANA/AIx equations do not literally define a torus by themselves. Toroidal geometry is a conditional extension for systems with two meaningful, independent recurrent phases and a bounded radial stability coordinate.</p><div className="theorem-cards"><article><span>01</span><strong>Two-cycle state</strong><code>T² = S¹ × S¹</code><p>Minor phase θ tracks local correction; major phase φ tracks external adaptation.</p></article><article><span>02</span><strong>Radial stability</strong><code>dA/dt = −πε(1−γ) − Λ + C − Φ</code><p>Correction must keep pace with pressure, error, drift, and irreversible loss.</p></article><article><span>03</span><strong>Debt & hysteresis</strong><code>ρ̇ = −κ(ρ−ρ₀) + D−C + χΔ</code><p>Accumulated debt can shift the equilibrium radius and raise recovery cost.</p></article></div></Panel><Panel title="Model equations" subtitle="Paper-aligned dynamics; the engine uses bounded internal substeps"><div className="equation-stack"><code>Dₜ = πₜ εₜ (1 − γₜ) + Λₜ + Φₜ</code><code>θₜ₊₁ = (θₜ + ωθ + a sin φₜ + ξθₜ) mod 2π</code><code>φₜ₊₁ = (φₜ + ωφ + b sin θₜ + ξφₜ) mod 2π</code><code>Δₜ₊₁ = Δₜ + α[D−C]₊ − β[C−D]₊ q(Aₜ)</code><code>ρₜ₊₁ = ρₜ − κ(ρₜ−ρ₀) + D−C + χΔₜ + ξρₜ</code><code>Aₜ = e⁻ρᵗ</code></div></Panel><Panel title="Research status & limitations" subtitle="What the simulator does—and does not—show"><ul className="limitation-list"><li><strong>Conditional geometry.</strong> Not every system is expected to occupy a toroidal manifold; two meaningful recurrent phases are required.</li><li><strong>Synthetic evidence.</strong> The included experiments demonstrate model behavior, not empirical validation of hospitals, people, companies, ecosystems, or AI deployments.</li><li><strong>Phase identifiability.</strong> The dashboard’s external phase estimate is derived from a generated mismatch signal and is reported only after temporal, spectral, cycle-count, and sampling gates pass. This demonstrates the revised estimator; it does not validate a real-world measurement process.</li><li><strong>Scenario mappings are hypotheses.</strong> Every scenario publishes its assumptions, dimensionless units, calibration status, references, and falsification criteria; none is an operational policy recommendation.</li><li><strong>Coordination is not alignment.</strong> Coupled agents may synchronize while becoming collectively misaligned.</li></ul></Panel><Panel title="Paper & citation" subtitle="Armando Sori · Independent Researcher · July 13, 2026"><div className="paper-card"><div className="paper-preview"><span>TOROIDAL GEOMETRY</span><strong>ATS / AANA / AIx</strong><i /></div><p>{citation}</p><div className="button-row"><a className="button" href="/paper.pdf" download>Download PDF</a><button onClick={() => downloadText("citation.bib", `@article{sori2026toroidal,\n  title={Toroidal Geometry in ATS/AANA/AIx},\n  author={Sori, Armando},\n  year={2026},\n  note={Revised phase-coordinate edition}\n}`)}>BibTeX</button></div></div><div className="changelog"><strong>Model changelog</strong><span><b>v1.1.0</b> Paper-aligned debt repayment, bounded integration, unwrapped winding, viability/phase separation, identifiability gates, evidence receipts, and controlled interventions.</span><span><b>v1.0.0</b> Deterministic two-phase dynamics, debt, radial viability, interventions, and six illustrative scenario mappings.</span><span><b>Paper revision</b> External phase estimator uses signed temporal mismatch; non-identifiable phases remain undefined.</span></div></Panel></div></div>;
}

function SummaryStat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) { return <span className={`summary-stat ${tone}`}><small>{label}</small><strong>{value}</strong></span>; }
function statusToneFor(status: string) { if (status === "Stable") return "stable"; if (status === "Ruptured" || status === "Rupture approaching") return "danger"; if (status === "Recovering") return "recovering"; return "warning"; }
function statusMessage(frame: SimulationFrame) { if (frame.status === "Stable") return "System is inside the viable tube."; if (frame.status === "Recovering") return "Excursion is contracting after stress."; if (frame.status === "Ruptured") return "Critical radial boundary crossed."; return frame.correctionMargin < 0 ? "Divergence exceeds current correction." : "Viability margin is narrowing."; }
function phaseName(angle: number, stages: string[]) { const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return stages[Math.floor((normalized / (Math.PI * 2)) * stages.length) % stages.length]; }
function signed(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`; }
function builderHint(step: number) { return ["Name the outcome the system currently rewards or pursues.", "Describe the fast loop that repeats during ordinary operation.", "Describe the slower loop through which conditions, policy, or context change.", "Name the signals that reveal whether the outcome remains viable.", "What important constraint can the system misunderstand or fail to represent?", "What people, processes, or mechanisms can detect and repair divergence?", "What unresolved work compounds when correction is deferred?", "What loss changes the future state space and cannot be cheaply undone?", "State the conditions that must remain true for continued safe operation.", "List shocks, delays, regime changes, or scheduled events." ][step]; }
function builderPlaceholder(step: number) { return ["e.g. Deliver useful software quickly", "e.g. plan → edit → test → review", "e.g. release → observe users → revise strategy", "e.g. tests, incidents, user reports, audits", "e.g. unstated security and data-retention constraints", "e.g. code review, rollback, human approval", "e.g. untested changes and architectural shortcuts", "e.g. corrupted data or leaked credentials", "e.g. changes stay testable, reversible, and policy-compliant", "e.g. traffic spike, dependency outage, policy change"][step]; }
function learnEquation(index: number) { return ["R = (Kₚ, Kᵦ, K𝚌, Kₕ, K𝒇)", "propose → verify → ground → correct → gate", "AIx(t) = [a₁(t), …, aₙ(t)]", "q(t) = (θ(t), φ(t)) ∈ S¹ × S¹", "θₜ₊₁ = (θₜ + ωθ + a sin φₜ) mod 2π", "φₜ₊₁ = (φₜ + ωφ + b sin θₜ) mod 2π", "Aₜ = e⁻ρᵗ", "Δ̇ = α[D−C]₊ − β[C−D]₊", "Cᵣₑcₒᵥₑᵣ(Δ) > Cₚᵣₑᵥₑₙₜ", "ωθ / ωφ ≈ p/q", "V ⊂ T² × ℝ₊", "D = πε(1−γ) + Λ + Φ"][index]; }
function learnExercise(index: number) { return ["Toggle research mode and inspect the constraint-related controls.", "Increase correction capacity and watch the minor cycle remain bounded.", "Compare alignment, debt, and radial excursion rather than relying on one score.", "Switch the torus between 3D and unwrapped 2D views.", "Raise local-cycle frequency and inspect the winding pattern.", "Lower external frequency and look for a changed winding ratio.", "Raise pressure until the current point leaves the viable tube.", "Start with high debt, then compare prevention with late intervention.", "Run a stressed preset, restore pressure, and measure remaining debt.", "Move the phase frequencies toward a rational ratio.", "Change the critical radius and compare warning lead time.", "Increase irreversible loss and test whether ordinary correction can recover."][index]; }

function configurationPayload(scenario: ScenarioDefinition, params: SimulationParameters, interventions: ScheduledIntervention[], summary: ReturnType<typeof simulate>["summary"]) { return { schemaVersion: CONTRACT_VERSION, exportedAt: new Date().toISOString(), modelVersion: MODEL_VERSION, scenarioVersion: scenario.version, scenarioEvidence: scenario.evidence, experiment: { schemaVersion: CONTRACT_VERSION, scenarioId: scenario.id, parameters: params, interventions, seeds: [params.seed], includeFrames: false }, summary }; }
function downloadJson(filename: string, value: unknown) { downloadText(filename, JSON.stringify(value, null, 2), "application/json"); }
function downloadText(filename: string, content: string, type = "text/plain") { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
function downloadCsv(filename: string, frames: SimulationFrame[]) { const header = "step,time,theta,phi,thetaUnwrapped,phiUnwrapped,estimatedPhi,phaseIdentifiable,phaseConfidence,phaseRegime,rho,debt,alignment,divergence,correction,correctionMargin,irreversibleLoss,status"; const rows = frames.map((f) => [f.step, f.time, f.theta, f.phi, f.thetaUnwrapped, f.phiUnwrapped, f.estimatedPhi ?? "", f.phaseIdentifiable, f.phaseConfidence, f.phaseRegime, f.rho, f.debt, f.alignment, f.divergence, f.correction, f.correctionMargin, f.irreversibleLoss, f.status].map(csvCell).join(",")); downloadText(filename, [header, ...rows].join("\n"), "text/csv"); }
function csvCell(value: string | number | boolean) { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function exportCanvas(selector: string, filename: string) { const canvas = document.querySelector<HTMLCanvasElement>(selector); if (!canvas) return; canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }, "image/png"); }
function exportChartSvg(frames: SimulationFrame[], params: SimulationParameters, filename: string) { const width = 1200; const height = 600; const pad = 64; const maxDebt = Math.max(1, ...frames.map((frame) => frame.debt)); const maxRho = Math.max(params.rhoCrit, ...frames.map((frame) => frame.rho)); const path = (value: (frame: SimulationFrame) => number) => frames.map((frame, index) => `${index ? "L" : "M"}${(pad + index / Math.max(1, frames.length - 1) * (width - pad * 2)).toFixed(1)},${(height - pad - value(frame) * (height - pad * 2)).toFixed(1)}`).join(" "); const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#06101f"/><g stroke="#18304d" stroke-width="1">${Array.from({ length: 7 }, (_, index) => `<path d="M${pad} ${pad + index * (height - pad * 2) / 6}H${width - pad}"/>`).join("")}</g><path d="${path((frame) => frame.alignment)}" fill="none" stroke="#71e17d" stroke-width="3"/><path d="${path((frame) => frame.debt / maxDebt)}" fill="none" stroke="#ff5b62" stroke-width="3"/><path d="${path((frame) => frame.rho / maxRho)}" fill="none" stroke="#49bfff" stroke-width="3" stroke-dasharray="8 6"/><text x="${pad}" y="38" fill="#dcecff" font-family="system-ui" font-size="22">Viability Torus Lab — Alignment, Debt, and Excursion</text><text x="${pad}" y="${height - 20}" fill="#91a4bf" font-family="monospace" font-size="14">Independent scales: A 0–1 · Δ 0–${maxDebt.toFixed(3)} · ρ 0–${maxRho.toFixed(3)} · model ${MODEL_VERSION}</text></svg>`; downloadText(filename, svg, "image/svg+xml"); }
