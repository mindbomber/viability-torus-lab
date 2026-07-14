import { defaultParameters, type SimulationParameters } from "../engine/simulator.ts";
import type {
  ModelFamily,
  PhaseSource,
  ScenarioCategory,
  ScenarioDefinition,
  WatchlistTier,
} from "../contracts/types.ts";

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
  title: string;
  shortTitle: string;
  summary: string;
  category: ScenarioCategory;
  tier: WatchlistTier;
  family: ModelFamily;
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

const normalizedRanges: ScenarioDefinition["ranges"] = {
  pressure: { min: 0, max: 2, step: 0.01 },
  error: { min: 0, max: 1, step: 0.01 },
  feedback: { min: 0, max: 1, step: 0.01 },
  correction: { min: 0, max: 2, step: 0.01 },
  drift: { min: 0, max: 0.5, step: 0.01 },
  irreversibleLoss: { min: 0, max: 0.5, step: 0.01 },
  initialDebt: { min: 0, max: 2, step: 0.01 },
};

const tierDefaults: Record<Exclude<WatchlistTier, "featured">, Partial<SimulationParameters>> = {
  red: { pressure: 1.5, error: 0.55, feedback: 0.35, correction: 0.72, drift: 0.22, initialDebt: 1, irreversibleLoss: 0.18, kappa: 0.1, chi: 0.35 },
  orange: { pressure: 1.25, error: 0.4, feedback: 0.55, correction: 0.62, drift: 0.16, initialDebt: 0.55, irreversibleLoss: 0.08, kappa: 0.15, chi: 0.28 },
  yellow: { pressure: 1, error: 0.25, feedback: 0.7, correction: 0.8, drift: 0.1, initialDebt: 0.25, irreversibleLoss: 0.03, kappa: 0.2, chi: 0.2 },
};

const familyDynamics: Record<ModelFamily, Partial<SimulationParameters>> = {
  "regenerative-stock": { kappa: 0.12, chi: 0.3, beta: 0.06, omegaPhi: 0.035 },
  "threshold-regime-shift": { kappa: 0.08, chi: 0.4, beta: 0.04, couplingA: 0.055, couplingB: 0.045 },
  "resistance-contagion": { kappa: 0.14, chi: 0.32, couplingA: 0.06, couplingB: 0.055 },
  "trust-legitimacy": { kappa: 0.12, chi: 0.34, beta: 0.055, omegaPhi: 0.04 },
  "capability-correction": { kappa: 0.22, chi: 0.18, omegaTheta: 0.12, omegaPhi: 0.055 },
  "network-cascade": { kappa: 0.18, chi: 0.3, couplingA: 0.05, couplingB: 0.05 },
  "financial-leverage": { kappa: 0.15, chi: 0.34, beta: 0.065, omegaPhi: 0.045 },
  "human-capacity": { kappa: 0.2, chi: 0.25, beta: 0.075, omegaPhi: 0.04 },
};

const familyAixLabels: Record<ModelFamily, ScenarioDefinition["aixLabels"]> = {
  "regenerative-stock": { physical: "Resource stock and physical feasibility", biological: "Ecological and human-health viability", constructed: "Production or service delivery", feedback: "Monitoring and enforcement integrity" },
  "threshold-regime-shift": { physical: "Physical boundary and regime stability", biological: "Ecological and human viability", constructed: "Adaptation and service coherence", feedback: "Early-warning and monitoring integrity" },
  "resistance-contagion": { physical: "Transmission and state evidence", biological: "Health, cognition, and social viability", constructed: "Containment and response performance", feedback: "Surveillance, grounding, and audit integrity" },
  "trust-legitimacy": { physical: "Service feasibility and objective evidence", biological: "Dignity, wellbeing, and social viability", constructed: "Procedural and institutional coherence", feedback: "Transparency, appeals, and public feedback" },
  "capability-correction": { physical: "Factual and technical validity", biological: "Safety and human impact", constructed: "Task or platform performance", feedback: "Verifier, grounding, and audit integrity" },
  "network-cascade": { physical: "Physical condition and capacity", biological: "Public safety and access", constructed: "Service continuity", feedback: "Inspection, telemetry, and incident reporting" },
  "financial-leverage": { physical: "Real resource and cash-flow feasibility", biological: "Household and social impact", constructed: "Market and contract functioning", feedback: "Balance-sheet and risk transparency" },
  "human-capacity": { physical: "Material service capacity", biological: "Health, learning, dignity, and wellbeing", constructed: "Institutional and operational coherence", feedback: "Human feedback and outcome visibility" },
};

const phaseSourceFor = (seed: ScenarioSeed): PhaseSource => seed.majorSource ?? (
  seed.family === "financial-leverage" ? "market-cycle" :
  seed.category === "Organizations" || seed.category === "Society" ? "policy-cycle" :
  seed.category === "Ecology" || seed.category === "Healthcare" ? "seasonal" : "estimated"
);

const growthAtRiskByTier: Record<WatchlistTier, Partial<SimulationParameters>> = {
  red: { pressure: 1.8, error: 0.62, feedback: 0.3, correction: 0.58, initialDebt: 1.2, drift: 0.25, irreversibleLoss: 0.2 },
  orange: { pressure: 1.45, error: 0.4, feedback: 0.5, correction: 0.58, initialDebt: 0.65, drift: 0.12, irreversibleLoss: 0.06 },
  yellow: { pressure: 1.25, error: 0.32, feedback: 0.58, correction: 0.62, initialDebt: 0.45, drift: 0.1, irreversibleLoss: 0.04 },
  featured: { pressure: 2.35, feedback: 0.42, correction: 0.42, initialDebt: 0.34 },
};

