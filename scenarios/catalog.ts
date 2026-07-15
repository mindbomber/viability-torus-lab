import { defaultParameters, type SimulationParameters } from "../engine/simulator.ts";
import type {
  BoundedSystemDefinition,
  DynamicTrait,
  ModelFamily,
  PhaseSource,
  ScenarioCategory,
  ScenarioDefinition,
  WatchlistTier,
} from "../contracts/types.ts";
import {
  boundedSystemProfiles,
  derivedDefaultWatchlist,
  independentDefaultParameters,
} from "./systems.ts";
import { scenarioModuleAppliesTo, scenarioModules, resolveScenarioProtocol } from "./protocols.ts";
import { systemTemplateById } from "./templates.ts";
import { currentStateEstimateFor } from "./calibration.ts";
import { assertPublishedTorusEligibility } from "./eligibility.ts";

export type {
  ModelFamily,
  ParameterKey,
  ScenarioCategory,
  ScenarioDefinition,
  WatchlistTier,
} from "../contracts/types.ts";

type MeaningSeed = {
  p: string; e: string; g: string; c: string; f: string;
  d: string; l: string; k: string; x: string; r: string;
};

type ScenarioSeed = {
  id: string;
  category: ScenarioCategory;
  family: ModelFamily | "regenerative-stock" | "threshold-regime-shift" | "resistance-contagion" | "trust-legitimacy" | "capability-correction" | "network-cascade" | "financial-leverage" | "human-capacity";
  minor: string[];
  major: string[];
  meanings: MeaningSeed;
  icon: string;
  accent: string;
  difficulty?: ScenarioDefinition["difficulty"];
  version?: string;
  distinctive?: string;
  events?: string[];
  interventions?: string[];
  majorSource?: PhaseSource;
  defaults?: Partial<SimulationParameters>;
};

const standardInterventionIds = ["increase-correction", "improve-feedback", "reduce-pressure", "add-audit", "pause-optimization", "repay-debt"];
const standardWarnings = ["Correction margin is narrowing", "Radial excursion exceeds the early-warning band", "Alignment debt is accumulating"];
const publishedSystemVersion = "2.0.0";

const normalizedRanges: ScenarioDefinition["ranges"] = {
  pressure: { min: 0, max: 2, step: 0.01 },
  error: { min: 0, max: 1, step: 0.01 },
  feedback: { min: 0, max: 1, step: 0.01 },
  correction: { min: 0, max: 2, step: 0.01 },
  drift: { min: 0, max: 0.5, step: 0.01 },
  irreversibleLoss: { min: 0, max: 0.5, step: 0.01 },
  initialDebt: { min: 0, max: 2, step: 0.01 },
};

const publishedSystemIds = [
  "groundwater-depletion", "soil-fertility", "fishery-management",
  "semiconductor-supply-chain", "hospital-throughput", "education-quality",
  "llm-deployment", "coding-agent", "research-integrity",
  "aging-infrastructure", "public-transit", "healthcare-workforce",
  "antimicrobial-resistance", "public-health-preparedness", "information-integrity",
  "institutional-trust", "data-governance", "engagement-recommender",
  "sovereign-debt", "disaster-insurance", "housing-affordability",
] as const;

const maintenancePatternForSystem: Record<(typeof publishedSystemIds)[number], ModelFamily> = {
  "groundwater-depletion": "regeneration-depletion",
  "soil-fertility": "regeneration-depletion",
  "fishery-management": "regeneration-depletion",
  "semiconductor-supply-chain": "flow-backlog",
  "hospital-throughput": "flow-backlog",
  "education-quality": "flow-backlog",
  "llm-deployment": "detection-correction",
  "coding-agent": "detection-correction",
  "research-integrity": "detection-correction",
  "aging-infrastructure": "maintenance-renewal",
  "public-transit": "maintenance-renewal",
  "healthcare-workforce": "maintenance-renewal",
  "antimicrobial-resistance": "propagation-containment",
  "public-health-preparedness": "propagation-containment",
  "information-integrity": "propagation-containment",
  "institutional-trust": "trust-redress",
  "data-governance": "trust-redress",
  "engagement-recommender": "trust-redress",
  "sovereign-debt": "reserves-solvency",
  "disaster-insurance": "reserves-solvency",
  "housing-affordability": "reserves-solvency",
};

