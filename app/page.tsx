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
  deriveTorusGeometry,
  phaseAnalysisAvailable,
  type TorusGeometryState,
} from "@/components/charts/visualizationMath";
import {
  MODEL_VERSION,
  defaultParameters,
  simulate,
  type ScheduledIntervention,
  type SimulationExplanation,
  type SimulationFrame,
  type SimulationParameters,
} from "@/engine/simulator";
import { assessRun } from "@/engine/assessment";
import {
  assessWatchlistConfiguration,
  type SimulatedWatchlistTier,
  type WatchlistAssessment,
} from "@/engine/watchlist";
import {
  scenarioById,
  scenarioCategories,
  scenarios,
  featuredSystemCount,
  watchlistCounts,
  type ParameterKey,
  type ScenarioDefinition,
} from "@/scenarios/catalog";
import type { ScenarioProtocolDefinition } from "@/contracts/types";
import type { InterventionDefinition, InterventionPlanDefinition, SystemTemplateDefinition } from "@/contracts/types";
import { systemTemplateById, systemTemplates } from "@/scenarios/templates";
import {
  compileIntervention,
  compileInterventionPlan,
  interventionDefinitionById,
  interventionDefinitions,
  interventionPlanById,
  interventionPlans,
} from "@/scenarios/interventions";
import { parameterEducationFor, type ParameterEducation } from "@/scenarios/education";
import {
  assessTorusEligibility,
  buildScenarioProposal,
  builderQuestions,
  emptyBuilderAnswers,
  type BuilderAnswers,
} from "@/scenarios/builder";
import { CONTRACT_VERSION, PARAMETER_LIMITS } from "@/contracts/constants";
import { experimentSpecSchema, scenarioDefinitionSchema, simulationParametersSchema, type ParsedEmpiricalReceipt } from "@/contracts/schemas";
import { ExperimentsWorkspace } from "@/components/research/ExperimentsWorkspace";
import { AixPanel } from "@/components/research/AixPanel";
import { EmpiricalLab } from "@/components/empirical/EmpiricalLab";
import { EvidenceRegistry } from "@/components/empirical/EvidenceRegistry";
import { mergeEmpiricalReceipts } from "@/empirical/registry";

type View = "home" | "scenarios" | "lab" | "compare" | "experiments" | "empirical" | "evidence" | "builder" | "learn" | "theory";
type Mode = "guided" | "research";

const parameterMeta: Record<ParameterKey, { symbol: string; min: number; max: number; step: number; color: string; description: string }> = {
  pressure: { symbol: "π", min: 0, max: 3, step: 0.01, color: "violet", description: "Intensity of optimization or output pressure." },
  feedback: { symbol: "γ", min: 0, max: 1, step: 0.01, color: "blue", description: "How faithfully consequences return as usable feedback." },
  correction: { symbol: "C", min: 0, max: 2, step: 0.01, color: "green", description: "Capacity to detect, repair, and gate misaligned behavior." },
  error: { symbol: "ε", min: 0, max: 1, step: 0.01, color: "amber", description: "Chance that a relevant constraint is misunderstood." },
  initialDebt: { symbol: "Δ", min: 0, max: 2, step: 0.01, color: "red", description: "Unresolved alignment work carried into the run." },
  drift: { symbol: "Φ", min: 0, max: 0.5, step: 0.01, color: "violet", description: "Rate at which the viable region changes." },
  irreversibleLoss: { symbol: "Λ", min: 0, max: 0.5, step: 0.01, color: "neutral", description: "Damage that cannot be repaid through ordinary correction." },
};

const visibleParameters: ParameterKey[] = ["pressure", "feedback", "correction", "error", "initialDebt", "drift", "irreversibleLoss"];

const navItems: { id: View; icon: string; label: string; description: string }[] = [
  { id: "home", icon: "⌂", label: "Home", description: "Live simulation dashboard" },
  { id: "scenarios", icon: "▦", label: "Systems", description: "Explore 32 bounded systems" },
  { id: "lab", icon: "⚗", label: "Simulation Lab", description: "Advanced experiments" },
  { id: "compare", icon: "⇆", label: "Compare", description: "Side-by-side outcomes" },
  { id: "experiments", icon: "◫", label: "Experiments", description: "Protocol-driven studies" },
  { id: "empirical", icon: "⌁", label: "Empirical Lab", description: "Browser-local observations" },
  { id: "evidence", icon: "⌘", label: "Evidence Registry", description: "Compare redacted receipts" },
  { id: "builder", icon: "◇", label: "Build Your Own System", description: "Template-based builder" },
  { id: "learn", icon: "▤", label: "Learn", description: "Guides & exercises" },
  { id: "theory", icon: "Σ", label: "About the Theory", description: "Paper & foundations" },
];

const categoryIcons: Record<string, string> = { AI: "✦", Ecology: "≈", Healthcare: "+", Organizations: "▥", Infrastructure: "▧", Economy: "∿", Society: "◎" };
const tierOrder = ["red", "orange", "yellow"] as const;
const tierLabels = { red: "Red watchlist", orange: "Orange watchlist", yellow: "Yellow watchlist" } as const;
const compactScenarios = scenarios.filter((item) => item.featured).slice(0, 6);

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<Mode>("guided");
  const [scenarioId, setScenarioId] = useState("llm-deployment");
  const [protocolId, setProtocolId] = useState(scenarioById["llm-deployment"].defaultProtocolId);
  const [interventionPlanId, setInterventionPlanId] = useState("no-action");
  const [params, setParams] = useState<SimulationParameters>(scenarioById["llm-deployment"].defaults);
  const [customScheduled, setCustomScheduled] = useState<ScheduledIntervention[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [mobileNav, setMobileNav] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [toast, setToast] = useState("");
  const [locked, setLocked] = useState<ParameterKey[]>([]);
  const [scenarioFilter, setScenarioFilter] = useState<string>("All");
  const [empiricalScenario, setEmpiricalScenario] = useState<ScenarioDefinition | null>(null);
  const [evidenceReceipts, setEvidenceReceipts] = useState<ParsedEmpiricalReceipt[]>([]);
  const [clientReady, setClientReady] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const scenario = scenarioById[scenarioId];
  const protocol = scenario.protocols.find((item) => item.id === protocolId)
    ?? scenario.protocols.find((item) => item.id === scenario.defaultProtocolId)
    ?? scenario.protocols[0];
  const template = systemTemplateById[scenario.system.templateId];
  const interventionPlan = interventionPlanById[interventionPlanId] ?? interventionPlanById["no-action"];
  const plannedScheduled = useMemo(
    () => compileInterventionPlan(interventionPlan, params),
    [interventionPlan, params],
  );
  const scheduled = useMemo(
    () => [...plannedScheduled, ...customScheduled].sort((left, right) => left.step - right.step || left.id.localeCompare(right.id)),
    [customScheduled, plannedScheduled],
  );

  const run = useMemo(
    () => simulate(params, scheduled, { rupturePolicy: scenario.rupturePolicy }),
    [params, scheduled, scenario.rupturePolicy],
  );

  useEffect(() => {
    setClientReady(true);
    shellRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);

  const announce = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const registerEvidence = useCallback((receipt: ParsedEmpiricalReceipt) => {
    setEvidenceReceipts((current) => mergeEmpiricalReceipts(current, [receipt]));
    setView("evidence");
    announce("Redacted receipt added to the Evidence Registry; raw observations remain in the Empirical Lab");
  }, [announce]);

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
        const restoredSystemId = parsed.data.systemId ?? parsed.data.scenarioId;
        const selected = restoredSystemId ? scenarioById[restoredSystemId] : undefined;
        if (!selected) throw new Error("Shared run references an unknown scenario");
        const validated = simulationParametersSchema.safeParse({ ...selected.defaults, ...parsed.data.parameters });
        if (!validated.success) throw new Error(validated.error.issues[0]?.message ?? "Shared run parameters are invalid");
        setScenarioId(selected.id);
        const sharedProtocolId = parsed.data.protocolId ?? envelope.protocolId;
        setProtocolId(selected.protocols.some((item) => item.id === sharedProtocolId) ? sharedProtocolId : selected.defaultProtocolId);
        setInterventionPlanId(interventionPlanById[parsed.data.interventionPlanId]?.id ?? "no-action");
        setParams(validated.data as SimulationParameters);
        setCustomScheduled(parsed.data.interventions);
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
        setProtocolId(scenarioById[sharedScenario].defaultProtocolId);
        setInterventionPlanId("no-action");
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
    setProtocolId(selected.defaultProtocolId);
    setInterventionPlanId("no-action");
    setParams({ ...selected.defaults });
    setCustomScheduled([]);
    setFrameIndex(0);
    setPlaying(false);
    setView("home");
    setMobileNav(false);
    track("scenario_selected", { scenario: selected.id });
    announce(`${selected.title} loaded`);
  };

  const selectTemplate = (templateId: string) => {
    const firstSystem = scenarios.find((item) => item.system.templateId === templateId);
    if (firstSystem) selectScenario(firstSystem);
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
    setCustomScheduled([]);
    announce("Run reset to initial conditions");
  };

  const applyIntervention = (definition: InterventionDefinition) => {
    const step = Math.min(frameIndex + 1, params.steps - 1);
    const activeParameters = scheduled
      .filter((event) => event.step <= step)
      .sort((left, right) => left.step - right.step)
      .reduce((current, event) => ({ ...current, ...event.effects }), { ...params });
    const compiled = compileIntervention({ definition, parameters: activeParameters, step, planId: "manual", occurrenceId: `${definition.id}-${Date.now()}` });
    const event = compiled.events[0];
    setCustomScheduled((items) => [...items, ...compiled.events]);
    setPlaying(true);
    track("intervention_applied", { intervention: definition.id, step: frameIndex });
    announce(`${definition.shortTitle} scheduled at t=${(event.step * params.dt).toFixed(1)}`);
  };

  const applyScenarioProtocol = (nextProtocolId: string) => {
    const nextProtocol = scenario.protocols.find((candidate) => candidate.id === nextProtocolId);
    if (!nextProtocol) return;
    setProtocolId(nextProtocol.id);
    setParams({ ...nextProtocol.parameters });
    setCustomScheduled([]);
    setFrameIndex(0);
    setPlaying(false);
    track("protocol_selected", { system: scenario.system.id, protocol: nextProtocol.id });
    announce(`${nextProtocol.title} protocol loaded`);
  };

  const applyInterventionPlan = (nextPlanId: string) => {
    const nextPlan = interventionPlanById[nextPlanId];
    if (!nextPlan) return;
    setInterventionPlanId(nextPlan.id);
    setCustomScheduled([]);
    setFrameIndex(0);
    setPlaying(false);
    track("intervention_plan_selected", { system: scenario.system.id, protocol: protocol.id, plan: nextPlan.id });
    announce(`${nextPlan.title} plan loaded`);
  };

  const restoreDefaults = () => {
    setParams({ ...protocol.parameters });
    setCustomScheduled([]);
    setFrameIndex(0);
    setPlaying(false);
    announce(`${protocol.title} parameters restored`);
  };

  const savePreset = () => {
    const saved = { systemId: scenarioId, scenarioId, protocolId, interventionPlanId, params, interventions: customScheduled, createdAt: new Date().toISOString(), modelVersion: MODEL_VERSION };
    localStorage.setItem("viability-torus-preset", JSON.stringify(saved));
    track("preset_selected", { action: "save" });
    announce("Preset saved on this device");
  };

  const loadSavedPreset = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("viability-torus-preset") || "null");
      const savedSystemId = saved?.systemId ?? saved?.scenarioId;
      if (!saved?.params || !scenarioById[savedSystemId]) throw new Error();
      if (saved.modelVersion !== MODEL_VERSION) throw new Error("Saved preset uses an incompatible model version");
      const selected = scenarioById[savedSystemId];
      const validated = simulationParametersSchema.safeParse({ ...selected.defaults, ...saved.params });
      if (!validated.success) throw new Error("Saved preset contains invalid parameters");
      setScenarioId(savedSystemId);
      setProtocolId(selected.protocols.some((item) => item.id === saved.protocolId) ? saved.protocolId : selected.defaultProtocolId);
      setInterventionPlanId(interventionPlanById[saved.interventionPlanId]?.id ?? "no-action");
      setParams(validated.data as SimulationParameters);
      setCustomScheduled(Array.isArray(saved.interventions) ? saved.interventions : []);
      setFrameIndex(0);
      setPlaying(false);
      announce("Saved preset loaded");
    } catch (error) {
      announce(error instanceof Error && error.message ? error.message : "No valid saved preset found");
    }
  };

  const exportConfiguration = () => {
    downloadJson(`${scenario.id}-configuration.json`, configurationPayload(scenario, protocol, interventionPlan, params, customScheduled, scheduled, run.summary));
    track("data_exported", { type: "configuration" });
  };

  const shareRun = async () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("config", JSON.stringify({
      modelVersion: MODEL_VERSION,
      protocolId: protocol.id,
      interventionPlanId: interventionPlan.id,
      experiment: {
        schemaVersion: CONTRACT_VERSION,
        systemId: scenario.system.id,
        scenarioId: scenario.id,
        protocolId: protocol.id,
        interventionPlanId: interventionPlan.id,
        parameters: params,
        interventions: customScheduled,
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
         systemId: data.configuration.systemId,
         scenarioId: data.configuration.scenarioId,
         protocolId: data.configuration.protocolId,
        interventionPlanId: data.configuration.interventionPlanId,
        parameters: data.configuration.parameters,
        interventions: data.configuration.customInterventions ?? data.configuration.interventions,
      } : data);
      const parsed = experimentSpecSchema.safeParse(candidate);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid configuration schema");
      const importedSystemId = parsed.data.systemId ?? parsed.data.scenarioId;
      const selected = importedSystemId ? scenarioById[importedSystemId] : undefined;
      if (!selected) throw new Error("Unknown scenario id");
      const importedProtocolId = parsed.data.protocolId ?? data?.protocolId;
      const importedProtocol = selected.protocols.find((item) => item.id === importedProtocolId)
        ?? selected.protocols.find((item) => item.id === selected.defaultProtocolId)
        ?? selected.protocols[0];
      const validatedParameters = simulationParametersSchema.safeParse({ ...importedProtocol.parameters, ...parsed.data.parameters });
      if (!validatedParameters.success) throw new Error(validatedParameters.error.issues[0]?.message ?? "Parameter values are out of range");
      setScenarioId(importedSystemId!);
      setProtocolId(importedProtocol.id);
      setInterventionPlanId(interventionPlanById[parsed.data.interventionPlanId]?.id ?? "no-action");
      const imported = validatedParameters.data as SimulationParameters;
      setParams(imported);
      setCustomScheduled(parsed.data.interventions);
      setFrameIndex(0);
      setPlaying(false);
      announce("Configuration imported safely");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Could not import this file");
    }
  };

  const launchLessonProtocol = (index: number) => {
    const lesson = learnTopics[index];
    const protocol = lessonProtocols[index];
    setParams({ ...scenario.defaults, ...protocol.parameters });
    setInterventionPlanId("no-action");
    setCustomScheduled(protocol.interventions ?? []);
    setFrameIndex(0);
    setPlaying(false);
    setEmpiricalScenario(null);
    setMode(protocol.mode ?? "guided");
    setView(protocol.view ?? "home");
    track("lesson_protocol_loaded", { lesson: lesson.title, scenario: scenario.id });
    announce(`${lesson.title} protocol loaded — ${protocol.observation}`);
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
          <span>SYSTEM DOMAINS</span>
          {scenarioCategories.map((category) => (
            <button key={category} onClick={() => { setScenarioFilter(category); setView("scenarios"); setMobileNav(false); }}><span aria-hidden="true">{categoryIcons[category]}</span>{category}</button>
          ))}
        </div>
        <div className="lab-card"><strong>Toroidal Systems Lab</strong><span>Reproducible synthetic simulations for viability and alignment</span><div><small>{MODEL_VERSION}</small><small><i /> Online</small></div></div>
      </aside>
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu" aria-label={`${mobileNav ? "Close" : "Open"} primary navigation menu`} onClick={() => setMobileNav((v) => !v)} aria-expanded={mobileNav} aria-controls="primary-nav"><span aria-hidden="true">☰</span><span>Menu</span></button>
          <div className="laboratory-selectors">
            <label className="scenario-select"><span>System class</span><select aria-label="Select reusable system template" value={template.id} onChange={(event) => selectTemplate(event.target.value)}>{systemTemplates.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
            <label className="scenario-select"><span>Bounded system</span><select value={scenarioId} onChange={(event) => selectScenario(scenarioById[event.target.value])}>{scenarios.filter((item) => item.system.templateId === template.id).map((item) => <option value={item.id} key={item.id}>{item.system.shortTitle} · {item.watchlistTier}</option>)}</select></label>
          </div>
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
              template={template}
              protocol={protocol}
              interventionPlan={interventionPlan}
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
              applyInterventionPlan={applyInterventionPlan}
              scheduled={scheduled}
              mode={mode}
              restoreDefaults={restoreDefaults}
              applyProtocol={applyScenarioProtocol}
              loadSavedPreset={loadSavedPreset}
              setParams={setParams}
              selectScenario={selectScenario}
              shareRun={shareRun}
              exportConfiguration={exportConfiguration}
              importConfiguration={() => importRef.current?.click()}
            />
          )}
          {view === "scenarios" && <ScenarioLibrary filter={scenarioFilter} setFilter={setScenarioFilter} selectScenario={selectScenario} />}
          {view === "lab" && <SimulationLab scenario={scenario} protocol={protocol} interventionPlan={interventionPlan} params={params} updateParam={updateParam} scheduled={scheduled} frames={run.frames} summary={run.summary} exportConfiguration={exportConfiguration} importConfiguration={() => importRef.current?.click()} announce={announce} />}
          {view === "compare" && <CompareMode scenario={scenario} params={params} scheduled={scheduled} primaryFrames={run.frames} primarySummary={run.summary} />}
          {view === "experiments" && <ExperimentsWorkspace scenario={scenario} parameters={params} frames={run.frames} summary={run.summary} announce={announce} />}
          <div hidden={view !== "empirical"}>
            {clientReady && <EmpiricalLab
              key={`${(empiricalScenario ?? scenario).id}:${(empiricalScenario ?? scenario).version}`}
              scenario={empiricalScenario ?? scenario}
              announce={announce}
              onRegisterEvidence={registerEvidence}
            />}
          </div>
          <div hidden={view !== "evidence"}>
            {clientReady && <EvidenceRegistry scenario={empiricalScenario ?? scenario} receipts={evidenceReceipts} onReceiptsChange={setEvidenceReceipts} announce={announce} />}
          </div>
          {view === "builder" && <SystemBuilder announce={announce} onOpenEmpirical={(draftScenario) => { setEmpiricalScenario(draftScenario); setView("empirical"); announce("Validated draft opened as a browser-local empirical study hypothesis"); }} />}
          {view === "learn" && <LearnSection launchProtocol={launchLessonProtocol} />}
          {view === "theory" && <TheorySection announce={announce} />}
        </main>
        <footer className="site-footer"><span>{view === "empirical" ? `Model ${MODEL_VERSION} · Browser-local observational replay; model attribution is not causal identification.` : view === "evidence" ? `Model ${MODEL_VERSION} · Compatible-receipt summaries are descriptive, not meta-analysis or empirical validation.` : `Model ${MODEL_VERSION} · Synthetic model behavior, not empirical validation.`}</span><button onClick={() => setHighContrast((v) => !v)} aria-pressed={highContrast}>◐ High contrast</button><a href="/api/v1/model">Agent API</a><a href="/llms.txt">llms.txt</a><a href="/paper.pdf" download>Download paper</a></footer>
      </div>
      <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importConfiguration(file); event.target.value = ""; }} />
      <div className="sr-status" aria-live="polite">{toast}</div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