const scenarioPresets = (tier: WatchlistTier): ScenarioDefinition["presets"] => [
  { name: "Balanced", description: "Correction keeps pace with divergence in this synthetic mapping.", values: { pressure: 1, error: 0.22, feedback: 0.78, correction: 0.82, initialDebt: 0.12, drift: 0.06, irreversibleLoss: 0.02 } },
  { name: "Growth at risk", description: "High pressure, weak feedback, and a narrowing correction margin.", values: growthAtRiskByTier[tier] },
  { name: "Recovery", description: "Debt is elevated but feedback and correction have been reinforced.", values: { pressure: 0.82, error: 0.2, feedback: 0.86, correction: 1.02, initialDebt: 0.9, drift: 0.05, irreversibleLoss: 0.01, beta: 0.18 } },
];

const makeScenario = (seed: ScenarioSeed): ScenarioDefinition => {
  const defaults = {
    ...defaultParameters,
    ...(seed.tier === "featured" ? {} : tierDefaults[seed.tier]),
    ...familyDynamics[seed.family],
    ...seed.defaults,
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
  return {
    id: seed.id,
    version: seed.version ?? "1.0.0",
    title: seed.title,
    shortTitle: seed.shortTitle,
    summary: seed.summary,
    category: seed.category,
    watchlistTier: seed.tier,
    modelFamily: seed.family,
    calibration: "illustrative",
    difficulty: seed.difficulty ?? (seed.tier === "red" ? "Advanced" : seed.tier === "yellow" ? "Introductory" : "Intermediate"),
    icon: seed.icon,
    accent: seed.accent,
    optimizedOutcome: `Viable ${seed.shortTitle.toLowerCase()} performance over time`,
    viableRegion: `Operation within a recoverable range of ${seed.meanings.r.toLowerCase()}`,
    hiddenConstraint: `${seed.meanings.e}; delayed or incomplete signals can hide deterioration`,
    debtMechanism: seed.meanings.d,
    irreversibleMechanism: seed.meanings.l,
    interventionIds: standardInterventionIds,
    events: seed.events ?? ["Pressure shock", "Feedback degradation", "Correction investment"],
    interventions: seed.interventions ?? ["Reduce pressure", "Improve feedback fidelity", "Expand correction capacity", "Repay accumulated debt"],
    warningConditions: standardWarnings,
    ruptureCondition: `${seed.meanings.r} crosses the critical modeled viability boundary after correction remains below divergence.`,
    recoveryCondition: `Excursion and debt contract after feedback and correction again exceed divergence pressure.`,
    plainLanguageInterpretation: seed.distinctive ?? `The system can appear productive while hidden debt reduces its ability to absorb the next shock.`,
    evidence: {
      status: "illustrative",
      calibrationStatus: "Uncalibrated synthetic mapping; no external domain dataset has been fitted to these defaults or thresholds.",
      parameterUnits: "Canonical parameters are dimensionless synthetic scales and must not be interpreted as domain measurements without a documented calibration model.",
      assumptions: [
        `${seed.minor.join(" → ")} and ${seed.major.join(" → ")} are treated as distinct recurrent phases.`,
        `${seed.meanings.r} is represented by one aggregate radial state rather than observed domain telemetry.`,
      ],
      falsificationCriteria: [
        "Do not use the toroidal mapping when two distinct recurrent phases cannot be observed or operationally defined.",
        "Reject the mapping when canonical parameter changes cannot be tied to observable domain signals with known uncertainty.",
        "Do not treat simulated rankings as operational recommendations until external data and domain experts validate thresholds, units, and outcomes.",
      ],
      references: [{ title: "Toroidal Geometry in ATS/AANA/AIx — revised phase-coordinate edition", url: "/paper.pdf" }],
    },
    cycles: {
      minor: { label: seed.minor.join(" → "), stages: seed.minor, description: "Local operational correction cycle", defaultFrequency: defaults.omegaTheta, phaseSource: "operational-stage" },
      major: { label: seed.major.join(" → "), stages: seed.major, description: "External adaptation cycle", defaultFrequency: defaults.omegaPhi, phaseSource: phaseSourceFor(seed) },
    },
    labels,
    aixLabels: familyAixLabels[seed.family],
    ranges: normalizedRanges,
    thresholds: { warningRho: defaults.rhoCrit * 0.65, criticalRho: defaults.rhoCrit, irreversibleRho: defaults.rhoCrit * 1.35, phaseConfidenceMinimum: 0.2 },
    defaults,
    presets: scenarioPresets(seed.tier),
  };
};

const seeds: ScenarioSeed[] = [
  { id: "climate-biosphere", title: "Climate System & Biosphere Stability", shortTitle: "Climate & Biosphere", summary: "Explore mitigation, adaptation, ecological debt, and threshold behavior under sustained forcing.", category: "Ecology", tier: "red", family: "threshold-regime-shift", icon: "◉", accent: "#ff5b57", minor: ["Observe", "Assess", "Mitigate", "Adapt", "Restore", "Monitor"], major: ["Stable climate", "Forcing", "Ecological response", "New regime", "Renewed forcing"], meanings: { p: "Emissions, extraction & land-use pressure", e: "Underestimated feedbacks & tipping elements", g: "Observation-to-policy fidelity", c: "Mitigation, adaptation & restoration", f: "Warming & socioeconomic demand change", d: "Carbon & ecological debt", l: "Difficult-to-reverse ecosystem loss", k: "Regeneration & institutional recovery", x: "Legacy carbon sensitivity", r: "Climate and biosphere overshoot" }, events: ["Extreme heat year", "Forest-sink degradation", "Permafrost release", "Rapid clean-energy transition", "Policy rollback"], interventions: ["Cut pressure", "Increase restoration", "Improve feedback-to-policy speed", "Protect ecological buffers"] },
  { id: "groundwater-depletion", title: "Groundwater & Freshwater Depletion", shortTitle: "Groundwater Depletion", summary: "Test withdrawal, recharge, drought, and allocation strategies around a recoverable aquifer state.", category: "Ecology", tier: "red", family: "regenerative-stock", icon: "◌", accent: "#4fb8ff", minor: ["Extract", "Meter", "Allocate", "Conserve", "Recharge"], major: ["Wet period", "Drought", "Adaptation", "Revised demand"], majorSource: "seasonal", meanings: { p: "Agricultural, industrial & urban withdrawal", e: "Recharge and storage estimation error", g: "Metering & aquifer observability", c: "Conservation, recharge & allocation reform", f: "Drought, population & crop-demand change", d: "Storage deficit & over-allocation", l: "Compaction, subsidence & saltwater intrusion", k: "Natural recharge & demand recovery", x: "Legacy depletion pressure", r: "Aquifer drawdown and quality risk" }, interventions: ["Set pumping limits", "Managed recharge", "Crop transition", "Repair leaks", "Reform water pricing"] },
  { id: "soil-fertility", title: "Soil Fertility & Food-System Resilience", shortTitle: "Soil Resilience", summary: "Explore how yield can remain high while soil debt quietly thins the viable operating region.", category: "Ecology", tier: "red", family: "regenerative-stock", icon: "⌁", accent: "#c38b4a", minor: ["Plant", "Grow", "Harvest", "Assess", "Replenish"], major: ["Season", "Climate variation", "Market response", "Land-use adaptation"], majorSource: "seasonal", meanings: { p: "Yield and harvest pressure", e: "Misreading output as soil health", g: "Soil testing & farmer feedback", c: "Rotation, cover crops & restoration", f: "Climate, price & dietary-demand drift", d: "Nutrient, organic-matter & soil debt", l: "Topsoil loss, salinization & degradation", k: "Soil regeneration rate", x: "Soil-debt yield fragility", r: "Fertility and erosion risk" }, distinctive: "Output can stay high while the viable tube thins; a drought or input shock then exposes the hidden excursion." },
  { id: "antimicrobial-resistance", title: "Antimicrobial Resistance", shortTitle: "Antimicrobial Resistance", summary: "Model diagnosis, stewardship, resistance surveillance, and treatment loss across recurrent selection cycles.", category: "Healthcare", tier: "red", family: "resistance-contagion", icon: "✣", accent: "#ff736a", minor: ["Diagnose", "Treat", "Culture", "Review", "Revise therapy"], major: ["Drug introduction", "Selection", "Resistance spread", "Replacement treatment"], meanings: { p: "Antibiotic selection pressure", e: "Diagnostic & strain-classification error", g: "Resistance surveillance & clinical feedback", c: "Stewardship, infection control & new therapy", f: "Pathogen evolution & transmission change", d: "Resistant-organism reservoir", l: "Lost drug effectiveness & cumulative harm", k: "Susceptibility recovery & containment", x: "Resistance-reservoir amplification", r: "Treatment-failure and transmission risk" }, interventions: ["Deploy rapid diagnostics", "Strengthen stewardship", "Reduce unnecessary use", "Isolate transmission", "Introduce new therapy"] },
  { id: "information-integrity", title: "Information Integrity & Attention Ecosystems", shortTitle: "Information Integrity", summary: "Explore virality, correction, trust debt, and recurrent narrative lock-in across an attention ecosystem.", category: "Society", tier: "red", family: "resistance-contagion", icon: "◫", accent: "#ff6f91", minor: ["Publish", "Distribute", "Challenge", "Verify", "Correct"], major: ["Public event", "Narrative competition", "Social adaptation", "New attention pattern"], majorSource: "policy-cycle", meanings: { p: "Engagement, virality & monetization pressure", e: "Falsehood, source & context error", g: "Fact-checking, sourcing & audit fidelity", c: "Moderation, correction & media literacy", f: "News-cycle, cultural & technology change", d: "Misinformation and trust debt", l: "Durable polarization & legitimacy damage", k: "Trust and knowledge recovery", x: "Prior-misinformation amplification", r: "Epistemic ecosystem distance" }, distinctive: "A failed ecosystem may enter a tight, highly recurrent outrage or conspiracy loop rather than becoming random." },
  { id: "institutional-trust", title: "Institutional Trust & Democratic Legitimacy", shortTitle: "Institutional Trust", summary: "Test whether transparency, appeals, redress, and service correction can repay accumulated legitimacy debt.", category: "Organizations", tier: "red", family: "trust-legitimacy", icon: "▥", accent: "#b987ff", minor: ["Decide", "Implement", "Review", "Appeal", "Correct", "Report"], major: ["Leadership cycle", "Policy adaptation", "Institutional renewal"], majorSource: "policy-cycle", meanings: { p: "Electoral, administrative & performance pressure", e: "Misreading compliance as legitimacy", g: "Transparency, appeals & public feedback", c: "Redress, reform & accountability", f: "Demographic, political & economic change", d: "Grievance and unresolved-failure debt", l: "Participation loss, corruption & trust collapse", k: "Trust-rebuilding capacity", x: "Historical-grievance pressure", r: "Cooperation and legitimacy risk" }, interventions: ["Independent review", "Transparent correction", "Procedural reform", "Expand appeals", "Improve service outcomes"] },

  { id: "ai-agent-ecosystems", title: "AI Alignment & Autonomous-Agent Ecosystems", shortTitle: "AI Agent Ecosystems", summary: "Explore capability pressure, verifier fidelity, rollback, and propagated failure in coupled agent systems.", category: "AI", tier: "orange", family: "capability-correction", icon: "✦", accent: "#796cff", minor: ["Generate", "Verify", "Ground", "Correct", "Gate", "Monitor"], major: ["Deployment", "Distribution shift", "Evaluation", "Update"], majorSource: "estimated", meanings: { p: "Deployment, autonomy & action-speed pressure", e: "Hidden constraints, hallucination & wrong action", g: "Verifier, grounding & human-review fidelity", c: "Correction, rollback, escalation & abstention", f: "Distribution and tool-environment shift", d: "Unresolved failures & verifier misses", l: "Irreversible downstream or propagated harm", k: "Rollback and recovery effectiveness", x: "Failure-history amplification", r: "Constraint-violation severity" }, distinctive: "Coupled agents can synchronize while becoming collectively misaligned, so coordination alone is not treated as alignment." },
  { id: "public-health-preparedness", title: "Public-Health Preparedness", shortTitle: "Public-Health Preparedness", summary: "Model detection, containment, replenishment, and preparedness decay across recurring outbreak cycles.", category: "Healthcare", tier: "orange", family: "human-capacity", icon: "✚", accent: "#ff7998", minor: ["Detect", "Investigate", "Contain", "Treat", "Review"], major: ["Outbreak", "Response", "Recovery", "Preparedness decay"], meanings: { p: "Disease burden & normal-operation pressure", e: "Threat and case-classification error", g: "Surveillance & reporting fidelity", c: "Workforce, stockpiles, testing & treatment", f: "Pathogen, travel & demographic change", d: "Preparedness backlog", l: "Mortality, morbidity & trust loss", k: "Stockpile and workforce replenishment", x: "Preparedness-debt failure pressure", r: "Outbreak burden versus response capacity" } },
  { id: "energy-grid", title: "Energy Grid & Cyber-Physical Infrastructure", shortTitle: "Energy Grid", summary: "Explore reserve margins, telemetry, maintenance debt, and cascade risk during demand and weather change.", category: "Infrastructure", tier: "orange", family: "network-cascade", icon: "ϟ", accent: "#ffd15c", minor: ["Dispatch", "Balance", "Detect fault", "Isolate", "Restore"], major: ["Seasonal demand", "Investment", "Technology transition"], majorSource: "seasonal", meanings: { p: "Demand loading & efficiency pressure", e: "Load, asset-health & cyber-risk error", g: "Sensor, SCADA & incident-reporting fidelity", c: "Reserves, redundancy, repair & cyber response", f: "Weather, demand & generation-mix change", d: "Maintenance and cybersecurity debt", l: "Destroyed assets & cascading social loss", k: "Restoration and redundancy effectiveness", x: "Maintenance-debt cascade pressure", r: "Cascade and service-loss risk" } },
  { id: "sovereign-debt", title: "Financial Leverage & Sovereign-Debt Fragility", shortTitle: "Sovereign Debt", summary: "Explore leverage, refinancing, transparency, buffers, and debt-overhang path dependence.", category: "Economy", tier: "orange", family: "financial-leverage", icon: "∿", accent: "#ffb65f", minor: ["Borrow", "Spend or invest", "Collect revenue", "Service", "Refinance"], major: ["Credit expansion", "Tightening", "Restructuring", "Recovery"], majorSource: "market-cycle", meanings: { p: "Leverage, growth & refinancing pressure", e: "Risk-model and revenue-growth error", g: "Fiscal, balance-sheet & market transparency", c: "Buffers, restructuring & fiscal space", f: "Rate, growth, capital-flow & FX change", d: "Debt overhang & unfunded obligations", l: "Default damage, trust & output loss", k: "Deleveraging and revenue recovery", x: "Debt-overhang sensitivity", r: "Liquidity and solvency excursion" } },
  { id: "semiconductor-supply-chain", title: "Semiconductor & Supply-Chain Concentration", shortTitle: "Semiconductor Supply", summary: "Model concentration, capacity backlog, logistics visibility, and cascading production shortages.", category: "Infrastructure", tier: "orange", family: "network-cascade", icon: "▦", accent: "#56c9ff", minor: ["Order", "Fabricate", "Ship", "Assemble", "Replenish"], major: ["Demand cycle", "Capacity investment", "Technology transition"], majorSource: "market-cycle", meanings: { p: "Efficiency, concentration & just-in-time pressure", e: "Demand and geopolitical-risk forecast error", g: "Supplier, inventory & logistics visibility", c: "Redundancy, reserves & diversified production", f: "Technology demand & geopolitical change", d: "Capacity backlog & concentration debt", l: "Lost fabrication capacity or knowledge", k: "Rebuilding and substitution speed", x: "Concentration-disruption coupling", r: "Shortage and production-cascade risk" } },
  { id: "fishery-management", title: "Ocean Ecosystems & Fisheries", shortTitle: "Fishery Management", summary: "Explore sustainable harvest, stock uncertainty, enforcement, climate drift, and breeding-stock debt.", category: "Ecology", tier: "orange", family: "regenerative-stock", icon: "≈", accent: "#3ee0c1", version: "1.1.0", minor: ["Harvest", "Assess", "Set quota", "Enforce", "Replenish"], major: ["Season", "Migration", "Climate shift", "Ecosystem adaptation"], majorSource: "seasonal", meanings: { p: "Fishing and extraction pressure", e: "Stock-assessment and bycatch error", g: "Monitoring and enforcement fidelity", c: "Quotas, reserves & habitat restoration", f: "Warming, acidification & migration", d: "Biomass and habitat debt", l: "Breeding-stock collapse & regime change", k: "Reproduction and ecosystem recovery", x: "Depleted-stock sensitivity", r: "Biomass and ecosystem risk" }, defaults: { pressure: 1.6, error: 0.34, feedback: 0.65, correction: 0.5, drift: 0.08, omegaPhi: 0.035 } },
  { id: "housing-affordability", title: "Housing Affordability & Urban Social Stability", shortTitle: "Housing Affordability", summary: "Explore supply, speculation, displacement debt, community loss, and slow policy adaptation.", category: "Economy", tier: "orange", family: "financial-leverage", icon: "⌂", accent: "#e8a86a", minor: ["Demand", "Price", "Plan", "Build", "Occupy", "Adjust"], major: ["Demographic growth", "Neighborhood transition", "Policy adaptation"], majorSource: "market-cycle", meanings: { p: "Demand, speculation & yield pressure", e: "Misreading output as affordability", g: "Rent, vacancy & displacement data quality", c: "Building, reform, subsidy & protection", f: "Population, rates, wages & migration", d: "Underbuilding and displacement debt", l: "Community loss & chronic homelessness", k: "Supply and community recovery", x: "Scarcity path dependence", r: "Affordability and displacement risk" } },
  { id: "youth-mental-health", title: "Youth Mental Health & Digital Dependency", shortTitle: "Youth Mental Health", summary: "Explore stress, coping, support, developmental change, and accumulated sleep and isolation debt.", category: "Healthcare", tier: "orange", family: "human-capacity", icon: "◒", accent: "#fa8fc6", minor: ["Stress", "Signal", "Cope", "Support", "Recover"], major: ["Developmental stage", "School and social context", "Identity adaptation"], meanings: { p: "Digital, academic & social pressure", e: "Symptom, need & coping misclassification", g: "Family, school & clinical feedback", c: "Therapy, support, sleep & safeguards", f: "Developmental and social-context change", d: "Sleep, stress & isolation debt", l: "Chronic impairment, crisis & lost trust", k: "Psychological and social recovery", x: "Stress-debt vulnerability", r: "Distress and loss-of-function risk" } },

  { id: "pollinator-collapse", title: "Pollinator Collapse & Biodiversity Loss", shortTitle: "Pollinator Collapse", summary: "Explore habitat, pesticide pressure, ecological redundancy, and recolonization across flowering cycles.", category: "Ecology", tier: "yellow", family: "regenerative-stock", icon: "✿", accent: "#f2d35e", minor: ["Pollinate", "Reproduce", "Monitor", "Restore habitat"], major: ["Flowering season", "Land-use change", "Ecological adaptation"], majorSource: "seasonal", meanings: { p: "Pesticide and intensive-land-use pressure", e: "Decline and redundancy measurement error", g: "Biodiversity monitoring fidelity", c: "Corridors, pesticide reform & crop diversity", f: "Climate and land-use change", d: "Population and habitat debt", l: "Local extinction & lost ecological function", k: "Reproduction, migration & recolonization", x: "Surviving-diversity dependence", r: "Pollination-service network risk" } },
  { id: "education-quality", title: "Education Quality & Epistemic Capacity", shortTitle: "Education Quality", summary: "Explore teaching, assessment, remediation, cohort change, and compounding foundational learning gaps.", category: "Organizations", tier: "yellow", family: "human-capacity", icon: "▤", accent: "#7eb8ff", minor: ["Teach", "Assess", "Diagnose", "Remediate", "Reassess"], major: ["School year", "Cohort change", "Curriculum adaptation"], majorSource: "policy-cycle", meanings: { p: "Test, credential, throughput & budget pressure", e: "Misclassifying scores as learning", g: "Student, teacher & longitudinal feedback", c: "Remediation, tutoring & curriculum reform", f: "Technology, labor & cohort change", d: "Learning-gap and teacher-capacity debt", l: "Lost epistemic capacity & trust", k: "Learning and teacher recovery", x: "Foundational-deficit compounding", r: "Distance from robust learning capacity" } },
  { id: "healthcare-workforce", title: "Fragile Healthcare Workforce", shortTitle: "Healthcare Workforce", summary: "Model staffing strain, burnout, recruitment, training lag, and patient-safety feedback loops.", category: "Healthcare", tier: "yellow", family: "human-capacity", icon: "+", accent: "#ff7e9d", minor: ["Provide care", "Review", "Rest", "Correct staffing", "Return"], major: ["Demand growth", "Recruitment", "Training", "Workforce renewal"], meanings: { p: "Volume, burden & productivity pressure", e: "Workload, safety & burnout measurement error", g: "Incident and workforce-feedback quality", c: "Staffing, rest, retention & training", f: "Demographic and disease-burden change", d: "Burnout, vacancy & training backlog", l: "Experienced-worker loss & lasting harm", k: "Workforce replenishment and recovery", x: "Burnout-error workload loop", r: "Staffing-strain and patient-safety risk" } },
  { id: "aging-infrastructure", title: "Aging Infrastructure", shortTitle: "Aging Infrastructure", summary: "Explore utilization, hidden defects, deferred maintenance, replacement speed, and service cascades.", category: "Infrastructure", tier: "yellow", family: "network-cascade", icon: "▧", accent: "#e8b069", minor: ["Use", "Inspect", "Maintain", "Repair", "Recertify"], major: ["Demand growth", "Capital planning", "Replacement cycle"], majorSource: "policy-cycle", meanings: { p: "Utilization and efficiency pressure", e: "Condition and hidden-defect error", g: "Inspection and sensor fidelity", c: "Maintenance, repair, replacement & redundancy", f: "Climate, population & demand change", d: "Deferred-maintenance debt", l: "Capacity loss & catastrophic failure", k: "Repair and replacement speed", x: "Maintenance-cascade coupling", r: "Failure and service-disruption risk" } },
  { id: "water-quality", title: "Water Quality & Contamination Regimes", shortTitle: "Water Quality", summary: "Explore pollution load, stored contaminants, treatment, enforcement, and hydrologic regime change.", category: "Ecology", tier: "yellow", family: "threshold-regime-shift", icon: "≋", accent: "#45cad8", minor: ["Discharge", "Detect", "Treat", "Regulate", "Restore"], major: ["Hydrologic cycle", "Land-use change", "Ecosystem adaptation"], majorSource: "seasonal", meanings: { p: "Agricultural, industrial & urban pollution", e: "Contaminant and impact-classification error", g: "Testing, monitoring & reporting fidelity", c: "Treatment, enforcement, cleanup & wetlands", f: "Rainfall, temperature & land-use change", d: "Sediment and contaminant accumulation", l: "Persistent contamination & regime shift", k: "Flushing and bioremediation", x: "Stored-contaminant exposure", r: "Contamination and public-health risk" } },
  { id: "geopolitical-escalation", title: "Geopolitical Escalation Systems", shortTitle: "Geopolitical Escalation", summary: "Explore threat misclassification, retaliation pressure, diplomacy, grievance debt, and dangerous phase locking.", category: "Society", tier: "yellow", family: "resistance-contagion", icon: "⇄", accent: "#ff8d68", minor: ["Signal", "Interpret", "Respond", "Communicate", "De-escalate"], major: ["Election", "Alliance change", "Leadership change", "Security cycle"], majorSource: "policy-cycle", meanings: { p: "Military, political & retaliation pressure", e: "Intent and threat misclassification", g: "Intelligence, verification & diplomacy", c: "Mediation, verification & de-escalation", f: "Leadership, alliance & crisis change", d: "Arms buildup and grievance debt", l: "War damage and durable trust collapse", k: "Diplomatic normalization and recovery", x: "Grievance-escalation coupling", r: "Escalation and conflict risk" }, distinctive: "Defensive and retaliatory phases may lock into a stable but dangerous recurrent cycle." },
  { id: "disaster-insurance", title: "Insurance & Disaster-Risk Markets", shortTitle: "Disaster Insurance", summary: "Explore correlated shocks, underpriced risk, reserves, reinsurance, withdrawal, and coverage access.", category: "Economy", tier: "yellow", family: "financial-leverage", icon: "◈", accent: "#dca765", minor: ["Price risk", "Collect premium", "Pay claim", "Reprice"], major: ["Disaster cycle", "Asset adaptation", "Regulatory response"], majorSource: "market-cycle", meanings: { p: "Return, share & underwriting pressure", e: "Catastrophe-model and exposure error", g: "Claims, exposure & hazard-data quality", c: "Reserves, reinsurance, repricing & backstop", f: "Hazard, inflation & asset migration", d: "Underpriced risk and coverage gaps", l: "Insolvency, withdrawal & uninsured loss", k: "Capital replenishment and market recovery", x: "Underpricing-solvency coupling", r: "Solvency and coverage-access risk" } },
  { id: "data-governance", title: "Data Governance & Privacy Erosion", shortTitle: "Data Governance", summary: "Explore data dependency, normalization, audit, deletion, redress, and irreversible information diffusion.", category: "Society", tier: "yellow", family: "trust-legitimacy", icon: "▣", accent: "#9c88ff", minor: ["Collect", "Use", "Audit", "Correct or delete", "Review"], major: ["Technology adoption", "Normalization", "Regulation", "New norm"], majorSource: "policy-cycle", meanings: { p: "Monetization, surveillance & AI-data pressure", e: "Consent, downstream-use & privacy-risk error", g: "Audit, provenance & user-control fidelity", c: "Minimization, deletion, security & redress", f: "Technological and regulatory change", d: "Exposure and data-dependency debt", l: "Irreversible diffusion & rights erosion", k: "Trust and governance recovery", x: "Infrastructure path dependence", r: "Privacy, legitimacy and governance risk" } },

  { id: "llm-deployment", title: "LLM Under Deployment Pressure", shortTitle: "LLM Deployment", summary: "A focused AANA simulation balancing fast release, verification, correction, and distribution shift.", category: "AI", tier: "featured", family: "capability-correction", icon: "✦", accent: "#7b6cff", version: "1.1.0", difficulty: "Intermediate", minor: ["Generate", "Verify", "Retrieve", "Revise", "Gate"], major: ["User-context change", "Distribution shift", "Model update"], majorSource: "estimated", meanings: { p: "Response speed & automation pressure", e: "Hallucination & hidden-constraint error", g: "Retrieval and verifier fidelity", c: "Correction iterations & human escalation", f: "User-context and distribution shift", d: "Unresolved failure patterns", l: "Irreversible downstream action", k: "Rollback and recovery effectiveness", x: "Failure-history amplification", r: "Output-risk severity" }, defaults: {}, distinctive: "Fast deployment can look productive while unresolved failures make future correction harder." },
  { id: "coding-agent", title: "Autonomous Coding Agent", shortTitle: "Coding Agent", summary: "An agent navigating evolving tasks, repositories, dependencies, tests, rollback, and review.", category: "AI", tier: "featured", family: "capability-correction", icon: "⌘", accent: "#36d7ff", version: "1.1.0", difficulty: "Advanced", minor: ["Inspect", "Reason", "Edit", "Test", "Correct", "Submit"], major: ["Task evolution", "Repository change", "Dependency change"], majorSource: "estimated", meanings: { p: "Task and time pressure", e: "Localization or causal-diagnosis error", g: "Test coverage and tool feedback", c: "Iteration, rollback & verifier depth", f: "Task, repository & dependency change", d: "Regressions and failed-edit debt", l: "Destructive repository action", k: "Rollback and repair effectiveness", x: "Regression amplification", r: "Repository-change risk" }, defaults: { pressure: 1.8, error: 0.28, feedback: 0.68, correction: 0.5, omegaTheta: 0.12 }, distinctive: "A rigid repeated debugging loop can be highly recurrent without becoming correct." },
  { id: "startup-growth", title: "High-Growth Startup", shortTitle: "Startup Scaling", summary: "A company balancing rapid growth with product reliability, culture, customer feedback, and repair.", category: "Organizations", tier: "featured", family: "human-capacity", icon: "↗", accent: "#9ee45e", version: "1.1.0", difficulty: "Introductory", minor: ["Build", "Release", "Observe", "Repair"], major: ["Funding", "Growth", "Competition", "Strategic adaptation"], majorSource: "market-cycle", meanings: { p: "Growth and investor pressure", e: "Market, culture & technical-risk error", g: "Customer and employee feedback", c: "QA, support, repair & leadership response", f: "Funding, competition & market change", d: "Technical, cultural & operational debt", l: "Trust, key-person or incident loss", k: "Operating and organizational recovery", x: "Debt-driven fragility", r: "Product and organizational instability" }, defaults: { pressure: 1.9, feedback: 0.56, correction: 0.48, drift: 0.07 } },
  { id: "hospital-throughput", title: "Hospital Throughput", shortTitle: "Hospital Throughput", summary: "A care system balancing patient flow, safety feedback, staffing, backlog, and variable demand.", category: "Healthcare", tier: "featured", family: "human-capacity", icon: "+", accent: "#ff6d9f", version: "1.1.0", difficulty: "Advanced", minor: ["Admit", "Triage", "Treat", "Discharge", "Review"], major: ["Demand cycle", "Staffing adaptation"], majorSource: "seasonal", meanings: { p: "Throughput and occupancy pressure", e: "Triage and demand-estimation error", g: "Patient-safety and incident feedback", c: "Staffing, beds, escalation & quality review", f: "Daily and seasonal demand change", d: "Treatment backlog & staff exhaustion", l: "Preventable harm & workforce attrition", k: "Clinical and staffing recovery", x: "Backlog-safety coupling", r: "Clinical-risk excursion" }, defaults: { pressure: 1.72, error: 0.3, feedback: 0.6, correction: 0.47, drift: 0.09, rhoCrit: 2.15 } },
  { id: "burnout-recovery", title: "Personal Burnout & Recovery", shortTitle: "Burnout & Recovery", summary: "Explore effort, fatigue, rest, workload, support, recovery debt, and changing life demands.", category: "Healthcare", tier: "featured", family: "human-capacity", icon: "◒", accent: "#ffb44a", version: "1.1.0", difficulty: "Introductory", minor: ["Effort", "Fatigue", "Rest", "Recovery", "Return"], major: ["Work cycle", "Life transition", "Adaptation"], meanings: { p: "Workload and performance pressure", e: "Misreading exhaustion as low motivation", g: "Bodily, emotional & social feedback", c: "Sleep, boundaries, support & workload reduction", f: "Work and life-context change", d: "Sleep and stress debt", l: "Lasting health or relationship damage", k: "Physiological and social recovery", x: "Stress-debt vulnerability", r: "Physiological and psychological strain" }, defaults: { pressure: 1.55, feedback: 0.58, correction: 0.42, initialDebt: 0.38, beta: 0.07 } },
  { id: "public-transit", title: "Public-Transit Maintenance", shortTitle: "Public Transit", summary: "Explore service pressure, condition uncertainty, preventive maintenance, fleet renewal, and trust.", category: "Infrastructure", tier: "featured", family: "network-cascade", icon: "▰", accent: "#55b9ff", minor: ["Operate", "Inspect", "Maintain", "Restore"], major: ["Ridership growth", "Budget", "Fleet renewal"], majorSource: "policy-cycle", meanings: { p: "Service-frequency & utilization pressure", e: "Condition and demand error", g: "Maintenance and rider-feedback fidelity", c: "Crews, spares & preventive maintenance", f: "Ridership, budget & fleet change", d: "Deferred-maintenance backlog", l: "Asset loss & public-trust erosion", k: "Repair and fleet-renewal speed", x: "Backlog-reliability coupling", r: "Reliability and safety risk" } },
  { id: "engagement-recommender", title: "Engagement-Optimized Recommender", shortTitle: "Recommender Platform", summary: "Explore engagement pressure, harm feedback, moderation, polarization debt, and cultural change.", category: "AI", tier: "featured", family: "capability-correction", icon: "◎", accent: "#c16dff", minor: ["Recommend", "Observe", "Update", "Moderate"], major: ["Cultural event", "Behavior change", "Model update"], majorSource: "estimated", meanings: { p: "Engagement pressure", e: "Misclassifying attention as wellbeing", g: "User-harm and information feedback", c: "Moderation, constraints, diversity & intervention", f: "Cultural and behavioral change", d: "Polarization, addiction & trust debt", l: "Durable social and cognitive harm", k: "Trust and attention recovery", x: "Polarization amplification", r: "Information and human-impact risk" } },
  { id: "urban-reservoir", title: "Urban Water Reservoir", shortTitle: "Urban Reservoir", summary: "Explore demand, leakage, drought, conservation, reuse, replenishment, and storage deficits.", category: "Ecology", tier: "featured", family: "regenerative-stock", icon: "≈", accent: "#38c6e3", minor: ["Consume", "Monitor", "Restrict", "Replenish"], major: ["Seasonal rainfall", "Drought", "Adaptation"], majorSource: "seasonal", meanings: { p: "Municipal and agricultural demand", e: "Forecast and leakage error", g: "Metering and reservoir monitoring", c: "Conservation, reuse & infrastructure repair", f: "Rainfall, drought & demand change", d: "Accumulated storage deficit", l: "Ecosystem or infrastructure damage", k: "Recharge and storage recovery", x: "Deficit-driven supply pressure", r: "Reservoir supply risk" } },
  { id: "emergency-response", title: "Emergency-Response Network", shortTitle: "Emergency Response", summary: "Explore incident load, communications, coordination, supplies, fatigue, and institutional learning.", category: "Infrastructure", tier: "featured", family: "network-cascade", icon: "✥", accent: "#ff7c5f", minor: ["Detect", "Dispatch", "Coordinate", "Stabilize", "Review"], major: ["Event season", "Preparedness cycle", "Institutional learning"], majorSource: "seasonal", meanings: { p: "Incident load", e: "Situational-awareness error", g: "Communications and field-report fidelity", c: "Personnel, transport, coordination & supplies", f: "Event and preparedness-context change", d: "Fatigue and incident backlog", l: "Preventable casualties & infrastructure loss", k: "Personnel and network recovery", x: "Backlog-cascade coupling", r: "Response-network overload risk" } },
  { id: "research-integrity", title: "Research Laboratory Integrity", shortTitle: "Research Integrity", summary: "Explore publication pressure, replication, peer review, methodological debt, and correction.", category: "Organizations", tier: "featured", family: "trust-legitimacy", icon: "⚗", accent: "#78c6ff", minor: ["Hypothesize", "Test", "Review", "Replicate", "Revise"], major: ["Funding cycle", "Research trend", "Method adaptation"], majorSource: "policy-cycle", meanings: { p: "Publication, prestige & funding pressure", e: "Model, measurement & interpretation error", g: "Replication, peer review & data transparency", c: "Correction, retraction & methodological reform", f: "Funding and research-trend change", d: "Unreplicated findings & method debt", l: "Trust loss & entrenched false knowledge", k: "Replication and institutional recovery", x: "Literature-debt amplification", r: "Research-integrity risk" } },
];

export const scenarios: ScenarioDefinition[] = seeds.map(makeScenario);

export const scenarioById = Object.fromEntries(
  scenarios.map((scenario) => [scenario.id, scenario]),
) as Record<string, ScenarioDefinition>;

export const scenarioCategories = Array.from(new Set(scenarios.map((scenario) => scenario.category)));
export const watchlistCounts = scenarios.reduce<Record<WatchlistTier, number>>((counts, scenario) => {
  counts[scenario.watchlistTier] += 1;
  return counts;
}, { red: 0, orange: 0, yellow: 0, featured: 0 });