const dynamicTraitsForSystem: Record<(typeof publishedSystemIds)[number], DynamicTrait[]> = {
  "groundwater-depletion": ["delayed-feedback", "threshold-crossing", "hysteresis", "irreversible-loss", "multi-timescale"],
  "soil-fertility": ["delayed-feedback", "hysteresis", "irreversible-loss", "multi-timescale"],
  "fishery-management": ["delayed-feedback", "threshold-crossing", "network-propagation", "irreversible-loss", "multi-timescale"],
  "semiconductor-supply-chain": ["capacity-saturation", "network-propagation", "delayed-feedback", "multi-timescale"],
  "hospital-throughput": ["capacity-saturation", "delayed-feedback", "phase-coupling", "multi-timescale"],
  "education-quality": ["capacity-saturation", "delayed-feedback", "hysteresis", "multi-timescale"],
  "llm-deployment": ["delayed-feedback", "capacity-saturation", "phase-coupling", "irreversible-loss"],
  "coding-agent": ["delayed-feedback", "phase-coupling", "irreversible-loss"],
  "research-integrity": ["delayed-feedback", "hysteresis", "phase-coupling", "multi-timescale"],
  "aging-infrastructure": ["delayed-feedback", "threshold-crossing", "irreversible-loss", "multi-timescale"],
  "public-transit": ["capacity-saturation", "delayed-feedback", "threshold-crossing", "multi-timescale"],
  "healthcare-workforce": ["capacity-saturation", "delayed-feedback", "hysteresis", "multi-timescale"],
  "antimicrobial-resistance": ["network-propagation", "delayed-feedback", "threshold-crossing", "hysteresis", "irreversible-loss"],
  "public-health-preparedness": ["network-propagation", "capacity-saturation", "delayed-feedback", "phase-coupling"],
  "information-integrity": ["network-propagation", "delayed-feedback", "hysteresis", "phase-coupling"],
  "institutional-trust": ["delayed-feedback", "hysteresis", "phase-coupling", "multi-timescale"],
  "data-governance": ["delayed-feedback", "hysteresis", "irreversible-loss", "multi-timescale"],
  "engagement-recommender": ["network-propagation", "delayed-feedback", "hysteresis", "phase-coupling"],
  "sovereign-debt": ["capacity-saturation", "threshold-crossing", "hysteresis", "multi-timescale"],
  "disaster-insurance": ["capacity-saturation", "threshold-crossing", "network-propagation", "multi-timescale"],
  "housing-affordability": ["capacity-saturation", "delayed-feedback", "hysteresis", "multi-timescale"],
};

const isPublishedSystemId = (id: string): id is (typeof publishedSystemIds)[number] =>
  (publishedSystemIds as readonly string[]).includes(id);

const familyAixLabels: Record<ModelFamily, ScenarioDefinition["aixLabels"]> = {
  "regeneration-depletion": { physical: "Resource stock and physical feasibility", biological: "Ecological and human-health viability", constructed: "Production or service delivery", feedback: "Monitoring and replenishment integrity" },
  "flow-backlog": { physical: "Material throughput and capacity", biological: "Safety, learning, health, and access", constructed: "Queue and service coherence", feedback: "Demand, delay, and outcome visibility" },
  "detection-correction": { physical: "Factual and technical validity", biological: "Safety and human impact", constructed: "Task or knowledge-system performance", feedback: "Verifier, replication, grounding, and audit integrity" },
  "maintenance-renewal": { physical: "Asset or workforce condition", biological: "Public and worker safety", constructed: "Service continuity and renewal", feedback: "Inspection, incident, and condition reporting" },
  "propagation-containment": { physical: "Transmission and state evidence", biological: "Health, cognition, and social viability", constructed: "Containment and response performance", feedback: "Surveillance, grounding, and audit integrity" },
  "trust-redress": { physical: "Service feasibility and objective evidence", biological: "Dignity, wellbeing, and social viability", constructed: "Procedural and institutional coherence", feedback: "Transparency, appeals, and public feedback" },
  "reserves-solvency": { physical: "Real resource and cash-flow feasibility", biological: "Household and social impact", constructed: "Market and contract functioning", feedback: "Balance-sheet and risk transparency" },
};

const phaseSourceFor = (seed: ScenarioSeed, family: ModelFamily): PhaseSource => seed.majorSource ?? (
  family === "reserves-solvency" ? "market-cycle" :
  seed.category === "Organizations" || seed.category === "Society" ? "policy-cycle" :
  seed.category === "Ecology" || seed.category === "Healthcare" ? "seasonal" : "estimated"
);