type SimulatorProps = {
  scenario: ScenarioDefinition;
  template: SystemTemplateDefinition;
  protocol: ScenarioProtocolDefinition;
  interventionPlan: InterventionPlanDefinition;
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
  applyIntervention: (item: InterventionDefinition) => void;
  applyInterventionPlan: (planId: string) => void;
  scheduled: ScheduledIntervention[];
  mode: Mode;
  restoreDefaults: () => void;
  applyProtocol: (protocolId: string) => void;
  loadSavedPreset: () => void;
  setParams: (value: SimulationParameters | ((current: SimulationParameters) => SimulationParameters)) => void;
  selectScenario: (scenario: ScenarioDefinition) => void;
  shareRun: () => void;
  exportConfiguration: () => void;
  importConfiguration: () => void;
};

function SimulatorView(props: SimulatorProps) {
  const { scenario, template, protocol, interventionPlan, params, frames, summary, frameIndex, setFrameIndex, playing, scheduled, mode } = props;
  const [externalPhaseView, setExternalPhaseView] = useState<"latent" | "estimated">("latent");
  const [timeSeriesView, setTimeSeriesView] = useState<"causal" | "projection">("causal");
  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const phaseReady = phaseAnalysisAvailable(frameIndex, frames.length);
  const estimatedPhaseAvailable = phaseReady && summary.phase.identifiable;
  const effectivePhaseView = externalPhaseView === "estimated" && estimatedPhaseAvailable ? "estimated" : "latent";
  const displayStatus = viabilityStatusLabel(frame);
  const statusTone = statusToneFor(displayStatus);
  const activeParameters = useMemo(
    () => [...scheduled]
      .sort((left, right) => left.step - right.step)
      .filter((event) => event.step <= frame.step)
      .reduce((current, event) => ({ ...current, ...event.effects }), { ...params }),
    [frame.step, params, scheduled],
  );
  const currentWatchlist = useMemo(
    () => assessWatchlistConfiguration(params),
    [params],
  );
  const runAssessment = useMemo(
    () => assessRun({ scenario, template, protocol, interventionPlan, frames, summary, frameIndex, configuredParameters: params, activeParameters, interventions: scheduled, educationalWatchlist: currentWatchlist }),
    [activeParameters, currentWatchlist, frameIndex, frames, interventionPlan, params, protocol, scenario, scheduled, summary, template],
  );
  const explanation = runAssessment.explanation;
  const torusGeometry = useMemo(
    () => deriveTorusGeometry(frames, frameIndex, activeParameters),
    [activeParameters, frameIndex, frames],
  );
  const baselineAssessment = useMemo(
    () => assessWatchlistConfiguration(scenario.defaults),
    [scenario.defaults],
  );
  const currentAssessment = currentWatchlist;
  const parameterEducation = useMemo(
    () => parameterEducationFor(scenario, params),
    [params, scenario],
  );
  const metricRows = [
    ["Toy alignment proxy A=e⁻ρ", frame.alignment, 1, "green"],
    ["Radial excursion", frame.rho, params.rhoCrit, "cyan"],
    ["Debt level", frame.debt, 2, "orange"],
    ["Correction margin", frame.correctionMargin, 1, frame.correctionMargin >= 0 ? "green" : "red"],
  ] as const;
  return (
    <div className="dashboard-view">
      <section className="scenario-title-row">
        <div><div className="eyebrow"><span>{scenario.category}</span><span className={`tier-${scenario.watchlistTier}`}>{tierLabels[scenario.watchlistTier]}</span>{scenario.featured && <span>Featured system</span>}<span>{template.title}</span><span>System v{scenario.version}</span><span>{scenario.evidence.status}</span></div><h1>{scenario.system.title}</h1><p><strong>Scenario:</strong> {protocol.title}. <strong>Intervention plan:</strong> {interventionPlan.title}.</p></div>
        <div className="scenario-facts"><span><small>Accountable operator</small>{scenario.system.operator}</span><span><small>Current seed</small>{params.seed}</span><span><small>Present-state outlook / live status</small>{scenario.watchlistTier.toUpperCase()} / {displayStatus}</span></div>
      </section>
      <SystemDefinitionPanel scenario={scenario} template={template} protocol={protocol} interventionPlan={interventionPlan} />
      <div className="dashboard-grid">
        <Panel className="torus-panel" title="Alignment Maintenance Torus" subtitle={`Eqs. 4–6 synthetic embedding · ${scenario.cycles.minor.label} × ${scenario.cycles.major.label}`} action={<span className="panel-chip">Synthetic 3D embedding</span>}>
          <TorusCanvas cycles={scenario.cycles} frames={frames} frameIndex={frameIndex} params={activeParameters} playing={playing} onSelectFrame={(index) => { setFrameIndex(index); props.setPlaying(false); }} />
        </Panel>
        <Panel className="parameter-panel" title="System Parameters" subtitle={mode === "guided" ? "Plain-language controls for the selected protocol" : "Canonical ATS/AANA/AIx variables"} action={<button className="text-button" onClick={props.restoreDefaults}>Reset protocol</button>}>
          <div className="composition-controls">
            <label><span>Scenario module</span><select aria-label="Select scenario protocol" value={protocol.id} onChange={(event) => props.applyProtocol(event.target.value)}>{scenario.protocols.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><small>{protocol.kind.replace("-", " ")} · {protocol.learningObjective}</small></label>
            <label><span>Intervention plan</span><select aria-label="Select intervention plan" value={interventionPlan.id} onChange={(event) => props.applyInterventionPlan(event.target.value)}>{interventionPlans.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><small>{interventionPlan.strategy} · {interventionPlan.learningObjective}</small></label>
          </div>
          <div className="parameter-list">
            {visibleParameters.map((key) => <ParameterControl key={key} label={scenario.labels[key]} value={params[key]} meta={parameterMeta[key]} locked={props.locked.includes(key)} onLock={() => props.toggleLock(key)} onChange={(value) => props.updateParam(key, value)} />)}
          </div>
          {mode === "research" && <details className="advanced-params" open><summary>Advanced dynamics</summary><div className="advanced-grid">
            <NumberField label="κ restoration" value={params.kappa} min={PARAMETER_LIMITS.kappa.min} max={PARAMETER_LIMITS.kappa.max} step={.01} onChange={(value) => props.updateParam("kappa", value)} />
            <NumberField label="χ debt pressure" value={params.chi} min={PARAMETER_LIMITS.chi.min} max={PARAMETER_LIMITS.chi.max} step={.01} onChange={(value) => props.updateParam("chi", value)} />
            <NumberField label="ωθ local frequency" value={params.omegaTheta} min={PARAMETER_LIMITS.omegaTheta.min} max={PARAMETER_LIMITS.omegaTheta.max} step={.005} onChange={(value) => props.updateParam("omegaTheta", value)} />
            <NumberField label="ωφ external frequency" value={params.omegaPhi} min={PARAMETER_LIMITS.omegaPhi.min} max={PARAMETER_LIMITS.omegaPhi.max} step={.005} onChange={(value) => props.updateParam("omegaPhi", value)} />
            <NumberField label="α debt accumulation" value={params.alpha} min={PARAMETER_LIMITS.alpha.min} max={PARAMETER_LIMITS.alpha.max} step={.01} onChange={(value) => props.updateParam("alpha", value)} />
            <NumberField label="β debt repayment" value={params.beta} min={PARAMETER_LIMITS.beta.min} max={PARAMETER_LIMITS.beta.max} step={.01} onChange={(value) => props.updateParam("beta", value)} />
            <NumberField label="a φ→θ phase coupling" value={params.couplingA} min={PARAMETER_LIMITS.couplingA.min} max={PARAMETER_LIMITS.couplingA.max} step={.01} onChange={(value) => props.updateParam("couplingA", value)} />
            <NumberField label="b θ→φ phase coupling" value={params.couplingB} min={PARAMETER_LIMITS.couplingB.min} max={PARAMETER_LIMITS.couplingB.max} step={.01} onChange={(value) => props.updateParam("couplingB", value)} />
            <NumberField label="ρ₀ reference" value={params.rho0} min={PARAMETER_LIMITS.rho0.min} max={Math.min(PARAMETER_LIMITS.rho0.max, params.rhoCrit - .001)} step={.05} onChange={(value) => props.updateParam("rho0", value)} />
            <NumberField label="ρcrit threshold" value={params.rhoCrit} min={Math.max(PARAMETER_LIMITS.rhoCrit.min, params.rho0 + .001)} max={PARAMETER_LIMITS.rhoCrit.max} step={.05} onChange={(value) => props.updateParam("rhoCrit", value)} />
          </div></details>}
        </Panel>
        <div className="status-column">
          <Panel className="status-panel" title="System Status" subtitle={`Eq. 11 state + illustrative UI thresholds · t = ${frame.time.toFixed(1)} · step ${frame.step}`} action={<span className="panel-chip">Illustrative classifier</span>}>
            <div className={`status-banner ${statusTone}`}><span className="status-orb" aria-hidden="true" /><div><strong>{displayStatus.toUpperCase()}</strong><small>{statusMessage(frame)}</small></div><span className="shield" aria-hidden="true">◇</span></div>
            <div className="viability-progression" aria-label={`Rupture-state progression: ${frame.viabilityState}`}>
              <span className={frame.viabilityState === "Viability-boundary crossing" ? "active" : summary.boundaryCrossingStep !== undefined ? "complete" : ""}><b>1</b><small>Boundary crossing</small></span>
              <span className={frame.viabilityState === "Recoverable excursion" ? "active" : summary.boundaryCrossingStep !== undefined ? "complete" : ""}><b>2</b><small>Recoverable excursion</small></span>
              <span className={frame.viabilityState === "Irreversible rupture" ? "active terminal" : ""}><b>3</b><small>Irreversible rupture</small></span>
            </div>
            <div className="metric-list">{metricRows.map(([label, value, max, tone]) => <Metric key={label} label={label} value={value} max={max} tone={tone} />)}</div>
            <div className="status-mini-grid"><span><small>Instantaneous margin C−D</small>{signed(frame.correctionMargin)}</span><span><small>Debt-adjusted margin C−D−χΔ</small>{signed(frame.debtAdjustedMargin)}</span><span><small>Full radial velocity dρ/dt</small>{signed(frame.radialVelocity)}</span><span><small>Cumulative irreversible loss</small>{frame.cumulativeIrreversibleLoss.toFixed(3)}</span><span><small>Minor phase (simulated)</small>{phaseName(frame.theta, scenario.cycles.minor.stages)}</span><span><small>Offline major phase estimate</small>{phaseReady ? frame.phaseIdentifiable && frame.estimatedPhi !== undefined ? phaseName(frame.estimatedPhi, scenario.cycles.major.stages) : "Not identifiable" : "Available after full run"}</span></div>
            <details className="aix-drawer"><summary>Full ATS 4.0 AIx & AANA gate · {summary.aix.score.toFixed(1)}</summary><AixPanel assessment={summary.aix} scenario={scenario} compact /></details>
          </Panel>
          <Panel className="intervention-panel" title="Intervention modules" subtitle={`${interventionPlan.title} · add a manual module while the run is active`}>
            <div className="intervention-grid">{interventionDefinitions.map((item) => <button key={item.id} className={item.id === "pause-optimization" ? "wide warning" : ""} onClick={() => props.applyIntervention(item)} title={item.domainTranslations[scenario.category]}><span aria-hidden="true">{item.icon}</span><strong>{item.shortTitle}</strong><small>{item.mechanism.replaceAll("-", " ")} · cost {(item.cost.base + item.cost.perIntensity).toFixed(1)}</small></button>)}</div>
            <details className="intervention-definition"><summary>Why these actions mean something in this system</summary>{interventionDefinitions.map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.domainTranslations[scenario.category]}</p><small>{item.timing.decay === "persistent" ? "Persistent parameter change" : `Temporary for ${item.timing.defaultDurationSteps} steps`} · {item.tradeoffs[0]}</small></article>)}</details>
            {scheduled.length > 0 && <div className="intervention-log"><strong>Resolved run schedule</strong>{scheduled.slice(-5).map((event) => <span key={event.id}><i />t {(event.step * params.dt).toFixed(1)} · {event.label} · {event.definitionId ?? "custom"} · cost {event.cost}</span>)}</div>}
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
        <Panel title="Unwrapped Torus" subtitle="Paper §12 · x=θ local correction · y=φ external adaptation" action={<ChartModeSwitch label="External phase source" options={[{ value: "latent", label: "Latent φ" }, { value: "estimated", label: "Estimated φ", disabled: !estimatedPhaseAvailable, title: estimatedPhaseAvailable ? "Use the offline estimated phase" : "Available only after a complete run when φ is identifiable" }]} value={effectivePhaseView} onChange={(value) => setExternalPhaseView(value as "latent" | "estimated")} />}><UnwrappedChart frames={frames} frameIndex={frameIndex} params={params} phaseView={effectivePhaseView} onSelect={(index) => { props.setPlaying(false); setFrameIndex(index); }} /></Panel>
        <Panel className="wide-chart" title="Toy Alignment Proxy & Debt Over Time" subtitle="Paper §14 proxy A=e⁻ρ · debt Δ · excursion ρ" action={<ChartModeSwitch label="Time-series disclosure" options={[{ value: "causal", label: "Causal" }, { value: "projection", label: "Projection" }]} value={timeSeriesView} onChange={(value) => setTimeSeriesView(value as "causal" | "projection")} />}><TimeSeriesChart frames={frames} frameIndex={frameIndex} params={params} revealFuture={timeSeriesView === "projection"} onSelect={(index) => { props.setPlaying(false); setFrameIndex(index); }} /></Panel>
        <Panel title="Radial Stability" subtitle="Eq. 11 / Fig. 4 slice · current χΔ held fixed"><RadialStabilityChart frames={frames} frameIndex={frameIndex} params={params} /></Panel>
      </section>

      <RunInsight
        explanation={explanation}
        frame={frame}
        geometry={torusGeometry}
        actions={<>
          <button onClick={props.shareRun}>⌘ Copy share link</button>
          <button onClick={props.exportConfiguration}>⇩ Config JSON</button>
          <button onClick={() => downloadJson(`${scenario.id}-summary.json`, { schemaVersion: CONTRACT_VERSION, exportedAt: new Date().toISOString(), modelVersion: MODEL_VERSION, scenarioVersion: scenario.version, seed: params.seed, evidence: scenario.evidence, summary })}>⇩ Summary JSON</button>
          <button onClick={() => exportCanvas(".torus-panel canvas", `${scenario.id}-torus.png`)}>◉ Torus PNG</button>
          <button onClick={() => exportCanvas(".chart-grid canvas", `${scenario.id}-chart.png`)}>▥ Chart PNG</button>
          <button onClick={() => exportChartSvg(frames, params, `${scenario.id}-timeseries.svg`)}>◇ Chart SVG</button>
          <button onClick={props.importConfiguration}>⇧ Import</button>
          <button onClick={props.loadSavedPreset}>♡ Load saved</button>
        </>}
      />

      <WatchlistReceipt
        scenario={scenario}
        protocol={protocol}
        baseline={baselineAssessment}
        current={currentAssessment}
        parameters={params}
        liveStatus={displayStatus}
      />

      <ParameterTranslation
        scenario={scenario}
        primary={parameterEducation.primary}
        advanced={parameterEducation.advanced}
      />

      <details className="scenario-evidence"><summary>Scenario map, AIx labels, evidence, and limitations</summary><div><p><strong>{scenario.evidence.status} · {scenario.evidence.calibrationStatus}</strong> {scenario.evidence.parameterUnits}</p><div className="scenario-map-grid"><section><h3>Canonical parameter map</h3><dl>{[["π", scenario.labels.pressure], ["ε", scenario.labels.error], ["γ", scenario.labels.feedback], ["C", scenario.labels.correction], ["Φ", scenario.labels.drift], ["Δ", scenario.labels.initialDebt], ["Λ", scenario.labels.irreversibleLoss], ["κ", scenario.labels.restoration], ["χ", scenario.labels.debtCoupling], ["ρ", scenario.labels.radialExcursion]].map(([symbol, meaning]) => <div key={symbol}><dt>{symbol}</dt><dd>{meaning}</dd></div>)}</dl></section><section><h3>Scenario-specific AIx layers</h3><dl>{[["P", scenario.aixLabels.physical], ["B", scenario.aixLabels.biological], ["Cƒ", scenario.aixLabels.constructed], ["F", scenario.aixLabels.feedback]].map(([symbol, meaning]) => <div key={symbol}><dt>{symbol}</dt><dd>{meaning}</dd></div>)}</dl><h3>Illustrative events</h3><ul>{scenario.events.map((item) => <li key={item}>{item}</li>)}</ul><h3>Available intervention meanings</h3><ul>{scenario.interventions.map((item) => <li key={item}>{item}</li>)}</ul></section></div><h3>Assumptions</h3><ul>{scenario.evidence.assumptions.map((item) => <li key={item}>{item}</li>)}</ul><h3>What would challenge this mapping</h3><ul>{scenario.evidence.falsificationCriteria.map((item) => <li key={item}>{item}</li>)}</ul><p>{scenario.evidence.references.map((reference, index) => <span key={reference.title}>{index ? " · " : ""}{reference.url ? <a href={reference.url}>{reference.title}</a> : reference.title}</span>)}</p></div></details>

      <section className="scenario-strip"><div className="section-heading"><div><h2>Featured bounded systems</h2><p>Editorial highlights from the 32-system educational catalog</p></div><button onClick={() => document.querySelector<HTMLElement>(".sidebar nav button:nth-child(2)")?.click()}>View all systems →</button></div><div className="scenario-cards">{compactScenarios.map((item) => <ScenarioCard key={item.id} scenario={item} active={item.id === scenario.id} onClick={() => props.selectScenario(item)} compact />)}</div></section>

      <details className="data-table-fallback"><summary>Accessible data table for the current run</summary><div className="table-wrap"><table><caption>Latest simulation frames, linked to the charts above</caption><thead><tr><th>Step</th><th>Time</th><th>Toy proxy A=e⁻ρ</th><th>Excursion</th><th>Debt</th><th>C−D</th><th>C−D−χΔ</th><th>dρ/dt</th><th>Viability state</th><th>Phase regime</th></tr></thead><tbody>{frames.slice(Math.max(0, frameIndex - 12), frameIndex + 1).map((item) => <tr key={item.step}><td>{item.step}</td><td>{item.time.toFixed(2)}</td><td>{item.alignment.toFixed(3)}</td><td>{item.rho.toFixed(3)}</td><td>{item.debt.toFixed(3)}</td><td>{item.correctionMargin.toFixed(3)}</td><td>{item.debtAdjustedMargin.toFixed(3)}</td><td>{item.radialVelocity.toFixed(3)}</td><td>{item.viabilityState}</td><td>{item.phaseRegime}</td></tr>)}</tbody></table></div></details>
    </div>
  );
}