const makeScenario = (seed: ScenarioSeed): ScenarioDefinition => {
  if (!isPublishedSystemId(seed.id)) throw new Error(`Uncurated system cannot be published: ${seed.id}`);
  const family = maintenancePatternForSystem[seed.id];
  const template = systemTemplateById[family];
  const defaults: SimulationParameters = {
    ...defaultParameters,
    ...template.baseDynamics,
    ...seed.defaults,
    ...independentDefaultParameters[seed.id],
  };
  const labels = {
    pressure: seed.meanings.p,
    error: seed.meanings.e,
    feedback: seed.meanings.g,
    correction: seed.meanings.c,
    drift: seed.meanings.f,
    initialDebt: seed.meanings.d,
    irreversibleLoss: seed.meanings.l,
    restoration: seed.meanings.k,
    debtCoupling: seed.meanings.x,
    radialExcursion: seed.meanings.r,
  };
  const profile = boundedSystemProfiles[seed.id];
  if (!profile) throw new Error(`Missing bounded-system definition for ${seed.id}`);
  const cycles = {
    minor: { label: seed.minor.join(" → "), stages: seed.minor, description: "Local operational correction cycle", defaultFrequency: defaults.omegaTheta, phaseSource: "operational-stage" as const },
    major: { label: seed.major.join(" → "), stages: seed.major, description: "External adaptation cycle", defaultFrequency: defaults.omegaPhi, phaseSource: phaseSourceFor(seed, family) },
  };
  const viableRegion = `Operation remains viable while ${seed.meanings.r.toLowerCase()} stays inside a recoverable range and the stated population floors are maintained.`;
  const system: BoundedSystemDefinition = {
    id: seed.id,
    version: publishedSystemVersion,
    templateId: template.id,
    maintenancePatternId: template.id,
    title: profile.title,
    shortTitle: profile.shortTitle,
    category: seed.category,
    domain: seed.category,
    dynamicTraits: dynamicTraitsForSystem[seed.id],
    operator: profile.operator,
    boundary: profile.boundary,
    objective: profile.objective,
    population: profile.population,
    horizon: profile.horizon,
    aggregation: profile.aggregation,
    viableRegion,
    stateVariables: [seed.meanings.r, seed.meanings.d, seed.meanings.g, seed.meanings.c],
    constraints: {
      physical: [familyAixLabels[family].physical],
      biological: [familyAixLabels[family].biological],
      constructed: [familyAixLabels[family].constructed],
    },
    cycles,
    phaseEvidence: {
      thetaSource: `Operational records must identify repeated ${seed.minor.join(" → ")} stages rather than infer them only from the animation.`,
      phiSource: `${cycles.major.phaseSource} evidence must identify at least two repeated ${seed.major.join(" → ")} cycles.`,
      independenceClaim: "The toroidal mapping is admissible only if the minor and major phases are independently observable and jointly relevant to the same bounded system.",
    },
  };
  const protocols = scenarioModules
    .filter((module) => scenarioModuleAppliesTo(module.compatibleTemplateIds, template.id))
    .map((module) => resolveScenarioProtocol({
    systemId: seed.id,
    template,
    baseParameters: defaults,
    module,
    domainDefaultTitle: profile.defaultProtocolTitle,
    domainDefaultSummary: profile.defaultProtocolSummary,
    domainConditions: [system.boundary, system.horizon],
    domainStressors: seed.events ?? ["Pressure shock", "Feedback degradation"],
    interventionMeanings: seed.interventions ?? ["Reduce pressure", "Improve feedback fidelity", "Expand correction capacity", "Repay accumulated debt"],
    version: publishedSystemVersion,
    }));
  const watchlistTier = derivedDefaultWatchlist[seed.id];
  if (!watchlistTier) throw new Error(`Missing derived watchlist assessment for ${seed.id}`);
  const currentStateEstimate = currentStateEstimateFor(seed.id, labels, cycles);
  return {
    id: seed.id,
    version: publishedSystemVersion,
    title: profile.title,
    shortTitle: profile.shortTitle,
    summary: profile.defaultProtocolSummary,
    category: seed.category,
    watchlistTier,
    featured: Boolean(profile.featured),
    modelFamily: family,
    maintenancePatternId: family,
    calibration: "illustrative",
    difficulty: seed.difficulty ?? (watchlistTier === "red" ? "Advanced" : watchlistTier === "yellow" ? "Introductory" : "Intermediate"),
    icon: seed.icon,
    accent: seed.accent,
    optimizedOutcome: profile.objective,
    viableRegion,
    hiddenConstraint: `${seed.meanings.e}; delayed or incomplete signals can hide deterioration`,
    debtMechanism: seed.meanings.d,
    irreversibleMechanism: seed.meanings.l,
    interventionIds: standardInterventionIds,
    events: seed.events ?? ["Pressure shock", "Feedback degradation", "Correction investment"],
    interventions: seed.interventions ?? ["Reduce pressure", "Improve feedback fidelity", "Expand correction capacity", "Repay accumulated debt"],
    warningConditions: standardWarnings,
    ruptureCondition: `${seed.meanings.r} first crosses the modeled viability boundary; irreversible rupture is declared only after the scenario's persistent-loss policy also fires.`,
    recoveryCondition: `A boundary crossing remains recoverable while terminal conditions have not fired and excursion and debt contract after debt-adjusted correction again exceeds divergence pressure.`,
    plainLanguageInterpretation: seed.distinctive ?? `The system can appear productive while hidden debt reduces its ability to absorb the next shock.`,
    evidence: {
      status: "illustrative",
      calibrationStatus: `Uncalibrated present-state hypothesis dated ${currentStateEstimate.asOfDate}; no external domain dataset has been fitted to these defaults or thresholds.`,
      parameterUnits: "Canonical parameters are dimensionless synthetic scales and must not be interpreted as domain measurements without a documented calibration model.",
      assumptions: [
        `The default values are a low-confidence educational estimate of a representative system as of ${currentStateEstimate.asOfDate}, not a measured state of a named real-world operator.`,
        `${seed.minor.join(" → ")} and ${seed.major.join(" → ")} are treated as distinct recurrent phases.`,
        `${seed.meanings.r} is represented by one aggregate radial state rather than observed domain telemetry.`,
        `The bounded system is operated by ${profile.operator.toLowerCase()} over ${profile.horizon.toLowerCase()}`,
        `Population and aggregation rule: ${profile.population} ${profile.aggregation}`,
      ],
      falsificationCriteria: [
        "Do not use the toroidal mapping when two distinct recurrent phases cannot be observed or operationally defined.",
        "Reject the mapping when canonical parameter changes cannot be tied to observable domain signals with known uncertainty.",
        "Do not treat simulated rankings as operational recommendations until external data and domain experts validate thresholds, units, and outcomes.",
      ],
      references: [{ title: "Toroidal Geometry in ATS/AANA/AIx — revised phase-coordinate edition", url: "/paper.pdf" }],
    },
    currentStateEstimate,
    system,
    defaultProtocolId: protocols[0].id,
    protocols,
    cycles,
    labels,
    aixLabels: familyAixLabels[family],
    ranges: normalizedRanges,
    thresholds: { warningRho: defaults.rhoCrit * 0.65, criticalRho: defaults.rhoCrit, irreversibleRho: defaults.rhoCrit * 1.35, phaseConfidenceMinimum: 0.2 },
    rupturePolicy: {
      irreversibleRho: defaults.rhoCrit * 1.35,
      ...template.rupturePolicy,
      provenance: "illustrative-scenario-policy",
      rationale: "Terminal rupture requires persistent excursion plus accumulated irreversible loss and either severe radial expansion or alignment debt; these thresholds are synthetic scenario settings, not measured domain limits.",
    },
    defaults,
    presets: protocols.map((protocol) => ({ name: protocol.title, description: protocol.summary, values: protocol.parameters })),
  };
};

const seeds: ScenarioSeed[] = [
  { id: "climate-biosphere", category: "Ecology", family: "threshold-regime-shift", icon: "◉", accent: "#ff5b57", minor: ["Observe", "Assess", "Mitigate", "Adapt", "Restore", "Monitor"], major: ["Stable climate", "Forcing", "Ecological response", "New regime", "Renewed forcing"], meanings: { p: "Emissions, extraction & land-use pressure", e: "Underestimated feedbacks & tipping elements", g: "Observation-to-policy fidelity", c: "Mitigation, adaptation & restoration", f: "Warming & socioeconomic demand change", d: "Carbon & ecological debt", l: "Difficult-to-reverse ecosystem loss", k: "Regeneration & institutional recovery", x: "Legacy carbon sensitivity", r: "Climate and biosphere overshoot" }, events: ["Extreme heat year", "Forest-sink degradation", "Permafrost release", "Rapid clean-energy transition", "Policy rollback"], interventions: ["Cut pressure", "Increase restoration", "Improve feedback-to-policy speed", "Protect ecological buffers"] },
  { id: "groundwater-depletion", category: "Ecology", family: "regenerative-stock", icon: "◌", accent: "#4fb8ff", minor: ["Extract", "Meter", "Allocate", "Conserve", "Recharge"], major: ["Wet period", "Drought", "Adaptation", "Revised demand"], majorSource: "seasonal", meanings: { p: "Agricultural, industrial & urban withdrawal", e: "Recharge and storage estimation error", g: "Metering & aquifer observability", c: "Conservation, recharge & allocation reform", f: "Drought, population & crop-demand change", d: "Storage deficit & over-allocation", l: "Compaction, subsidence & saltwater intrusion", k: "Natural recharge & demand recovery", x: "Legacy depletion pressure", r: "Aquifer drawdown and quality risk" }, interventions: ["Set pumping limits", "Managed recharge", "Crop transition", "Repair leaks", "Reform water pricing"] },
  { id: "soil-fertility", category: "Ecology", family: "regenerative-stock", icon: "⌁", accent: "#c38b4a", minor: ["Plant", "Grow", "Harvest", "Assess", "Replenish"], major: ["Season", "Climate variation", "Market response", "Land-use adaptation"], majorSource: "seasonal", meanings: { p: "Yield and harvest pressure", e: "Misreading output as soil health", g: "Soil testing & farmer feedback", c: "Rotation, cover crops & restoration", f: "Climate, price & dietary-demand drift", d: "Nutrient, organic-matter & soil debt", l: "Topsoil loss, salinization & degradation", k: "Soil regeneration rate", x: "Soil-debt yield fragility", r: "Fertility and erosion risk" }, distinctive: "Output can stay high while the viable tube thins; a drought or input shock then exposes the hidden excursion." },
  { id: "antimicrobial-resistance", category: "Healthcare", family: "resistance-contagion", icon: "✣", accent: "#ff736a", minor: ["Diagnose", "Treat", "Culture", "Review", "Revise therapy"], major: ["Drug introduction", "Selection", "Resistance spread", "Replacement treatment"], meanings: { p: "Antibiotic selection pressure", e: "Diagnostic & strain-classification error", g: "Resistance surveillance & clinical feedback", c: "Stewardship, infection control & new therapy", f: "Pathogen evolution & transmission change", d: "Resistant-organism reservoir", l: "Lost drug effectiveness & cumulative harm", k: "Susceptibility recovery & containment", x: "Resistance-reservoir amplification", r: "Treatment-failure and transmission risk" }, interventions: ["Deploy rapid diagnostics", "Strengthen stewardship", "Reduce unnecessary use", "Isolate transmission", "Introduce new therapy"] },
  { id: "information-integrity", category: "Society", family: "resistance-contagion", icon: "◫", accent: "#ff6f91", minor: ["Publish", "Distribute", "Challenge", "Verify", "Correct"], major: ["Public event", "Narrative competition", "Social adaptation", "New attention pattern"], majorSource: "policy-cycle", meanings: { p: "Engagement, virality & monetization pressure", e: "Falsehood, source & context error", g: "Fact-checking, sourcing & audit fidelity", c: "Moderation, correction & media literacy", f: "News-cycle, cultural & technology change", d: "Misinformation and trust debt", l: "Durable polarization & legitimacy damage", k: "Trust and knowledge recovery", x: "Prior-misinformation amplification", r: "Epistemic ecosystem distance" }, distinctive: "A failed ecosystem may enter a tight, highly recurrent outrage or conspiracy loop rather than becoming random." },
  { id: "institutional-trust", category: "Organizations", family: "trust-legitimacy", icon: "▥", accent: "#b987ff", minor: ["Decide", "Implement", "Review", "Appeal", "Correct", "Report"], major: ["Leadership cycle", "Policy adaptation", "Institutional renewal"], majorSource: "policy-cycle", meanings: { p: "Electoral, administrative & performance pressure", e: "Misreading compliance as legitimacy", g: "Transparency, appeals & public feedback", c: "Redress, reform & accountability", f: "Demographic, political & economic change", d: "Grievance and unresolved-failure debt", l: "Participation loss, corruption & trust collapse", k: "Trust-rebuilding capacity", x: "Historical-grievance pressure", r: "Cooperation and legitimacy risk" }, interventions: ["Independent review", "Transparent correction", "Procedural reform", "Expand appeals", "Improve service outcomes"] },

  { id: "ai-agent-ecosystems", category: "AI", family: "capability-correction", icon: "✦", accent: "#796cff", minor: ["Generate", "Verify", "Ground", "Correct", "Gate", "Monitor"], major: ["Deployment", "Distribution shift", "Evaluation", "Update"], majorSource: "estimated", meanings: { p: "Deployment, autonomy & action-speed pressure", e: "Hidden constraints, hallucination & wrong action", g: "Verifier, grounding & human-review fidelity", c: "Correction, rollback, escalation & abstention", f: "Distribution and tool-environment shift", d: "Unresolved failures & verifier misses", l: "Irreversible downstream or propagated harm", k: "Rollback and recovery effectiveness", x: "Failure-history amplification", r: "Constraint-violation severity" }, distinctive: "Coupled agents can synchronize while becoming collectively misaligned, so coordination alone is not treated as alignment." },
  { id: "public-health-preparedness", category: "Healthcare", family: "human-capacity", icon: "✚", accent: "#ff7998", minor: ["Detect", "Investigate", "Contain", "Treat", "Review"], major: ["Outbreak", "Response", "Recovery", "Preparedness decay"], meanings: { p: "Disease burden & normal-operation pressure", e: "Threat and case-classification error", g: "Surveillance & reporting fidelity", c: "Workforce, stockpiles, testing & treatment", f: "Pathogen, travel & demographic change", d: "Preparedness backlog", l: "Mortality, morbidity & trust loss", k: "Stockpile and workforce replenishment", x: "Preparedness-debt failure pressure", r: "Outbreak burden versus response capacity" } },
  { id: "energy-grid", category: "Infrastructure", family: "network-cascade", icon: "ϟ", accent: "#ffd15c", minor: ["Dispatch", "Balance", "Detect fault", "Isolate", "Restore"], major: ["Seasonal demand", "Investment", "Technology transition"], majorSource: "seasonal", meanings: { p: "Demand loading & efficiency pressure", e: "Load, asset-health & cyber-risk error", g: "Sensor, SCADA & incident-reporting fidelity", c: "Reserves, redundancy, repair & cyber response", f: "Weather, demand & generation-mix change", d: "Maintenance and cybersecurity debt", l: "Destroyed assets & cascading social loss", k: "Restoration and redundancy effectiveness", x: "Maintenance-debt cascade pressure", r: "Cascade and service-loss risk" } },
  { id: "sovereign-debt", category: "Economy", family: "financial-leverage", icon: "∿", accent: "#ffb65f", minor: ["Borrow", "Spend or invest", "Collect revenue", "Service", "Refinance"], major: ["Credit expansion", "Tightening", "Restructuring", "Recovery"], majorSource: "market-cycle", meanings: { p: "Leverage, growth & refinancing pressure", e: "Risk-model and revenue-growth error", g: "Fiscal, balance-sheet & market transparency", c: "Buffers, restructuring & fiscal space", f: "Rate, growth, capital-flow & FX change", d: "Debt overhang & unfunded obligations", l: "Default damage, trust & output loss", k: "Deleveraging and revenue recovery", x: "Debt-overhang sensitivity", r: "Liquidity and solvency excursion" } },
  { id: "semiconductor-supply-chain", category: "Infrastructure", family: "network-cascade", icon: "▦", accent: "#56c9ff", minor: ["Order", "Fabricate", "Ship", "Assemble", "Replenish"], major: ["Demand cycle", "Capacity investment", "Technology transition"], majorSource: "market-cycle", meanings: { p: "Efficiency, concentration & just-in-time pressure", e: "Demand and geopolitical-risk forecast error", g: "Supplier, inventory & logistics visibility", c: "Redundancy, reserves & diversified production", f: "Technology demand & geopolitical change", d: "Capacity backlog & concentration debt", l: "Lost fabrication capacity or knowledge", k: "Rebuilding and substitution speed", x: "Concentration-disruption coupling", r: "Shortage and production-cascade risk" } },
  { id: "fishery-management", category: "Ecology", family: "regenerative-stock", icon: "≈", accent: "#3ee0c1", version: "1.1.0", minor: ["Harvest", "Assess", "Set quota", "Enforce", "Replenish"], major: ["Season", "Migration", "Climate shift", "Ecosystem adaptation"], majorSource: "seasonal", meanings: { p: "Fishing and extraction pressure", e: "Stock-assessment and bycatch error", g: "Monitoring and enforcement fidelity", c: "Quotas, reserves & habitat restoration", f: "Warming, acidification & migration", d: "Biomass and habitat debt", l: "Breeding-stock collapse & regime change", k: "Reproduction and ecosystem recovery", x: "Depleted-stock sensitivity", r: "Biomass and ecosystem risk" }, defaults: { pressure: 1.6, error: 0.34, feedback: 0.65, correction: 0.5, drift: 0.08, omegaPhi: 0.035 } },
  { id: "housing-affordability", category: "Economy", family: "financial-leverage", icon: "⌂", accent: "#e8a86a", minor: ["Originate", "Underwrite", "Fund", "Service", "Mitigate loss", "Replenish reserve"], major: ["Credit expansion", "Rate tightening", "Construction adjustment", "Portfolio recovery"], majorSource: "market-cycle", meanings: { p: "Origination, delivery & yield pressure", e: "Credit, project-completion & affordability error", g: "Portfolio, borrower & construction visibility", c: "Liquidity, reserves, guarantees & loss mitigation", f: "Rates, costs, incomes & credit-cycle change", d: "Unfunded commitments & impaired-loan overhang", l: "Foreclosure, failed projects & permanent capital loss", k: "Reserve and portfolio recovery", x: "Commitment-solvency coupling", r: "Liquidity, delivery and solvency excursion" } },
  { id: "youth-mental-health", category: "Healthcare", family: "human-capacity", icon: "◒", accent: "#fa8fc6", minor: ["Stress", "Signal", "Cope", "Support", "Recover"], major: ["Developmental stage", "School and social context", "Identity adaptation"], meanings: { p: "Digital, academic & social pressure", e: "Symptom, need & coping misclassification", g: "Family, school & clinical feedback", c: "Therapy, support, sleep & safeguards", f: "Developmental and social-context change", d: "Sleep, stress & isolation debt", l: "Chronic impairment, crisis & lost trust", k: "Psychological and social recovery", x: "Stress-debt vulnerability", r: "Distress and loss-of-function risk" } },

  { id: "pollinator-collapse", category: "Ecology", family: "regenerative-stock", icon: "✿", accent: "#f2d35e", minor: ["Pollinate", "Reproduce", "Monitor", "Restore habitat"], major: ["Flowering season", "Land-use change", "Ecological adaptation"], majorSource: "seasonal", meanings: { p: "Pesticide and intensive-land-use pressure", e: "Decline and redundancy measurement error", g: "Biodiversity monitoring fidelity", c: "Corridors, pesticide reform & crop diversity", f: "Climate and land-use change", d: "Population and habitat debt", l: "Local extinction & lost ecological function", k: "Reproduction, migration & recolonization", x: "Surviving-diversity dependence", r: "Pollination-service network risk" } },
  { id: "education-quality", category: "Organizations", family: "human-capacity", icon: "▤", accent: "#7eb8ff", minor: ["Teach", "Assess", "Diagnose", "Remediate", "Reassess"], major: ["School year", "Cohort change", "Curriculum adaptation"], majorSource: "policy-cycle", meanings: { p: "Test, credential, throughput & budget pressure", e: "Misclassifying scores as learning", g: "Student, teacher & longitudinal feedback", c: "Remediation, tutoring & curriculum reform", f: "Technology, labor & cohort change", d: "Learning-gap and teacher-capacity debt", l: "Lost epistemic capacity & trust", k: "Learning and teacher recovery", x: "Foundational-deficit compounding", r: "Distance from robust learning capacity" } },
  { id: "healthcare-workforce", category: "Healthcare", family: "human-capacity", icon: "+", accent: "#ff7e9d", minor: ["Provide care", "Review", "Rest", "Correct staffing", "Return"], major: ["Demand growth", "Recruitment", "Training", "Workforce renewal"], meanings: { p: "Volume, burden & productivity pressure", e: "Workload, safety & burnout measurement error", g: "Incident and workforce-feedback quality", c: "Staffing, rest, retention & training", f: "Demographic and disease-burden change", d: "Burnout, vacancy & training backlog", l: "Experienced-worker loss & lasting harm", k: "Workforce replenishment and recovery", x: "Burnout-error workload loop", r: "Staffing-strain and patient-safety risk" } },
  { id: "aging-infrastructure", category: "Infrastructure", family: "network-cascade", icon: "▧", accent: "#e8b069", minor: ["Use", "Inspect", "Maintain", "Repair", "Recertify"], major: ["Demand growth", "Capital planning", "Replacement cycle"], majorSource: "policy-cycle", meanings: { p: "Utilization and efficiency pressure", e: "Condition and hidden-defect error", g: "Inspection and sensor fidelity", c: "Maintenance, repair, replacement & redundancy", f: "Climate, population & demand change", d: "Deferred-maintenance debt", l: "Capacity loss & catastrophic failure", k: "Repair and replacement speed", x: "Maintenance-cascade coupling", r: "Failure and service-disruption risk" } },
  { id: "water-quality", category: "Ecology", family: "threshold-regime-shift", icon: "≋", accent: "#45cad8", minor: ["Discharge", "Detect", "Treat", "Regulate", "Restore"], major: ["Hydrologic cycle", "Land-use change", "Ecosystem adaptation"], majorSource: "seasonal", meanings: { p: "Agricultural, industrial & urban pollution", e: "Contaminant and impact-classification error", g: "Testing, monitoring & reporting fidelity", c: "Treatment, enforcement, cleanup & wetlands", f: "Rainfall, temperature & land-use change", d: "Sediment and contaminant accumulation", l: "Persistent contamination & regime shift", k: "Flushing and bioremediation", x: "Stored-contaminant exposure", r: "Contamination and public-health risk" } },
  { id: "geopolitical-escalation", category: "Society", family: "resistance-contagion", icon: "⇄", accent: "#ff8d68", minor: ["Signal", "Interpret", "Respond", "Communicate", "De-escalate"], major: ["Election", "Alliance change", "Leadership change", "Security cycle"], majorSource: "policy-cycle", meanings: { p: "Military, political & retaliation pressure", e: "Intent and threat misclassification", g: "Intelligence, verification & diplomacy", c: "Mediation, verification & de-escalation", f: "Leadership, alliance & crisis change", d: "Arms buildup and grievance debt", l: "War damage and durable trust collapse", k: "Diplomatic normalization and recovery", x: "Grievance-escalation coupling", r: "Escalation and conflict risk" }, distinctive: "Defensive and retaliatory phases may lock into a stable but dangerous recurrent cycle." },
  { id: "disaster-insurance", category: "Economy", family: "financial-leverage", icon: "◈", accent: "#dca765", minor: ["Price risk", "Collect premium", "Pay claim", "Reprice"], major: ["Disaster cycle", "Asset adaptation", "Regulatory response"], majorSource: "market-cycle", meanings: { p: "Return, share & underwriting pressure", e: "Catastrophe-model and exposure error", g: "Claims, exposure & hazard-data quality", c: "Reserves, reinsurance, repricing & backstop", f: "Hazard, inflation & asset migration", d: "Underpriced risk and coverage gaps", l: "Insolvency, withdrawal & uninsured loss", k: "Capital replenishment and market recovery", x: "Underpricing-solvency coupling", r: "Solvency and coverage-access risk" } },
  { id: "data-governance", category: "Society", family: "trust-legitimacy", icon: "▣", accent: "#9c88ff", minor: ["Collect", "Use", "Audit", "Correct or delete", "Review"], major: ["Technology adoption", "Normalization", "Regulation", "New norm"], majorSource: "policy-cycle", meanings: { p: "Monetization, surveillance & AI-data pressure", e: "Consent, downstream-use & privacy-risk error", g: "Audit, provenance & user-control fidelity", c: "Minimization, deletion, security & redress", f: "Technological and regulatory change", d: "Exposure and data-dependency debt", l: "Irreversible diffusion & rights erosion", k: "Trust and governance recovery", x: "Infrastructure path dependence", r: "Privacy, legitimacy and governance risk" } },

  { id: "llm-deployment", category: "AI", family: "capability-correction", icon: "✦", accent: "#7b6cff", version: "1.1.0", difficulty: "Intermediate", minor: ["Generate", "Verify", "Retrieve", "Revise", "Gate"], major: ["User-context change", "Distribution shift", "Model update"], majorSource: "estimated", meanings: { p: "Response speed & automation pressure", e: "Hallucination & hidden-constraint error", g: "Retrieval and verifier fidelity", c: "Correction iterations & human escalation", f: "User-context and distribution shift", d: "Unresolved failure patterns", l: "Irreversible downstream action", k: "Rollback and recovery effectiveness", x: "Failure-history amplification", r: "Output-risk severity" }, defaults: {}, distinctive: "Fast deployment can look productive while unresolved failures make future correction harder." },
  { id: "coding-agent", category: "AI", family: "capability-correction", icon: "⌘", accent: "#36d7ff", version: "1.1.0", difficulty: "Advanced", minor: ["Inspect", "Reason", "Edit", "Test", "Correct", "Submit"], major: ["Task evolution", "Repository change", "Dependency change"], majorSource: "estimated", meanings: { p: "Task and time pressure", e: "Localization or causal-diagnosis error", g: "Test coverage and tool feedback", c: "Iteration, rollback & verifier depth", f: "Task, repository & dependency change", d: "Regressions and failed-edit debt", l: "Destructive repository action", k: "Rollback and repair effectiveness", x: "Regression amplification", r: "Repository-change risk" }, defaults: { pressure: 1.8, error: 0.28, feedback: 0.68, correction: 0.5, omegaTheta: 0.12 }, distinctive: "A rigid repeated debugging loop can be highly recurrent without becoming correct." },
  { id: "startup-growth", category: "Organizations", family: "human-capacity", icon: "↗", accent: "#9ee45e", version: "1.1.0", difficulty: "Introductory", minor: ["Build", "Release", "Observe", "Repair"], major: ["Funding", "Growth", "Competition", "Strategic adaptation"], majorSource: "market-cycle", meanings: { p: "Growth and investor pressure", e: "Market, culture & technical-risk error", g: "Customer and employee feedback", c: "QA, support, repair & leadership response", f: "Funding, competition & market change", d: "Technical, cultural & operational debt", l: "Trust, key-person or incident loss", k: "Operating and organizational recovery", x: "Debt-driven fragility", r: "Product and organizational instability" }, defaults: { pressure: 1.9, feedback: 0.56, correction: 0.48, drift: 0.07 } },
  { id: "hospital-throughput", category: "Healthcare", family: "human-capacity", icon: "+", accent: "#ff6d9f", version: "1.1.0", difficulty: "Advanced", minor: ["Admit", "Triage", "Treat", "Discharge", "Review"], major: ["Demand cycle", "Staffing adaptation"], majorSource: "seasonal", meanings: { p: "Throughput and occupancy pressure", e: "Triage and demand-estimation error", g: "Patient-safety and incident feedback", c: "Staffing, beds, escalation & quality review", f: "Daily and seasonal demand change", d: "Treatment backlog & staff exhaustion", l: "Preventable harm & workforce attrition", k: "Clinical and staffing recovery", x: "Backlog-safety coupling", r: "Clinical-risk excursion" }, defaults: { pressure: 1.72, error: 0.3, feedback: 0.6, correction: 0.47, drift: 0.09, rhoCrit: 2.15 } },
  { id: "burnout-recovery", category: "Healthcare", family: "human-capacity", icon: "◒", accent: "#ffb44a", version: "1.1.0", difficulty: "Introductory", minor: ["Effort", "Fatigue", "Rest", "Recovery", "Return"], major: ["Work cycle", "Life transition", "Adaptation"], meanings: { p: "Workload and performance pressure", e: "Misreading exhaustion as low motivation", g: "Bodily, emotional & social feedback", c: "Sleep, boundaries, support & workload reduction", f: "Work and life-context change", d: "Sleep and stress debt", l: "Lasting health or relationship damage", k: "Physiological and social recovery", x: "Stress-debt vulnerability", r: "Physiological and psychological strain" }, defaults: { pressure: 1.55, feedback: 0.58, correction: 0.42, initialDebt: 0.38, beta: 0.07 } },
  { id: "public-transit", category: "Infrastructure", family: "network-cascade", icon: "▰", accent: "#55b9ff", minor: ["Operate", "Inspect", "Maintain", "Restore"], major: ["Ridership growth", "Budget", "Fleet renewal"], majorSource: "policy-cycle", meanings: { p: "Service-frequency & utilization pressure", e: "Condition and demand error", g: "Maintenance and rider-feedback fidelity", c: "Crews, spares & preventive maintenance", f: "Ridership, budget & fleet change", d: "Deferred-maintenance backlog", l: "Asset loss & public-trust erosion", k: "Repair and fleet-renewal speed", x: "Backlog-reliability coupling", r: "Reliability and safety risk" } },
  { id: "engagement-recommender", category: "AI", family: "capability-correction", icon: "◎", accent: "#c16dff", minor: ["Recommend", "Observe", "Update", "Moderate"], major: ["Cultural event", "Behavior change", "Model update"], majorSource: "estimated", meanings: { p: "Engagement pressure", e: "Misclassifying attention as wellbeing", g: "User-harm and information feedback", c: "Moderation, constraints, diversity & intervention", f: "Cultural and behavioral change", d: "Polarization, addiction & trust debt", l: "Durable social and cognitive harm", k: "Trust and attention recovery", x: "Polarization amplification", r: "Information and human-impact risk" } },
  { id: "urban-reservoir", category: "Ecology", family: "regenerative-stock", icon: "≈", accent: "#38c6e3", minor: ["Consume", "Monitor", "Restrict", "Replenish"], major: ["Seasonal rainfall", "Drought", "Adaptation"], majorSource: "seasonal", meanings: { p: "Municipal and agricultural demand", e: "Forecast and leakage error", g: "Metering and reservoir monitoring", c: "Conservation, reuse & infrastructure repair", f: "Rainfall, drought & demand change", d: "Accumulated storage deficit", l: "Ecosystem or infrastructure damage", k: "Recharge and storage recovery", x: "Deficit-driven supply pressure", r: "Reservoir supply risk" } },
  { id: "emergency-response", category: "Infrastructure", family: "network-cascade", icon: "✥", accent: "#ff7c5f", minor: ["Detect", "Dispatch", "Coordinate", "Stabilize", "Review"], major: ["Event season", "Preparedness cycle", "Institutional learning"], majorSource: "seasonal", meanings: { p: "Incident load", e: "Situational-awareness error", g: "Communications and field-report fidelity", c: "Personnel, transport, coordination & supplies", f: "Event and preparedness-context change", d: "Fatigue and incident backlog", l: "Preventable casualties & infrastructure loss", k: "Personnel and network recovery", x: "Backlog-cascade coupling", r: "Response-network overload risk" } },
  { id: "research-integrity", category: "Organizations", family: "trust-legitimacy", icon: "⚗", accent: "#78c6ff", minor: ["Hypothesize", "Test", "Review", "Replicate", "Revise"], major: ["Funding cycle", "Research trend", "Method adaptation"], majorSource: "policy-cycle", meanings: { p: "Publication, prestige & funding pressure", e: "Model, measurement & interpretation error", g: "Replication, peer review & data transparency", c: "Correction, retraction & methodological reform", f: "Funding and research-trend change", d: "Unreplicated findings & method debt", l: "Trust loss & entrenched false knowledge", k: "Replication and institutional recovery", x: "Literature-debt amplification", r: "Research-integrity risk" } },
];

const publishedCandidates: ScenarioDefinition[] = seeds.filter((seed) => isPublishedSystemId(seed.id)).map(makeScenario);
assertPublishedTorusEligibility(publishedCandidates);

export const scenarios: ScenarioDefinition[] = publishedCandidates;

export const scenarioById = Object.fromEntries(
  scenarios.map((scenario) => [scenario.id, scenario]),
) as Record<string, ScenarioDefinition>;

export const scenarioCategories = Array.from(new Set(scenarios.map((scenario) => scenario.category)));
export const watchlistCounts = scenarios.reduce<Record<WatchlistTier, number>>((counts, scenario) => {
  counts[scenario.watchlistTier] += 1;
  return counts;
}, { red: 0, orange: 0, yellow: 0 });

export const featuredSystemCount = scenarios.filter((scenario) => scenario.featured).length;