function WatchlistReceipt({ scenario, protocol, baseline, current, parameters, liveStatus }: {
  scenario: ScenarioDefinition;
  protocol: ScenarioProtocolDefinition;
  baseline: WatchlistAssessment;
  current: WatchlistAssessment;
  parameters: SimulationParameters;
  liveStatus: string;
}) {
  const changes = visibleParameters
    .filter((key) => Math.abs(parameters[key] - scenario.defaults[key]) > 0.000001)
    .map((key) => {
      const before = scenario.defaults[key];
      const after = parameters[key];
      const lowerIsBetter = key === "pressure" || key === "error" || key === "initialDebt" || key === "drift" || key === "irreversibleLoss";
      const improvesMargin = lowerIsBetter ? after < before : after > before;
      return {
        key,
        label: scenario.labels[key],
        symbol: parameterMeta[key].symbol,
        before,
        after,
        direction: improvesMargin ? "improves modeled resilience" : "reduces modeled resilience",
      };
    });
  const baselineProtocols = [
    baseline.protocols.baseline,
    baseline.protocols["mild-stress"],
    baseline.protocols["compound-stress"],
    baseline.protocols["timely-action"],
  ];
  const publishedRiskTier = scenario.watchlistTier;
  const baselineMatchesPublication = publishedRiskTier === baseline.tier;
  const estimate = scenario.currentStateEstimate;

  return (
    <section className="watchlist-receipt" aria-labelledby="watchlist-receipt-title">
      <header className="receipt-heading">
        <div>
          <span className="receipt-kicker">Present-state outlook · standardized four-seed synthetic protocol</span>
          <h2 id="watchlist-receipt-title">Why this system has this watchlist outlook</h2>
          <p>The watchlist outlook is the red, orange, or yellow label shown beside the system name. It summarizes the default present-state hypothesis across a common future stress suite; the live System Status changes frame by frame during playback.</p>
        </div>
        <span className={`receipt-verdict ${baselineMatchesPublication ? "verified" : "mismatch"}`}>
          {baselineMatchesPublication ? "Protocol reproduced" : "Needs recalibration"}
        </span>
      </header>

      <div className="classification-chain" aria-label="Published educational, assessed protocol, current protocol, and illustrative live classifications">
        <ClassificationStep label="Default present-state outlook" value={`${scenario.watchlistTier} watchlist`} tier={publishedRiskTier} />
        <span aria-hidden="true">→</span>
        <ClassificationStep label="Derived default ensemble" value={`${baseline.tier} tier`} tier={baseline.tier} />
        <span aria-hidden="true">→</span>
        <ClassificationStep label="Current slider outlook" value={`${current.tier} tier`} tier={current.tier} changed={current.tier !== baseline.tier} />
        <span aria-hidden="true">↔</span>
        <ClassificationStep label="Live frame status" value={liveStatus} />
      </div>

      {estimate && <section className="current-state-basis" aria-label="Default present-state estimate basis">
        <div><small>Estimate date</small><strong>{estimate.asOfDate}</strong></div>
        <div><small>Basis</small><strong>Illustrative current-state hypothesis</strong></div>
        <div><small>Observation window</small><strong>{estimate.observationWindow}</strong></div>
        <div><small>Candidate observation cadence</small><strong>{estimate.observationCadence}</strong></div>
        <div><small>Candidate time anchor</small><strong>{estimate.candidateTimeAnchor}</strong></div>
        <div><small>Review cadence</small><strong>{estimate.reviewCadence}</strong></div>
        <details><summary>What this date and time basis do—and do not—mean</summary><ul>{estimate.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details>
      </section>}

      <div className="receipt-body">
        <article className="receipt-reasons">
          <h3>Why the default protocol evaluates {baseline.tier}</h3>
          <ol>{baseline.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ol>
          <div className="balance-equation">
            <span><small>Pressure term π·ε·(1−γ)</small>{baseline.causalBalance.optimizationPressure.toFixed(3)}</span>
            <b>+</b><span><small>Drift Φ</small>{baseline.causalBalance.drift.toFixed(3)}</span>
            <b>+</b><span><small>Loss Λ</small>{baseline.causalBalance.irreversibleLoss.toFixed(3)}</span>
            <b>+</b><span><small>Debt χΔ₀</small>{baseline.causalBalance.initialDebtPressure.toFixed(3)}</span>
            <b>−</b><span><small>Correction C</small>{baseline.causalBalance.correction.toFixed(3)}</span>
            <b>=</b><span className={baseline.causalBalance.initialDebtAdjustedMargin <= 0 ? "adverse" : "favorable"}><small>Initial resilience margin</small>{signed(baseline.causalBalance.initialDebtAdjustedMargin)}</span>
          </div>
        </article>

        <article className="protocol-receipt">
          <h3>Default present-state outlook receipt</h3>
          <div className="protocol-table" role="table" aria-label="Default watchlist protocol results">
            <div className="protocol-row header" role="row"><span>Protocol</span><span>Boundary</span><span>Terminal</span><span>Stable</span><span title="Warning or Fragile time">W/F time</span></div>
            {baselineProtocols.map((protocol) => <div className="protocol-row" role="row" key={protocol.id} title={protocol.description}><span>{protocol.label}</span><span>{formatPercent(protocol.boundaryCrossingRate)}</span><span>{formatPercent(protocol.terminalRate)}</span><span>{formatPercent(protocol.meanStableFraction)}</span><span>{formatPercent(protocol.meanWarningOrFragileFraction)}</span></div>)}
          </div>
          <p>The watchlist outlook classifies the bounded system&apos;s default present-state protocol, “{scenario.protocols.find((item) => item.id === scenario.defaultProtocolId)?.title}.” The selected run protocol is “{protocol.title}.” Red means ordinary baseline failure; Orange includes sustained Warning/Fragile operation or material stress sensitivity without baseline rupture; Yellow means recoverable operation across this common synthetic stress suite. This is an illustrative product rule, not a paper threshold.</p>
        </article>

        <article className="current-change-receipt">
          <h3>What the sliders changed</h3>
          {changes.length ? <>
            <ul>{changes.slice(0, 5).map((change) => <li key={change.key}><span><b>{change.symbol}</b>{change.label}</span><strong>{change.before.toFixed(2)} → {change.after.toFixed(2)}</strong><small>{change.direction}</small></li>)}</ul>
            {changes.length > 5 && <p>Plus {changes.length - 5} additional changed parameters.</p>}
          </> : <p className="defaults-loaded">Default parameters are loaded, so the current slider tier should reproduce the default protocol result.</p>}
          <div className={`current-tier-summary tier-${current.tier}`}><span>Current protocol tier</span><strong>{current.tier.toUpperCase()}</strong><small>{current.reasons[0]}</small></div>
        </article>
      </div>

      <footer className="receipt-caveat"><strong>Educational interpretation.</strong> The default is a dated, low-confidence hypothesis about a representative present-day system—not an empirical forecast of a named operator. If the theory and mapping were validated, the direction of change identifies candidate real-world levers; it does not establish their actual size, feasibility, or safety.</footer>
    </section>
  );
}

function ClassificationStep({ label, value, tier, changed = false }: { label: string; value: string; tier?: SimulatedWatchlistTier; changed?: boolean }) {
  return <span className={`classification-step ${tier ? `tier-${tier}` : ""} ${changed ? "changed" : ""}`}><small>{label}</small><strong>{value}</strong></span>;
}

function ParameterTranslation({ scenario, primary, advanced }: { scenario: ScenarioDefinition; primary: ParameterEducation[]; advanced: ParameterEducation[] }) {
  return (
    <section className="parameter-translation" aria-labelledby="parameter-translation-title">
      <header>
        <div><span className="receipt-kicker">Equation → scenario proxy → candidate lever</span><h2 id="parameter-translation-title">What each parameter means in this system</h2></div>
        <code>dρ/dt = −κ(ρ−ρ₀) + [π·ε·(1−γ)+Φ+Λ] − C + χΔ</code>
      </header>
      <p className="translation-intro">For <strong>{scenario.shortTitle}</strong>, each slider is a transparent scenario proxy. {scenario.currentStateEstimate ? <>The loaded value belongs to the provisional estimate dated <strong>{scenario.currentStateEstimate.asOfDate}</strong>; every model parameter may change when the system or evidence window changes. </> : null}The “predicted effect” is conditional: it says what this model changes if the paper’s theory and this domain mapping are correct.</p>
      <div className="translation-grid">{primary.map((item) => <ParameterTranslationCard key={item.key} item={item} />)}</div>
      <details className="advanced-translation"><summary>Show every advanced dynamic and run-control parameter ({advanced.length})</summary><div className="translation-grid advanced">{advanced.map((item) => <ParameterTranslationCard key={item.key} item={item} />)}</div></details>
    </section>
  );
}

function ParameterTranslationCard({ item }: { item: ParameterEducation }) {
  return <article className="translation-card"><header><span>{item.symbol}</span><div><small>Real-world equivalent</small><h3>{item.realWorldEquivalent}</h3></div></header>{item.observationProxy ? <p className="observation-proxy"><strong>Candidate observable.</strong> {item.observationProxy} {item.proxyNormalization}<small>Proposed update: {item.updateCadence}</small></p> : null}<p><strong>Equation role.</strong> {item.modelRole}</p><p><strong>Illustrative scale.</strong> {item.scale}</p><p className="predicted-effect"><strong>If the mapping holds.</strong> {item.predictedEffect}</p></article>;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function RunInsight({ explanation, frame, geometry, actions }: { explanation: SimulationExplanation; frame: SimulationFrame; geometry: TorusGeometryState; actions: React.ReactNode }) {
  return (
    <section className={`run-insight tone-${explanation.tone}`} aria-labelledby="run-insight-title">
      <header className="insight-heading">
        <span className="insight-icon" aria-hidden="true">◎</span>
        <div>
          <span className="insight-eyebrow">Five-source model attribution · illustrative live status · t={frame.time.toFixed(1)} · step {frame.step}</span>
          <h2 id="run-insight-title">Why this run looks this way</h2>
          <p>{explanation.classification}</p>
        </div>
        <span className={`insight-status tone-${explanation.tone}`}>{explanation.statusLabel}</span>
      </header>

      <div className="insight-source-grid" aria-label="Five modeled sources of the current run status">
        {explanation.sources.map((source, index) => (
          <article className={`insight-source-card tone-${source.tone}`} key={source.id}>
            <header><span>{String(index + 1).padStart(2, "0")}</span><strong>{source.title}</strong></header>
            <b>{source.state}</b>
            <p>{source.summary}</p>
            <small>{source.detail}</small>
          </article>
        ))}
      </div>

      <section className={`insight-geometry tone-${geometry.tone}`} aria-labelledby="insight-geometry-title">
        <header>
          <div><span>Model-linked visual encoding</span><h3 id="insight-geometry-title">Why the torus has this shape</h3></div>
          <b>{geometry.regimeLabel}</b>
        </header>
        <p>{geometry.summary}</p>
        <dl>
          <div><dt>Excursion ρ</dt><dd>{(geometry.excursionRatio * 100).toFixed(1)}% of ρcrit</dd><small>Offsets the trajectory from the desired orbit.</small></div>
          <div><dt>Debt deformation χΔ</dt><dd>{geometry.debtPressure.toFixed(3)} · {geometry.debtDirection}</dd><small>Asymmetric warp can relax only when debt is repaid.</small></div>
          <div><dt>Irreversible scar ΣΛ</dt><dd>{geometry.cumulativeLoss.toFixed(3)}</dd><small>Persists within the run even if current pressure falls.</small></div>
          <div><dt>Recurrence integrity</dt><dd>{geometry.recurrenceLabel}</dd><small>{geometry.regime === "collapse" ? "The terminal latch removes the coherent torus." : "The recurrent tube remains present, though it may be thin or strained."}</small></div>
        </dl>
        <footer>The equations determine the simulated state and history; this geometry is a transparent educational encoding, not a unique 3D deformation law derived by the paper.</footer>
      </section>

      <p className="insight-attribution-boundary"><strong>Interpretation boundary</strong>{explanation.attributionBoundary}</p>

      <div className="insight-grid">
        <article className="insight-card insight-balance-card">
          <header><span>A</span><strong>Active equation balance</strong></header>
          <p>{explanation.balanceSummary}</p>
          <dl className="insight-balance-grid">
            {explanation.balance.map((item) => <div className={`tone-${item.tone}`} key={item.symbol}><dt>{item.symbol}<small>{item.label}</small></dt><dd>{signed(item.value)}</dd></div>)}
          </dl>
        </article>

        <article className={`insight-card insight-trajectory-card tone-${explanation.trajectory.tone}`}>
          <header><span>B</span><strong>Direction of travel</strong></header>
          <b>{explanation.trajectory.label}</b>
          <p>{explanation.trajectory.detail}</p>
          <div className={`neutral-correction-gap direction-${explanation.trajectory.radialDirection.toLowerCase()}`}>
            <header><span aria-hidden="true">{explanation.trajectory.radialDirection === "Expansion" ? "↗" : explanation.trajectory.radialDirection === "Contraction" ? "↘" : "↔"}</span><strong>Radial {explanation.trajectory.radialDirection}</strong></header>
            <dl><div><dt>Neutral C*</dt><dd>{explanation.trajectory.neutralCorrection.toFixed(3)}</dd></div><div><dt>Gap C*−C</dt><dd>{signed(explanation.trajectory.neutralGap)}</dd></div></dl>
            <p>{explanation.trajectory.neutralDetail}</p>
            <small>C* = max(0, −κ(ρ−ρ₀) + D + χΔ) inside the synthetic radial equation.</small>
          </div>
        </article>

        <article className={`insight-card insight-threshold-card tone-${explanation.threshold.tone}`}>
          <header><span>C</span><strong>{explanation.threshold.label}</strong></header>
          <b>{explanation.threshold.value}</b>
          <p>{explanation.threshold.detail}</p>
        </article>

        <article className="insight-card insight-history-card">
          <header><span>D</span><strong>How the run got here</strong></header>
          <ul>{explanation.history.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </div>

      <div className="insight-parameter-strip">
        <strong>Active controls</strong>
        <div>{explanation.activeControls.map((control) => <span key={control.symbol} title={control.label}><i>{control.symbol}</i>{control.value.toFixed(3)}</span>)}</div>
      </div>

      <footer className="insight-footer">
        <p><strong>Run context</strong>{explanation.outcome}</p>
        <div className="insight-actions">{actions}</div>
      </footer>
    </section>
  );
}

function SystemDefinitionPanel({ scenario, template, protocol, interventionPlan }: { scenario: ScenarioDefinition; template: SystemTemplateDefinition; protocol: ScenarioProtocolDefinition; interventionPlan: InterventionPlanDefinition }) {
  const system = scenario.system;
  return <section className="system-definition-panel" aria-label="Reusable laboratory composition">
    <header><div><span>WHAT IS BEING SIMULATED</span><h2>A reusable system class, instantiated and tested</h2></div><div className="model-flow five" aria-label="System template leads to system instance, scenario protocol, intervention plan, and run assessment"><b>System template</b><i>→</i><b>System instance</b><i>→</i><b>Scenario</b><i>→</i><b>Intervention</b><i>→</i><b>Assessment</b></div></header>
    <div className="system-definition-grid">
      <article><small>REUSABLE SYSTEM CLASS</small><p><strong>{template.title}</strong> {template.stateArchetype}</p></article>
      <article><small>BOUNDARY</small><p>{system.boundary}</p></article>
      <article><small>OBJECTIVE</small><p>{system.objective}</p></article>
      <article><small>POPULATION & AGGREGATION</small><p>{system.population} {system.aggregation}</p></article>
      <article><small>TIME HORIZON</small><p>{system.horizon}</p></article>
      <article><small>SCENARIO MODULE</small><p><strong>{protocol.title}</strong> {protocol.summary}</p></article>
      <article><small>INTERVENTION PLAN</small><p><strong>{interventionPlan.title}</strong> {interventionPlan.summary}</p></article>
      <article><small>TORUS ELIGIBILITY · DECLARED</small><p><strong>Two distinct recurrent cycles required for catalog inclusion.</strong><br />θ: {system.cycles.minor.label}<br />φ: {system.cycles.major.label}</p></article>
    </div>
    <details><summary>Template assumptions, scenario transforms, intervention sequence, and phase evidence</summary><div className="system-detail-grid"><section><h3>Template assumptions</h3><ul>{template.structuralAssumptions.map((item) => <li key={item}>{item}</li>)}</ul><h3>Learning questions</h3><ul>{template.learningQuestions.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>Scenario conditions and stressors</h3><ul>{[...protocol.conditions, ...protocol.stressors].map((item) => <li key={item}>{item}</li>)}</ul><h3>Parameter rationale</h3><p>{protocol.parameterRationale}</p></section><section><h3>Intervention sequence</h3>{interventionPlan.items.length ? <ol>{interventionPlan.items.map((item) => <li key={`${item.interventionId}-${item.startFraction}`}><strong>{interventionDefinitionById[item.interventionId]?.title}</strong> at {Math.round(item.startFraction * 100)}% of the run · intensity {item.intensity}</li>)}</ol> : <p>No operator intervention is scheduled.</p>}<h3>Phase admissibility</h3><p>{system.phaseEvidence.thetaSource}</p><p>{system.phaseEvidence.phiSource}</p><p>{system.phaseEvidence.independenceClaim}</p></section></div></details>
  </section>;
}

function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><header className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>{children}</section>;
}

function ChartModeSwitch({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string; disabled?: boolean; title?: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return <div className="chart-mode-switch" role="group" aria-label={label}>{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} disabled={option.disabled} title={option.title} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
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
  const isTemplateFilter = systemTemplates.some((item) => item.id === filter);
  const filtered = filter === "All" ? scenarios : filter === "Featured" ? scenarios.filter((item) => item.featured) : isTemplateFilter ? scenarios.filter((item) => item.system.templateId === filter) : tierOrder.includes(filter as (typeof tierOrder)[number]) ? scenarios.filter((item) => item.watchlistTier === filter) : scenarios.filter((item) => item.category === filter);
  const filters = ["All", "Featured", ...tierOrder, ...scenarioCategories];
  return <div className="page-view"><section className="page-hero"><div className="eyebrow"><span>Educational systems laboratory</span><span>{systemTemplates.length} reusable classes</span><span>{scenarios.length} bounded instances</span><span>{featuredSystemCount} editorial highlights</span></div><h1>Learn the system class.<br /><em>Then compose the experiment.</em></h1><p>Templates teach reusable dynamics. Bounded instances supply an operator, boundary, population, horizon, aggregation rule, phases, and real-world variable meanings. Scenario and intervention modules can then be exchanged without redefining the system.</p></section><section className="template-library" aria-labelledby="template-library-title"><div className="section-heading"><div><h2 id="template-library-title">Reusable system templates</h2><p>Select a structural class to compare its bounded instances.</p></div><button onClick={() => setFilter("All")}>Show all systems</button></div><div className="template-grid">{systemTemplates.map((item) => <button key={item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}><span>{scenarios.filter((system) => system.system.templateId === item.id).length} systems</span><h3>{item.title}</h3><p>{item.summary}</p><small>{item.learningQuestions[0]}</small></button>)}</div></section><div className="filter-row" role="group" aria-label="Filter systems">{filters.map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item in tierLabels ? `${tierLabels[item as keyof typeof tierLabels]} · ${watchlistCounts[item as keyof typeof watchlistCounts]}` : item === "Featured" ? `Featured · ${featuredSystemCount}` : item}</button>)}</div><p className="filter-result" aria-live="polite">Showing {filtered.length} system{filtered.length === 1 ? "" : "s"}{isTemplateFilter ? ` in ${systemTemplateById[filter as keyof typeof systemTemplateById].title}` : ""}</p><div className="library-grid">{filtered.map((item) => <ScenarioCard key={item.id} scenario={item} onClick={() => selectScenario(item)} />)}</div></div>;
}

function ScenarioCard({ scenario, onClick, compact = false, active = false }: { scenario: ScenarioDefinition; onClick: () => void; compact?: boolean; active?: boolean }) {
  const defaultProtocol = scenario.protocols.find((item) => item.id === scenario.defaultProtocolId) ?? scenario.protocols[0];
  return <button className={`scenario-card ${compact ? "compact" : ""} ${active ? "active" : ""}`} onClick={onClick} style={{ "--scenario-accent": scenario.accent } as React.CSSProperties}><div className="scenario-art"><span>{scenario.icon}</span><i /><i /><i /></div><div className="scenario-card-body"><div><span className="category-pill">{scenario.category}</span><span>{systemTemplateById[scenario.system.templateId].title}</span><span className={`tier-label tier-${scenario.watchlistTier}`}>{scenario.watchlistTier} outlook</span>{scenario.featured && <span>Featured</span>}</div><h3>{scenario.system.shortTitle}</h3><p><strong>{defaultProtocol.title}.</strong> {defaultProtocol.summary}</p>{!compact && <dl><div><dt>Reusable class</dt><dd>{systemTemplateById[scenario.system.templateId].stateArchetype}</dd></div><div><dt>Operator</dt><dd>{scenario.system.operator}</dd></div><div><dt>Boundary</dt><dd>{scenario.system.boundary}</dd></div><div><dt>Population / rule</dt><dd>{scenario.system.population} {scenario.system.aggregation}</dd></div><div><dt>Minor cycle θ</dt><dd>{scenario.cycles.minor.label}</dd></div><div><dt>Major cycle φ</dt><dd>{scenario.cycles.major.label}</dd></div><div><dt>Present-state basis</dt><dd>{scenario.currentStateEstimate ? `${scenario.currentStateEstimate.asOfDate} · low-confidence illustrative hypothesis` : "Illustrative · not empirically calibrated"}</dd></div></dl>}<strong className="launch-link">Compose experiment <span>→</span></strong></div></button>;
}

const labAdvancedParameters: (keyof SimulationParameters)[] = ["kappa", "chi", "omegaTheta", "omegaPhi", "couplingA", "couplingB", "rho0", "rhoCrit", "alpha", "beta"];
const canonicalParameterLabels: Partial<Record<keyof SimulationParameters, string>> = {
  pressure: "π · optimization pressure", error: "ε · misclassification", feedback: "γ · feedback fidelity", correction: "C · correction capacity",
  drift: "Φ · viable-region drift", irreversibleLoss: "Λ · irreversible loss", initialDebt: "Δ₀ · initial debt", kappa: "κ · radial restoration",
  chi: "χ · debt coupling", omegaTheta: "ωθ · internal frequency", omegaPhi: "ωφ · external frequency", couplingA: "a · φ→θ coupling",
  couplingB: "b · θ→φ coupling", rho0: "ρ₀ · reference excursion", rhoCrit: "ρcrit · viability boundary", alpha: "α · debt accumulation", beta: "βrepay · debt repayment",
};

function SimulationLab({ scenario, protocol, interventionPlan, params, updateParam, scheduled, frames, summary, exportConfiguration, importConfiguration, announce }: { scenario: ScenarioDefinition; protocol: ScenarioProtocolDefinition; interventionPlan: InterventionPlanDefinition; params: SimulationParameters; updateParam: (key: keyof SimulationParameters, value: number) => void; scheduled: ScheduledIntervention[]; frames: SimulationFrame[]; summary: ReturnType<typeof simulate>["summary"]; exportConfiguration: () => void; importConfiguration: () => void; announce: (message: string) => void }) {
  const [batchSize, setBatchSize] = useState(12);
  const protocolKey = JSON.stringify({ scenario: scenario.id, params, scheduled });
  const [batchResult, setBatchResult] = useState<{ protocolKey: string; runs: ReturnType<typeof simulate>[] } | null>(null);
  const batch = batchResult?.protocolKey === protocolKey ? batchResult.runs : [];
  const runBatch = () => {
    const results = Array.from({ length: batchSize }, (_, index) => simulate(
      { ...params, seed: params.seed + index },
      scheduled,
      { rupturePolicy: scenario.rupturePolicy },
    ));
    setBatchResult({ protocolKey, runs: results });
    announce(`${batchSize}-seed ensemble completed with ${scheduled.length} scheduled intervention${scheduled.length === 1 ? "" : "s"}`);
  };
  const avgSummary = (key: "finalAlignment" | "finalDebt" | "maxRho" | "stableFraction") => batch.length ? batch.reduce((sum, item) => sum + item.summary[key], 0) / batch.length : 0;
  const avgOutside = batch.length ? batch.reduce((sum, item) => sum + outsideFraction(item.frames, params.rhoCrit), 0) / batch.length : 0;
  const currentOutside = outsideFraction(frames, params.rhoCrit);
  const terminalCount = batch.filter((item) => item.summary.irreversibleRuptureStep !== undefined).length;
  const boundaryCount = batch.filter((item) => item.summary.boundaryCrossingStep !== undefined).length;
  const warnedCount = batch.filter((item) => item.summary.firstWarningStep !== undefined).length;
  const recoveredCount = batch.filter((item) => item.summary.recovered).length;
  return <div className="page-view">
    <section className="page-hero compact"><div className="eyebrow"><span>Research mode</span><span>Model {MODEL_VERSION}</span><span>{systemTemplates.length} templates</span><span>{interventionDefinitions.length} intervention modules</span></div><h1>Simulation Laboratory</h1><p>Compose a reusable system class, bounded instance, scenario module, and intervention plan; then execute deterministic runs and inspect the resulting assessment.</p></section>
    <div className="lab-layout">
      <Panel title="Run configuration" subtitle={scenario.title}>
        <div className="form-grid">
          <NumberField label="Seed" value={params.seed} min={PARAMETER_LIMITS.seed.min} max={PARAMETER_LIMITS.seed.max} step={1} onChange={(value) => updateParam("seed", value)} />
          <NumberField label="Steps (≤10,000)" value={params.steps} min={PARAMETER_LIMITS.steps.min} max={PARAMETER_LIMITS.steps.max} step={100} onChange={(value) => updateParam("steps", value)} />
          <NumberField label="Integration step Δt" value={params.dt} min={PARAMETER_LIMITS.dt.min} max={PARAMETER_LIMITS.dt.max} step={.05} onChange={(value) => updateParam("dt", value)} />
          <NumberField label="Ensemble seeds" value={batchSize} min={2} max={100} step={1} onChange={(value) => setBatchSize(Math.max(2, Math.min(100, Math.round(value))))} />
        </div>
        <div className="lab-factor-grid" aria-label="Paper-aligned study factors">{visibleParameters.map((key) => <NumberField key={key} label={`${canonicalParameterLabels[key]} · ${scenario.labels[key]}`} value={params[key]} min={PARAMETER_LIMITS[key].min} max={PARAMETER_LIMITS[key].max} step={scenario.ranges[key].step} onChange={(value) => updateParam(key, value)} />)}</div>
        <details className="lab-advanced-controls"><summary>Research dynamics: restoration, phase, coupling, debt, and boundary controls</summary><div className="lab-factor-grid">{labAdvancedParameters.map((key) => <NumberField key={key} label={canonicalParameterLabels[key] ?? key} value={params[key]} min={PARAMETER_LIMITS[key].min} max={PARAMETER_LIMITS[key].max} step={.01} onChange={(value) => updateParam(key, value)} />)}</div></details>
        <div className="button-row"><button className="primary" onClick={runBatch}>Run batch</button><button onClick={exportConfiguration}>Export configuration</button><button onClick={importConfiguration}>Import configuration</button><button onClick={() => downloadCsv(`${scenario.id}-timeseries.csv`, frames)}>Export CSV</button></div>
        <p className="lab-protocol-note">Composition: {systemTemplateById[scenario.system.templateId].title} → {scenario.system.shortTitle} → {protocol.title} → {interventionPlan.title} · {batchSize} adjacent deterministic seeds · {scheduled.length} resolved event{scheduled.length === 1 ? "" : "s"} preserved in every run.</p>
      </Panel>
      <Panel title="Current run summary" subtitle={`Seed ${params.seed} · illustrative synthetic status`}>
        <div className="summary-cards"><SummaryStat label="Final viability" value={summary.finalStatus} /><SummaryStat label="Stable time" value={`${(summary.stableFraction * 100).toFixed(1)}%`} /><SummaryStat label="Time outside viable tube" value={`${(currentOutside * 100).toFixed(1)}%`} /><SummaryStat label="Max excursion ρ" value={summary.maxRho.toFixed(3)} /><SummaryStat label="Final debt Δ" value={summary.finalDebt.toFixed(3)} /><SummaryStat label="Final toy proxy A=e⁻ρ" value={summary.finalAlignment.toFixed(3)} /><SummaryStat label="Recovery outcome" value={summary.firstWarningStep === undefined ? "Not needed · no warning episode" : summary.recovered ? `Recovered in ${summary.recoveryTime?.toFixed(2) ?? "?"} time` : "Warning episode did not recover"} /><SummaryStat label="Winding ratio θ/φ" value={summary.windingRatio.toFixed(3)} /><SummaryStat label="Phase identifiability" value={summary.phase.identifiable ? `Identified · ${(summary.phase.spectralConcentration * 100).toFixed(0)}% spectral` : `Undefined · ${summary.phase.reason}`} /><SummaryStat label="First warning time" value={summary.firstWarningStep === undefined ? "None" : (summary.firstWarningStep * params.dt).toFixed(2)} /><SummaryStat label="Boundary crossing time" value={summary.boundaryCrossingStep === undefined ? "None" : (summary.boundaryCrossingStep * params.dt).toFixed(2)} /><SummaryStat label="Terminal rupture time" value={summary.irreversibleRuptureStep === undefined ? "None" : (summary.irreversibleRuptureStep * params.dt).toFixed(2)} /></div>
      </Panel>
      {batch.length > 0 && <Panel className="full-span" title="Ensemble result" subtitle={`${batch.length} deterministic seeds · observed fractions, not calibrated probabilities`}><div className="ensemble-strip"><SummaryStat label="Mean final toy proxy A" value={avgSummary("finalAlignment").toFixed(3)} /><SummaryStat label="Mean final debt" value={avgSummary("finalDebt").toFixed(3)} /><SummaryStat label="Mean max excursion" value={avgSummary("maxRho").toFixed(3)} /><SummaryStat label="Mean stable time" value={`${(avgSummary("stableFraction") * 100).toFixed(1)}%`} /><SummaryStat label="Mean time outside tube" value={`${(avgOutside * 100).toFixed(1)}%`} /><SummaryStat label="Boundary-crossing seed fraction" value={`${boundaryCount}/${batch.length} · ${(boundaryCount / batch.length * 100).toFixed(1)}%`} /><SummaryStat label="Terminal-rupture seed fraction" value={`${terminalCount}/${batch.length} · ${(terminalCount / batch.length * 100).toFixed(1)}%`} /><SummaryStat label="Recovery among warned seeds" value={warnedCount ? `${recoveredCount}/${warnedCount}` : "No warning episodes"} /></div></Panel>}
      <Panel className="full-span" title="Reusable laboratory modules" subtitle="These modules are the educational product; published systems are worked instances"><div className="module-registry-grid"><section><h3>System templates</h3>{systemTemplates.map((item) => <article key={item.id}><strong>{item.title}</strong><small>{item.summary}</small></article>)}</section><section><h3>Scenario modules</h3>{scenario.protocols.map((item) => <article key={item.id}><strong>{item.title}</strong><small>{item.kind} · {item.learningObjective}</small></article>)}</section><section><h3>Intervention plans</h3>{interventionPlans.map((item) => <article key={item.id}><strong>{item.title}</strong><small>{item.strategy} · {item.items.length} module{item.items.length === 1 ? "" : "s"}</small></article>)}</section></div></Panel>
      <Panel className="full-span" title="Bounded-system registry" subtitle="32 systems; featured status is editorial and the watchlist outlook is derived from each dated default protocol"><div className="table-wrap"><table><thead><tr><th>Bounded system</th><th>Operator</th><th>Default protocol</th><th>Derived outlook</th><th>Featured</th><th>Model family</th><th>Version</th><th>Estimate basis</th></tr></thead><tbody>{scenarios.map((item) => <tr key={item.id}><td>{item.system.title}</td><td>{item.system.operator}</td><td>{item.protocols.find((protocol) => protocol.id === item.defaultProtocolId)?.title}</td><td>{item.watchlistTier}</td><td>{item.featured ? "Yes" : "No"}</td><td>{item.modelFamily}</td><td>{item.version}</td><td>{item.currentStateEstimate ? `${item.currentStateEstimate.asOfDate} · ${item.currentStateEstimate.confidence} confidence` : "Illustrative · not empirically calibrated"}</td></tr>)}</tbody></table></div></Panel>
    </div>
  </div>;
}

type CompareFactor = Exclude<keyof SimulationParameters, "seed" | "steps" | "dt"> | "interventionTiming";
const compareFactors: Exclude<CompareFactor, "interventionTiming">[] = ["pressure", "error", "feedback", "correction", "drift", "irreversibleLoss", "initialDebt", "kappa", "chi", "rho0", "rhoCrit", "alpha", "beta", "omegaTheta", "omegaPhi", "couplingA", "couplingB"];

function CompareMode({ scenario, params, scheduled, primaryFrames, primarySummary }: { scenario: ScenarioDefinition; params: SimulationParameters; scheduled: ScheduledIntervention[]; primaryFrames: SimulationFrame[]; primarySummary: ReturnType<typeof simulate>["summary"] }) {
  const [factor, setFactor] = useState<CompareFactor>("pressure");
  const [compareParams, setCompareParams] = useState({ ...params });
  const [interventionOffset, setInterventionOffset] = useState(0);
  const comparisonInterventions = useMemo(() => scheduled.map((event) => ({ ...event, step: Math.max(0, Math.min(compareParams.steps - 1, event.step + interventionOffset)) })), [compareParams.steps, interventionOffset, scheduled]);
  const comparison = useMemo(
    () => simulate(compareParams, comparisonInterventions, { rupturePolicy: scenario.rupturePolicy }),
    [compareParams, comparisonInterventions, scenario.rupturePolicy],
  );
  const index = Math.min(primaryFrames.length, comparison.frames.length) - 1;
  const changedParameters = (Object.keys(params) as (keyof SimulationParameters)[]).filter((key) => params[key] !== compareParams[key]).length + (interventionOffset === 0 ? 0 : 1);
  const delta = {
    alignment: primarySummary.finalAlignment - comparison.summary.finalAlignment,
    rho: primarySummary.maxRho - comparison.summary.maxRho,
    debt: primarySummary.finalDebt - comparison.summary.finalDebt,
  };
  const differenceFrames = useMemo(() => createSignedDifferenceFrames(primaryFrames, comparison.frames), [comparison.frames, primaryFrames]);
  const selectFactor = (value: CompareFactor) => {
    setFactor(value);
    setCompareParams({ ...params });
    setInterventionOffset(0);
  };
  const setFactorValue = (value: number) => {
    if (factor === "interventionTiming") { setInterventionOffset(Math.round(value)); return; }
    const limit = PARAMETER_LIMITS[factor];
    const bounded = Math.max(limit.min, Math.min(limit.max, value));
    setCompareParams((current) => ({
      ...params,
      [factor]: factor === "rho0" ? Math.min(bounded, current.rhoCrit - .001) : factor === "rhoCrit" ? Math.max(bounded, current.rho0 + .001) : bounded,
    }));
    setInterventionOffset(0);
  };
  const factorValue = factor === "interventionTiming" ? interventionOffset : compareParams[factor];
  const baselineValue = factor === "interventionTiming" ? 0 : params[factor];
  const factorLimit = factor === "interventionTiming" ? { min: -Math.min(100, scheduled[0]?.step ?? 0), max: 100 } : PARAMETER_LIMITS[factor];
  const factorLabel = factor === "interventionTiming" ? "Intervention timing" : canonicalParameterLabels[factor] ?? factor;
  return <div className="page-view">
    <section className="page-hero compact"><div className="eyebrow"><span>Controlled comparison</span><span>Seed {params.seed}</span><span>{changedParameters} controlled change{changedParameters === 1 ? "" : "s"}</span></div><h1>Compare two futures</h1><p>Both runs begin with the same scenario, seed, and protocol. Select exactly one B factor so its modeled effect remains identifiable.</p></section>
    <div className="compare-controls">
      <label>Comparison scenario<input value={scenario.title} readOnly /></label>
      <label>One factor to vary<select aria-label="One comparison factor" value={factor} onChange={(event) => selectFactor(event.target.value as CompareFactor)}>{compareFactors.map((key) => <option key={key} value={key}>{canonicalParameterLabels[key] ?? key}</option>)}{scheduled.length > 0 && <option value="interventionTiming">Intervention timing</option>}</select></label>
      <label className="compare-factor-control">B · {factorLabel}<input aria-label={`B ${factorLabel}`} type="range" min={factorLimit.min} max={factorLimit.max} step={factor === "interventionTiming" ? 1 : .01} value={factorValue} onChange={(event) => setFactorValue(Number(event.target.value))} /><strong>{factor === "interventionTiming" ? `${factorValue >= 0 ? "+" : ""}${factorValue} steps` : factorValue.toFixed(3)}</strong><small>A {baselineValue.toFixed(3)} → B {factorValue.toFixed(3)}</small></label>
      <button onClick={() => { setCompareParams({ ...params }); setInterventionOffset(0); }}>Reset B to A</button>
    </div>
    <div className="compare-grid">
      <Panel title="A · Active configuration" subtitle={`${scenario.shortTitle} · synthetic embedding · ${scheduled.length} intervention${scheduled.length === 1 ? "" : "s"}`}><TorusCanvas compact cycles={scenario.cycles} frames={primaryFrames} frameIndex={index} params={params} playing={false} onSelectFrame={() => {}} /><CompareSummary summary={primarySummary} /></Panel>
      <Panel title="B · Controlled variation" subtitle={`${scenario.shortTitle} · synthetic embedding · same seed and protocol`}><TorusCanvas compact cycles={scenario.cycles} frames={comparison.frames} frameIndex={index} params={compareParams} playing={false} onSelectFrame={() => {}} /><CompareSummary summary={comparison.summary} /></Panel>
      <Panel className="full-span" title="Outcome difference · A minus B" subtitle={`${changedParameters} controlled change${changedParameters === 1 ? "" : "s"} · independent metric lanes · raw values retained`}><div className="difference-cards"><SummaryStat label="Δ toy proxy A=e⁻ρ" value={signed(delta.alignment)} tone={delta.alignment >= 0 ? "good" : "bad"} /><SummaryStat label="Δ max excursion" value={signed(delta.rho)} tone={delta.rho <= 0 ? "good" : "bad"} /><SummaryStat label="Δ debt" value={signed(delta.debt)} tone={delta.debt <= 0 ? "good" : "bad"} /><SummaryStat label="Warning time A / B" value={`${warningTime(primarySummary, params.dt)} / ${warningTime(comparison.summary, compareParams.dt)}`} /></div><DifferenceChart frames={differenceFrames} frameIndex={index} params={params} label="Signed difference chart for toy proxy A equals e to the minus rho, debt, and radial excursion" /><p className="compare-conclusion">{comparisonConclusion(factorLabel, baselineValue, factorValue, primarySummary, comparison.summary, differenceFrames)}</p></Panel>
    </div>
  </div>;
}

function CompareSummary({ summary }: { summary: ReturnType<typeof simulate>["summary"] }) { return <div className="compare-summary"><SummaryStat label="Final toy A=e⁻ρ" value={summary.finalAlignment.toFixed(3)} /><SummaryStat label="Final Δ" value={summary.finalDebt.toFixed(3)} /><SummaryStat label="Max ρ" value={summary.maxRho.toFixed(3)} /><SummaryStat label="Outcome" value={summary.ruptureStep !== undefined ? "Ruptured" : summary.recovered ? "Recovered" : summary.finalStatus} /></div>; }

function SystemBuilder({ announce, onOpenEmpirical }: { announce: (message: string) => void; onOpenEmpirical: (scenario: ScenarioDefinition) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<BuilderAnswers>(() => emptyBuilderAnswers());
  const [draftDefaults, setDraftDefaults] = useState<SimulationParameters>(() => ({ ...defaultParameters }));
  const [validation, setValidation] = useState<{ valid: boolean; publishable: false; publicationRequirement?: string; issues: { severity?: string; path: string; message: string }[]; evaluations?: { name: string; passed: boolean }[] } | null>(null);
  const [testResult, setTestResult] = useState<ReturnType<typeof simulate> | null>(null);
  const [validating, setValidating] = useState(false);
  const question = builderQuestions[step];
  const eligibility = useMemo(() => assessTorusEligibility(answers), [answers]);
  const proposal = useMemo(() => {
    if (!eligibility.eligible) return null;
    try { return buildScenarioProposal(answers, draftDefaults); } catch { return null; }
  }, [answers, draftDefaults, eligibility.eligible]);
  const invalidate = () => { setValidation(null); setTestResult(null); };
  const setAnswer = (value: string) => {
    setAnswers((current) => ({ ...current, [question.id]: value }));
    invalidate();
  };
  const setDraftParameter = (key: keyof SimulationParameters, value: number) => {
    const limit = PARAMETER_LIMITS[key];
    let bounded = Math.max(limit.min, Math.min(limit.max, value));
    if (limit.integer) bounded = Math.round(bounded);
    setDraftDefaults((current) => ({ ...current, [key]: key === "rho0" ? Math.min(bounded, current.rhoCrit - .001) : key === "rhoCrit" ? Math.max(bounded, current.rho0 + .001) : bounded }));
    invalidate();
  };
  const validateDraft = async () => {
    if (!proposal) { announce(eligibility.issues[0]?.message ?? "Complete every required builder field"); return; }
    setValidating(true);
    try {
      const response = await fetch("/api/v1/proposals/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(proposal) });
      const result = await response.json() as typeof validation;
      setValidation(result);
      setTestResult(null);
      announce(response.ok && result?.valid ? "Draft contract and executable protocols validated" : "Draft needs corrections before it can be tested");
    } catch (error) {
      setValidation({ valid: false, publishable: false, issues: [{ path: "api", message: error instanceof Error ? error.message : "Proposal validation failed" }] });
      announce("Proposal validation failed");
    } finally { setValidating(false); }
  };
  const testDraft = () => {
    if (!proposal || !validation?.valid) return;
    setTestResult(simulate(proposal.scenario.defaults, [], { rupturePolicy: proposal.scenario.rupturePolicy }));
    announce("Validated draft baseline simulated locally");
  };
  const openEmpirical = () => {
    if (!proposal || !validation?.valid) return;
    onOpenEmpirical(scenarioDefinitionSchema.parse(proposal.scenario) as ScenarioDefinition);
  };
  return <div className="page-view builder-page">
    <section className="page-hero"><div className="eyebrow"><span>Draft proposal builder</span><span>{eligibility.complete}/{eligibility.total} mapped</span><span>{eligibility.eligible ? "Torus eligibility established" : "Eligibility pending"}</span></div><h1>Test whether a real system<br /><em>warrants a torus.</em></h1><p>Map two independently recurrent and observable phases, define every canonical variable, state what would falsify the mapping, then validate an executable draft proposal.</p></section>
    <div className="builder-shell">
      <aside><div className="progress-ring" style={{ "--progress": `${eligibility.complete / eligibility.total * 100}%` } as React.CSSProperties}><span>{eligibility.complete}<small>/{eligibility.total}</small></span></div>{builderQuestions.map((item, index) => <button key={item.id} className={`${step === index ? "active" : ""} ${answers[item.id].trim() ? "done" : ""}`} onClick={() => setStep(index)}><span>{answers[item.id].trim() ? "✓" : index + 1}</span>{item.question}</button>)}</aside>
      <div className="builder-main-column">
        <Panel title={`Question ${step + 1} of ${builderQuestions.length}`} subtitle="Template, bounded instance, scenario modules, and evidence remain distinct"><div className="builder-question"><span className="question-number">{String(step + 1).padStart(2, "0")}</span><h2>{question.question}</h2><p>{question.hint}</p>{question.kind === "choice" ? <select autoFocus value={answers[question.id]} onChange={(event) => setAnswer(event.target.value)}><option value="">{question.placeholder}</option>{question.options?.map((option) => <option key={option} value={option}>{question.id === "template" ? systemTemplateById[option as keyof typeof systemTemplateById]?.title ?? option : option}</option>)}</select> : <textarea autoFocus value={answers[question.id]} onChange={(event) => setAnswer(event.target.value)} placeholder={question.placeholder} />}<div className="builder-actions"><button disabled={step === 0} onClick={() => setStep((value) => value - 1)}>← Back</button>{step < builderQuestions.length - 1 ? <button className="primary" disabled={!answers[question.id].trim()} onClick={() => setStep((value) => value + 1)}>Continue →</button> : <button className="primary" disabled={!eligibility.eligible || validating} onClick={() => void validateDraft()}>{validating ? "Validating…" : "Validate draft proposal"}</button>}</div></div></Panel>
        <Panel title="Draft simulation defaults" subtitle="Dimensionless starting values; domain calibration remains required"><div className="lab-factor-grid builder-default-grid">{visibleParameters.map((key) => <NumberField key={key} label={canonicalParameterLabels[key] ?? key} value={draftDefaults[key]} min={PARAMETER_LIMITS[key].min} max={PARAMETER_LIMITS[key].max} step={.01} onChange={(value) => setDraftParameter(key, value)} />)}</div></Panel>
        <section className={`builder-eligibility ${eligibility.eligible ? "eligible" : "pending"}`}><strong>{eligibility.eligible ? "Two-phase eligibility established for a draft test" : "A torus is not yet warranted"}</strong>{eligibility.issues.length ? <ul>{eligibility.issues.map((issue) => <li key={`${issue.field}-${issue.message}`}><button onClick={() => setStep(builderQuestions.findIndex((item) => item.id === issue.field))}>{issue.message}</button></li>)}</ul> : <p>The builder has distinct cycles, observation paths, an affirmative independence claim, and a falsification condition. API validation still checks the contract and executable protocols.</p>}</section>
      </div>
      <Panel className="builder-preview" title="Draft evidence receipt" subtitle="Canonical variables stay distinct from domain labels">
        <div className="mapping-list"><span><i>Goal</i><strong>{answers.objective || "Optimization objective"}</strong></span><span><i>π</i><strong>{answers.pressure || "Optimization pressure"}</strong></span><span><i>θ</i><strong>{answers.minorCycle || "Internal correction cycle"}</strong></span><span><i>φ</i><strong>{answers.majorCycle || "External adaptation cycle"}</strong></span><span><i>γ</i><strong>{answers.feedback || "Feedback fidelity"}</strong></span><span><i>ε</i><strong>{answers.misclassification || "Misclassification"}</strong></span><span><i>C</i><strong>{answers.correction || "Correction capacity"}</strong></span><span><i>Φ</i><strong>{answers.drift || "Viable-region drift"}</strong></span><span><i>Δ</i><strong>{answers.debt || "Alignment debt"}</strong></span><span><i>Λ</i><strong>{answers.irreversibleLoss || "Irreversible loss"}</strong></span><span><i>ρ</i><strong>{answers.viableRegion ? `Distance from: ${answers.viableRegion}` : "Distance from viable recurrence"}</strong></span></div>
        <div className="builder-validation"><strong>Contract & protocol validation</strong>{validation ? <><span className={validation.valid ? "valid" : "invalid"}>{validation.valid ? "VALID DRAFT · HUMAN REVIEW REQUIRED" : "CORRECTIONS REQUIRED"}</span>{validation.issues.length ? <ul>{validation.issues.map((issue) => <li key={`${issue.path}-${issue.message}`}><b>{issue.path}</b>{issue.message}</li>)}</ul> : <p>Schema, execution limits, and all draft protocol assertions passed.</p>}{validation.publicationRequirement && <small>{validation.publicationRequirement}</small>}</> : <p>Complete the evidence gate and validate through <code>/api/v1/proposals/validate</code>. Validation never publishes a scenario.</p>}<div className="button-row"><button disabled={!proposal || validating} onClick={() => void validateDraft()}>Validate</button><button disabled={!proposal} onClick={() => proposal && downloadJson(`${proposal.scenario.id}.draft.json`, proposal)}>Download draft</button><button className="primary" disabled={!validation?.valid} onClick={testDraft}>Test validated draft</button><button disabled={!validation?.valid} onClick={openEmpirical}>Open in Empirical Lab</button></div>{testResult && <div className="builder-test-result"><SummaryStat label="Final status" value={testResult.summary.finalStatus} /><SummaryStat label="Max ρ" value={testResult.summary.maxRho.toFixed(3)} /><SummaryStat label="Final debt" value={testResult.summary.finalDebt.toFixed(3)} /><SummaryStat label="Toy A=e⁻ρ" value={testResult.summary.finalAlignment.toFixed(3)} /></div>}</div>
      </Panel>
    </div>
  </div>;
}

type LearnTopic = { id: string; title: string; subtitle: string; explanation: string; example: string; equation: string; exercise: string; visual: string; visualTerms: string[] };
const learnTopics: LearnTopic[] = [
  { id: "ats", title: "ATS", subtitle: "Viability under layered constraints", explanation: "ATS defines alignment as probability mass inside a viable region shaped by physical, human or ecological, and constructed constraints.", example: "A hospital cannot optimize patient flow while ignoring clinical harm, staffing limits, or regulatory obligations.", equation: "A_ATS(S,t) = ∫ₓ* p_S(x,t) dx", exercise: "Load a stressed run and inspect whether correction C exceeds total divergence D across the layered scenario evidence.", visual: "layers", visualTerms: ["Kₚ", "Kᵦ", "K𝚌", "X*"] },
  { id: "aana", title: "AANA", subtitle: "Verifier-grounded correctability", explanation: "AANA externalizes grounding, verification, correction policy, and an alignment gate around a generator so errors can be revised, retrieved, questioned, refused, or deferred.", example: "An agent grounds a proposed change, runs tests and policy checks, revises failures, then gates release.", equation: "generate → ground → verify → correct → gate → monitor", exercise: "Load a run with a scheduled correction intervention and watch debt Δ and excursion ρ respond; phase θ is not claimed to be bounded by C.", visual: "loop", visualTerms: ["Generate", "Ground", "Verify", "Correct", "Gate", "Monitor"] },
  { id: "aix", title: "AIx", subtitle: "Illustrative diagnostic surface", explanation: "The site’s eight-domain AIx is a transparent synthetic diagnostic and decision surface, not the ATS alignment definition and not an empirically calibrated universal score.", example: "Feedback, misclassification control, graceful degradation, and correction capacity can disagree even when their weighted composite looks acceptable.", equation: "AIx = Σ wₖ sₖ; hard gates remain separate", exercise: "Load an elevated-risk run, open the AIx drawer, and compare component evidence with the hard-blocker and routing decision.", visual: "score", visualTerms: ["P", "B", "C", "F", "M", "G", "R", "Π"] },
  { id: "torus", title: "Why a torus?", subtitle: "Two independently recurrent phases", explanation: "A torus is conditional: it represents the product of two meaningful, independently recurrent phases, not every dynamic system.", example: "A fast operating-and-correction cycle can interact with a slower seasonal or governance cycle.", equation: "q(t)=(θ(t),φ(t)) ∈ S¹×S¹ = T²", exercise: "Load a two-frequency protocol and compare the 3D synthetic embedding with the unwrapped θ–φ path.", visual: "torus", visualTerms: ["θ", "φ", "T²"] },
  { id: "minor", title: "Correction cycle", subtitle: "Internal phase θ", explanation: "θ tracks position in a fast internal recurrent process. Its source should be an observable operational stage or a justified estimator.", example: "Observe → propose → verify → correct → gate → repeat.", equation: "θₜ₊₁=(θₜ+ωθ+a sinφₜ+ξθ) mod 2π", exercise: "Load a faster internal cycle and inspect θ travel and winding without treating frequency as correction quality.", visual: "cycle", visualTerms: ["Observe", "Act", "Verify", "Correct"] },
  { id: "major", title: "Adaptation cycle", subtitle: "External phase φ", explanation: "φ tracks the slower recurrent process through which environment, policy, or operating context changes.", example: "Measure demand → revise policy → reallocate capacity → evaluate outcomes.", equation: "φₜ₊₁=(φₜ+ωφ+b sinθₜ+ξφ) mod 2π", exercise: "Load a slower external cycle and inspect the changed winding ratio and coverage pattern.", visual: "cycle-major", visualTerms: ["Measure", "Revise", "Allocate", "Evaluate"] },
  { id: "radial", title: "Radial excursion", subtitle: "Distance from viable recurrence", explanation: "ρ represents modeled distance from a recurrent viable tube. Positive radial velocity means expansion; negative radial velocity means contraction.", example: "High excursion can still be recoverable before the terminal policy is satisfied.", equation: "ρ̇=−κ(ρ−ρ₀)+D−C+χΔ", exercise: "Load an adverse radial balance and use the Radial Stability chart to connect C−D−χΔ with expansion or contraction.", visual: "radial", visualTerms: ["ρ₀", "ρ", "ρcrit", "ρ̇"] },
  { id: "debt", title: "Alignment debt", subtitle: "Deferred correction Δ", explanation: "Unresolved divergence accumulates as debt and raises later radial pressure until excess correction can repay it.", example: "Skipped audits and unresolved cases make later remediation more expensive.", equation: "Δ̇=α[D−C]₊−βrepay[C−D]₊q(A_toy)", exercise: "Load high initial debt and compare its debt-adjusted margin with the instantaneous C−D margin.", visual: "debt", visualTerms: ["Delay", "Backlog", "χΔ", "Recovery cost"] },
  { id: "hysteresis", title: "Hysteresis", subtitle: "History changes recovery", explanation: "Returning pressure to an earlier value may not restore the earlier state after debt and irreversible loss have accumulated.", example: "Late remediation can require more correction than prevention under the same current pressure.", equation: "C_recover(Δ,history) > C_prevent", exercise: "Load a stress-then-relief protocol and inspect remaining debt after pressure falls.", visual: "hysteresis", visualTerms: ["Stress", "Debt", "Relief", "Different return"] },
  { id: "locking", title: "Phase locking", subtitle: "Synchronized recurrence", explanation: "When phase frequencies approach a rational ratio, the path may repeat a narrow set of phase combinations instead of covering the torus broadly.", example: "Coordination can improve timing—or synchronize a shared misclassification.", equation: "ωθ/ωφ ≈ p/q", exercise: "Load a 2:1 frequency protocol and compare winding, coverage, and risk rather than calling synchronization alignment.", visual: "locking", visualTerms: ["2 θ", "1 φ", "repeat", "blind spots"] },
  { id: "viable", title: "Viable region", subtitle: "Where constraints hold", explanation: "The viable region is the subset of phase-and-radius states that preserves continued operation and correction under the stated perspective and horizon.", example: "A fishery must retain a recoverable stock while its harvest and ecological cycles continue.", equation: "V={ (θ,φ,ρ)∈T²×ℝ₊ : ρ≤ρcrit }", exercise: "Load a tighter illustrative boundary and compare warning time with boundary-crossing time.", visual: "boundary", visualTerms: ["V", "ρ≤ρcrit", "warning", "crossing"] },
  { id: "loss", title: "Irreversibility", subtitle: "Loss Λ", explanation: "Some loss changes the future state space and cannot be repaid through ordinary feedback, debt repayment, or correction.", example: "Extinction, permanent data disclosure, or loss of life cannot be modeled as an ordinary reversible backlog.", equation: "D=πε(1−γ)+Φ+Λ", exercise: "Load high Λ and inspect cumulative irreversible loss and the explicit terminal policy separately from boundary crossing.", visual: "loss", visualTerms: ["Before", "Λ", "After", "No ordinary return"] },
  { id: "identifiability", title: "Phase identifiability", subtitle: "Estimated φ may be undefined", explanation: "An external phase estimate is shown only after amplitude, spectral concentration, cycle-count, and sampling gates pass. Failure means undefined—not φ=0.", example: "A short or nearly flat signal cannot support a defensible position in an external cycle.", equation: "gate(signal)=pass ⇒ φ̂ defined; fail ⇒ φ̂ undefined", exercise: "Load a short slow-cycle protocol, complete the run, and confirm the estimated phase remains unavailable with a stated gate reason.", visual: "identifiability", visualTerms: ["signal", "gates", "φ̂", "undefined"] },
  { id: "not-torus", title: "When not a torus", subtitle: "A valid negative result", explanation: "If one phase is absent, dependent, or unobservable, the responsible conclusion is that this toroidal representation is not established.", example: "A one-off project with no slower recurrent environmental cycle may need a trajectory or state-space model instead.", equation: "¬(two identifiable recurrent phases) ⇒ no T² claim", exercise: "Load a one-cycle protocol and observe that the synthetic 3D drawing alone does not establish toroidal geometry.", visual: "not-torus", visualTerms: ["one cycle", "no φ evidence", "reject T²", "choose another model"] },
];

type LessonProtocol = { parameters: Partial<SimulationParameters>; interventions?: ScheduledIntervention[]; mode?: Mode; view?: View; observation: string };
const lessonProtocols: LessonProtocol[] = [
  { parameters: { pressure: 1.9, error: .42, feedback: .45, correction: .5 }, mode: "research", observation: "compare C with D in the live explanation" },
  { parameters: { pressure: 2.1, error: .48, feedback: .4, correction: .35, initialDebt: .35 }, interventions: [{ id: "lesson-aana-correction", label: "Verifier-grounded correction", step: 80, effects: { feedback: .78, correction: .82, error: .24 }, cost: 3 }], mode: "research", observation: "watch debt and radial motion after the correction gate" },
  { parameters: { pressure: 2.25, error: .55, feedback: .34, correction: .34, irreversibleLoss: .08 }, mode: "research", observation: "open the AIx drawer and inspect component evidence" },
  { parameters: { omegaTheta: .09, omegaPhi: .055, steps: 960 }, mode: "research", observation: "compare the embedded and unwrapped phase paths" },
  { parameters: { omegaTheta: .15, omegaPhi: .045, steps: 720 }, mode: "research", observation: "inspect minor winding without equating speed with quality" },
  { parameters: { omegaTheta: .1, omegaPhi: .025, steps: 960 }, mode: "research", observation: "inspect the changed winding ratio" },
  { parameters: { pressure: 2.35, error: .5, feedback: .32, correction: .3, initialDebt: .45 }, mode: "research", observation: "connect the debt-adjusted margin to radial expansion" },
  { parameters: { initialDebt: 1.15, pressure: 1.7, correction: .5, beta: .08 }, mode: "research", observation: "compare C−D with C−D−χΔ" },
  { parameters: { pressure: 2.3, error: .52, feedback: .35, correction: .3, initialDebt: .7 }, interventions: [{ id: "lesson-relief", label: "Pressure relief without debt reset", step: 120, effects: { pressure: 1.1, correction: .62, feedback: .7 }, cost: 2 }], mode: "research", observation: "inspect remaining debt after pressure falls" },
  { parameters: { omegaTheta: .1, omegaPhi: .05, couplingA: .04, couplingB: .04, steps: 960 }, mode: "research", observation: "compare synchronization with radial viability" },
  { parameters: { rhoCrit: 1.2, pressure: 1.95, correction: .4 }, mode: "research", observation: "compare warning, crossing, and terminal times" },
  { parameters: { irreversibleLoss: .2, pressure: 2.1, correction: .38, feedback: .38 }, mode: "research", observation: "separate cumulative loss from debt and excursion" },
  { parameters: { omegaPhi: .004, couplingB: 0, steps: 160 }, mode: "research", observation: "finish the run and read the phase-gate reason" },
  { parameters: { omegaPhi: 0, couplingB: 0, couplingA: 0, steps: 480 }, mode: "research", observation: "treat an undefined second phase as a negative torus result" },
];

function LearnSection({ launchProtocol }: { launchProtocol: (index: number) => void }) {
  const [selected, setSelected] = useState(0);
  const topic = learnTopics[selected];
  return <div className="page-view learn-page"><section className="page-hero"><div className="eyebrow"><span>Learn</span><span>{learnTopics.length} configured concepts</span><span>Each launches a named protocol</span></div><h1>Understand the geometry<br /><em>through systems you know.</em></h1><p>Start in plain language, connect the idea to its exact mathematical role, then load a reproducible protocol with a specific observation prompt.</p></section><div className="learn-layout"><div className="topic-grid">{learnTopics.map((item, index) => <button key={item.id} className={selected === index ? "active" : ""} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong><small>{item.subtitle}</small></button>)}</div><Panel className="lesson-panel" title={topic.title} subtitle={topic.subtitle}><LessonVisual topic={topic} /><div className="lesson-copy"><h3>Plain-language explanation</h3><p>{topic.explanation}</p><h3>Scenario example</h3><p>{topic.example}</p><h3>Mathematical view</h3><code>{topic.equation}</code><div className="exercise"><strong>Configured lab exercise</strong><p>{topic.exercise}</p><button onClick={() => launchProtocol(selected)}>Load guided protocol →</button></div></div></Panel></div></div>;
}

function LessonVisual({ topic }: { topic: LearnTopic }) {
  return <div className={`lesson-visual visual-${topic.visual}`} role="img" aria-label={`${topic.title}: ${topic.visualTerms.join(", ")}`}><div className="lesson-diagram">{topic.visualTerms.map((term, index) => <span key={`${term}-${index}`}>{term}</span>)}</div><small>{topic.id === "torus" ? "Two independent cycles" : topic.id === "not-torus" ? "The negative result is informative" : topic.subtitle}</small></div>;
}

function TheorySection({ announce }: { announce: (message: string) => void }) {
  const citation = "Sori, A. (2026). Toroidal Geometry in ATS/AANA/AIx: Stable Recurrence, Invariant Tori, and Viability-Preserving Cycles in Layered Alignment Systems. Revised phase-coordinate edition.";
  const principles = [
    ["Preserve the correction cycle", "θ and the AANA correction loop", "Use the internal-cycle and intervention controls without treating speed as correction quality."],
    ["Track external phase", "φ source and identifiability gate", "Use latent φ only for synthetic ground truth; estimated φ remains undefined when its gates fail."],
    ["Measure radial excursion", "ρ, ρ̇, warning and boundary views", "Inspect distance, direction, and duration rather than a single score."],
    ["Scale correction with pressure", "C versus D=πε(1−γ)+Φ+Λ", "Use controlled comparisons to test whether correction keeps pace with divergence."],
    ["Avoid phase-specific blind spots", "Unwrapped coverage and topology studies", "Look for narrow or locked phase combinations, not merely synchronization."],
    ["Design recoverable recurrence", "Debt, hysteresis and intervention timing", "Compare prevention, recovery time, residual debt, and terminal policy."],
  ];
  return <div className="page-view theory-page">
    <section className="page-hero"><div className="eyebrow"><span>Research foundations</span><span>Revised phase-coordinate edition</span><span>Paper, framework, and product layers separated</span></div><h1>Alignment may be stable<br /><em>without standing still.</em></h1><p>The theory models viable recurrent motion across a fast correction cycle and a slower environmental adaptation cycle—when both phases are meaningful, independently recurrent, and observable.</p><div className="hero-actions"><a className="button primary" href="/paper.pdf" target="_blank">Read the complete paper</a><button onClick={async () => { await navigator.clipboard.writeText(citation); announce("Citation copied"); }}>Copy citation</button></div></section>
    <div className="theory-grid">
      <Panel className="theory-summary" title="The central claim" subtitle="Conditional geometry, not a universal shape"><blockquote>When alignment requires two coupled recurrent processes—internal correction and external adaptation—the natural geometric object is a torus.</blockquote><p>The ATS, AANA, and AIx equations do not by themselves prove toroidal geometry. A torus is justified only after two distinct recurrent phases and a bounded radial coordinate are established.</p><div className="theorem-cards"><article><span>01</span><strong>Two-cycle state</strong><code>T²=S¹×S¹</code><p>θ is the internal operational/correction phase; φ is the external adaptation phase.</p></article><article><span>02</span><strong>ATS balance</strong><code>Ȧ=C−D</code><p>D=πε(1−γ)+Φ+Λ; this describes alignment balance, not radial geometry by itself.</p></article><article><span>03</span><strong>Radial stability</strong><code>ρ̇=−κ(ρ−ρ₀)+D−C+χΔ</code><p>Positive ρ̇ expands excursion; negative ρ̇ contracts it.</p></article><article><span>04</span><strong>Debt & hysteresis</strong><code>Δ̇=α[D−C]₊−βrepay[C−D]₊q</code><p>Deferred correction can raise later recovery requirements.</p></article></div></Panel>

      <Panel title="Two different meanings of alignment" subtitle="The ATS definition and the simulator proxy are not interchangeable"><div className="definition-stack"><article><span>ATS 4.0 definition</span><code>A_ATS(S,t)=∫ₓ* p_S(x,t)dx</code><p>Probability mass inside the viable region. This requires a real state distribution and a defensible viable set.</p></article><article><span>Section 14 minimal toy proxy</span><code>A_toy(t)=exp(−ρ(t))</code><p>A monotone visualization proxy used by this synthetic simulator. It is not an empirical alignment measurement.</p></article><article><span>AIx product diagnostic</span><code>AIx=Σwₖsₖ + hard gates</code><p>An eight-domain illustrative decision surface. It neither replaces A_ATS nor proves viability.</p></article></div></Panel>

      <Panel title="Paper-aligned torus dynamics" subtitle="The engine uses bounded internal substeps"><div className="equation-stack"><code>Dₜ=πₜεₜ(1−γₜ)+Λₜ+Φₜ</code><code>θₜ₊₁=(θₜ+ωθ+a sinφₜ+ξθₜ) mod 2π</code><code>φₜ₊₁=(φₜ+ωφ+b sinθₜ+ξφₜ) mod 2π</code><code>Δₜ₊₁=Δₜ+α[D−C]₊−βrepay[C−D]₊q(A_toy)</code><code>ρₜ₊₁=ρₜ−κ(ρₜ−ρ₀)+D−C+χΔₜ+ξρₜ</code></div><div className="phase-source-note"><strong>Phase source rule</strong><p>θ here is an operational cycle phase—not the neural parameter subscript in fθ and not an AIx score. φ may be latent in a synthetic run or estimated from an external signal. An estimated phase is shown only after amplitude, spectral, cycle-count, and sampling gates pass.</p></div></Panel>

      <Panel className="full-span theory-principles" title="Six paper design principles" subtitle="Direct crosswalk from the foundational paper to the interactive modules"><div className="principle-grid">{principles.map(([principle, surface, action], index) => <article key={principle}><span>{String(index + 1).padStart(2, "0")}</span><strong>{principle}</strong><b>{surface}</b><p>{action}</p></article>)}</div></Panel>

      <Panel title="Framework and product boundaries" subtitle="Related layers with different evidentiary status"><div className="boundary-stack"><article><strong>Foundational torus paper</strong><p>Conditional two-phase geometry, radial excursion, debt, recovery, winding, phase observation, and design principles.</p></article><article><strong>ATS 4.0</strong><p>Layered viable-region alignment and the balance Ȧ=C−D.</p></article><article><strong>AANA</strong><p>Verifier-grounded runtime correctability: generate, ground, verify, revise/retrieve/ask/refuse/defer, gate, and monitor.</p></article><article><strong>Site extensions</strong><p>Watchlist colors, status thresholds, the eight-domain synthetic AIx, scenario families, and terminal rupture policies are transparent illustrative product rules—not theorem results from the attached paper.</p></article></div></Panel>

      <Panel title="Research status & limitations" subtitle="What the simulator does—and does not—show"><ul className="limitation-list"><li><strong>Conditional geometry.</strong> Two meaningful, independently recurrent phases are required; a torus-shaped rendering is not evidence.</li><li><strong>Synthetic evidence.</strong> Experiments demonstrate model behavior, not empirical validation or operational advice.</li><li><strong>Rupture semantics.</strong> Boundary crossing remains distinct from the site’s illustrative terminal policy.</li><li><strong>Phase identifiability.</strong> A failed gate leaves φ undefined rather than assigning an arbitrary angle.</li><li><strong>Scenario mappings are hypotheses.</strong> Units, evidence, assumptions, calibration, and falsification remain visible.</li><li><strong>Coordination is not alignment.</strong> Coupled systems can synchronize a shared error.</li></ul></Panel>

      <Panel className="full-span" title="Paper & citation" subtitle="Armando Sori · Independent Researcher · July 13, 2026"><div className="paper-card"><div className="paper-preview"><span>TOROIDAL GEOMETRY</span><strong>ATS / AANA / AIx</strong><i /></div><p>{citation}</p><div className="button-row"><a className="button" href="/paper.pdf" download>Download PDF</a><button onClick={() => downloadText("citation.bib", `@article{sori2026toroidal,\n  title={Toroidal Geometry in ATS/AANA/AIx},\n  author={Sori, Armando},\n  year={2026},\n  note={Revised phase-coordinate edition}\n}`)}>BibTeX</button></div></div><div className="changelog"><strong>Model changelog</strong><span><b>v1.2.0</b> Recoverable versus terminal rupture, cumulative-loss telemetry, debt-adjusted margin, synthetic AIx/AANA gate, exact paper fixtures, imported telemetry, and protocol-driven research modules.</span><span><b>Evidence boundary</b> The served PDF matches the revised paper; product classifiers and mappings remain separately labeled illustrative rules.</span></div></Panel>
    </div>
  </div>;
}

function SummaryStat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) { return <span className={`summary-stat ${tone}`}><small>{label}</small><strong>{value}</strong></span>; }
function viabilityStatusLabel(frame: SimulationFrame) { if (frame.viabilityState === "Irreversible rupture") return "Irreversible rupture"; if (frame.viabilityState === "Viability-boundary crossing") return "Boundary crossed"; if (frame.viabilityState === "Recoverable excursion") return "Recoverable excursion"; return frame.status; }
function statusToneFor(status: string) { if (status === "Stable") return "stable"; if (status === "Irreversible rupture" || status === "Rupture approaching") return "danger"; if (status === "Recovering") return "recovering"; return "warning"; }
function statusMessage(frame: SimulationFrame) { if (frame.viabilityState === "Irreversible rupture") return "Persistent excursion, accumulated loss, and severe debt or expansion crossed the terminal policy."; if (frame.viabilityState === "Viability-boundary crossing") return "The critical viability boundary was crossed; recovery is still possible."; if (frame.viabilityState === "Recoverable excursion") return frame.radialVelocity < 0 ? "Outside the viable tube, but radial motion is contracting." : "Outside the viable tube without terminal rupture."; if (frame.status === "Stable") return "System is inside the viable tube."; if (frame.status === "Recovering") return "Excursion is contracting after stress."; return frame.debtAdjustedMargin < 0 ? "Debt-adjusted divergence exceeds current correction." : "Viability margin is narrowing."; }
function phaseName(angle: number, stages: string[]) { const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return stages[Math.floor((normalized / (Math.PI * 2)) * stages.length) % stages.length]; }
function signed(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`; }
function outsideFraction(frames: SimulationFrame[], rhoCrit: number) { return frames.length ? frames.filter((frame) => frame.rho >= rhoCrit).length / frames.length : 0; }
function warningTime(summary: ReturnType<typeof simulate>["summary"], dt: number) { return summary.firstWarningStep === undefined ? "∞" : `${(summary.firstWarningStep * dt).toFixed(2)} time`; }
function comparisonConclusion(label: string, baselineValue: number, comparisonValue: number, left: ReturnType<typeof simulate>["summary"], right: ReturnType<typeof simulate>["summary"], differences: SimulationFrame[]) {
  if (Math.abs(baselineValue - comparisonValue) < 1e-12) return "A and B are identical controls; their outcomes match exactly.";
  const changed = `${label} changed from ${baselineValue.toFixed(3)} in A to ${comparisonValue.toFixed(3)} in B`;
  const terminal = left.irreversibleRuptureStep === undefined && right.irreversibleRuptureStep !== undefined
    ? "B reaches modeled terminal rupture while A does not"
    : left.irreversibleRuptureStep !== undefined && right.irreversibleRuptureStep === undefined
      ? "B avoids modeled terminal rupture reached by A"
      : `A finishes ${left.finalViabilityState}; B finishes ${right.finalViabilityState}`;
  const debtDirection = right.finalDebt < left.finalDebt ? "lower" : right.finalDebt > left.finalDebt ? "higher" : "unchanged";
  const rhoDirection = right.maxRho < left.maxRho ? "lower" : right.maxRho > left.maxRho ? "higher" : "unchanged";
  const recovery = right.recoveredAfterCrossing ? " B also recovers after crossing." : right.recovered ? " B completes a modeled recovery." : "";
  const peak = differences.reduce((current, frame) => ({ proxy: Math.max(current.proxy, Math.abs(frame.alignment)), debt: Math.max(current.debt, Math.abs(frame.debt)), rho: Math.max(current.rho, Math.abs(frame.rho)) }), { proxy: 0, debt: 0, rho: 0 });
  const transient = peak.proxy > .001 || peak.debt > .001 || peak.rho > .001
    ? ` The independent lanes show transient separation—peak |ΔA_toy| ${peak.proxy.toFixed(3)}, |Δdebt| ${peak.debt.toFixed(3)}, and |Δρ| ${peak.rho.toFixed(3)}—even where terminal values later converge.`
    : " The trajectories also remain effectively identical throughout the run.";
  return `Within this controlled synthetic run, ${changed}; ${terminal}. B ends with ${debtDirection} debt (${right.finalDebt.toFixed(3)}) and ${rhoDirection} maximum excursion (${right.maxRho.toFixed(3)}).${transient}${recovery}`;
}

function configurationPayload(scenario: ScenarioDefinition, protocol: ScenarioProtocolDefinition, interventionPlan: InterventionPlanDefinition, params: SimulationParameters, customInterventions: ScheduledIntervention[], resolvedInterventions: ScheduledIntervention[], summary: ReturnType<typeof simulate>["summary"]) { return { schemaVersion: CONTRACT_VERSION, exportedAt: new Date().toISOString(), modelVersion: MODEL_VERSION, templateId: scenario.system.templateId, systemId: scenario.system.id, protocolId: protocol.id, scenarioModuleId: protocol.moduleId, interventionPlanId: interventionPlan.id, systemVersion: scenario.system.version, scenarioVersion: scenario.version, scenarioEvidence: scenario.evidence, configuration: { systemId: scenario.system.id, scenarioId: scenario.id, protocolId: protocol.id, interventionPlanId: interventionPlan.id, parameters: params, customInterventions, resolvedInterventions }, experiment: { schemaVersion: CONTRACT_VERSION, systemId: scenario.system.id, scenarioId: scenario.id, protocolId: protocol.id, interventionPlanId: interventionPlan.id, parameters: params, interventions: customInterventions, seeds: [params.seed], includeFrames: false }, summary }; }
function downloadJson(filename: string, value: unknown) { downloadText(filename, JSON.stringify(value, null, 2), "application/json"); }
function downloadText(filename: string, content: string, type = "text/plain") { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
function downloadCsv(filename: string, frames: SimulationFrame[]) { const header = "step,time,theta,phi,thetaUnwrapped,phiUnwrapped,estimatedPhi,phaseIdentifiable,phaseConfidence,phaseRegime,rho,debt,toyAlignmentProxy,divergence,correction,correctionMargin,debtAdjustedMargin,radialVelocity,debtVelocity,irreversibleLoss,cumulativeIrreversibleLoss,viabilityState,ruptureProgress,status"; const rows = frames.map((f) => [f.step, f.time, f.theta, f.phi, f.thetaUnwrapped, f.phiUnwrapped, f.estimatedPhi ?? "", f.phaseIdentifiable, f.phaseConfidence, f.phaseRegime, f.rho, f.debt, f.alignment, f.divergence, f.correction, f.correctionMargin, f.debtAdjustedMargin, f.radialVelocity, f.debtVelocity, f.irreversibleLoss, f.cumulativeIrreversibleLoss, f.viabilityState, f.ruptureProgress, f.status].map(csvCell).join(",")); downloadText(filename, [header, ...rows].join("\n"), "text/csv"); }
function csvCell(value: string | number | boolean) { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function exportCanvas(selector: string, filename: string) { const canvas = document.querySelector<HTMLCanvasElement>(selector); if (!canvas) return; canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }, "image/png"); }
function exportChartSvg(frames: SimulationFrame[], params: SimulationParameters, filename: string) { const width = 1200; const height = 600; const pad = 64; const maxDebt = Math.max(1, ...frames.map((frame) => frame.debt)); const maxRho = Math.max(params.rhoCrit, ...frames.map((frame) => frame.rho)); const path = (value: (frame: SimulationFrame) => number) => frames.map((frame, index) => `${index ? "L" : "M"}${(pad + index / Math.max(1, frames.length - 1) * (width - pad * 2)).toFixed(1)},${(height - pad - value(frame) * (height - pad * 2)).toFixed(1)}`).join(" "); const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#06101f"/><g stroke="#18304d" stroke-width="1">${Array.from({ length: 7 }, (_, index) => `<path d="M${pad} ${pad + index * (height - pad * 2) / 6}H${width - pad}"/>`).join("")}</g><path d="${path((frame) => frame.alignment)}" fill="none" stroke="#71e17d" stroke-width="3"/><path d="${path((frame) => frame.debt / maxDebt)}" fill="none" stroke="#ff5b62" stroke-width="3"/><path d="${path((frame) => frame.rho / maxRho)}" fill="none" stroke="#49bfff" stroke-width="3" stroke-dasharray="8 6"/><text x="${pad}" y="38" fill="#dcecff" font-family="system-ui" font-size="22">Viability Torus Lab — Toy Proxy A=e⁻ρ, Debt, and Excursion</text><text x="${pad}" y="${height - 20}" fill="#91a4bf" font-family="monospace" font-size="14">Independent scales: toy A=e⁻ρ 0–1 · Δ 0–${maxDebt.toFixed(3)} · ρ 0–${maxRho.toFixed(3)} · model ${MODEL_VERSION}</text></svg>`; downloadText(filename, svg, "image/svg+xml"); }
