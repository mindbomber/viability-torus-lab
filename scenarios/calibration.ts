import type {
  ComposableParameterKey,
  CurrentStateEstimate,
  ParameterObservationProxy,
  ParameterKey,
} from "../contracts/types.ts";

type CalibrationTiming = Pick<
  CurrentStateEstimate,
  "observationWindow" | "observationCadence" | "candidateTimeAnchor" | "reviewCadence"
>;

type CalibrationLabels = Record<ParameterKey, string> & {
  restoration: string;
  debtCoupling: string;
  radialExcursion: string;
};

type CalibrationCycles = {
  minor: { label: string };
  major: { label: string };
};

export const CURRENT_STATE_ESTIMATE_DATE = "2026-07-14";

/**
 * Candidate observation cadences for a future empirical calibration. They do
 * not turn normalized simulator time into a calendar forecast on their own.
 */
export const calibrationTimingBySystem: Record<string, CalibrationTiming> = {
  "climate-biosphere": { observationWindow: "Trailing 10 calendar years", observationCadence: "Annual, with seasonal and extreme-event updates", candidateTimeAnchor: "1 model time unit ≈ 1 year", reviewCadence: "Annual" },
  "groundwater-depletion": { observationWindow: "Trailing 5 hydrological years", observationCadence: "Monthly measurements summarized by recharge season", candidateTimeAnchor: "1 model time unit ≈ 1 hydrological season", reviewCadence: "Seasonal" },
  "soil-fertility": { observationWindow: "Trailing 5 growing seasons", observationCadence: "Field measurements at planting, harvest, and post-harvest review", candidateTimeAnchor: "1 model time unit ≈ 1 growing season", reviewCadence: "Each growing season" },
  "antimicrobial-resistance": { observationWindow: "Trailing 36 months", observationCadence: "Monthly surveillance with quarterly stewardship review", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Quarterly" },
  "information-integrity": { observationWindow: "Trailing 24 months", observationCadence: "Weekly and event-window platform measurements", candidateTimeAnchor: "1 model time unit ≈ 1 week", reviewCadence: "Monthly and after major events" },
  "institutional-trust": { observationWindow: "Trailing 48 months", observationCadence: "Monthly service, complaint, appeal, and redress records", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Quarterly" },
  "ai-agent-ecosystems": { observationWindow: "Trailing 12 months", observationCadence: "Per-task telemetry summarized weekly", candidateTimeAnchor: "1 model time unit ≈ 1 week", reviewCadence: "Monthly and after model changes" },
  "public-health-preparedness": { observationWindow: "Trailing 5 years plus recent outbreak episodes", observationCadence: "Monthly readiness measures and per-outbreak updates", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Quarterly and after outbreaks" },
  "energy-grid": { observationWindow: "Trailing 36 months", observationCadence: "Sub-hourly telemetry summarized daily and seasonally", candidateTimeAnchor: "1 model time unit ≈ 1 day", reviewCadence: "Monthly and after major incidents" },
  "sovereign-debt": { observationWindow: "Trailing 5 fiscal years", observationCadence: "Monthly market data and quarterly fiscal accounts", candidateTimeAnchor: "1 model time unit ≈ 1 fiscal quarter", reviewCadence: "Quarterly" },
  "semiconductor-supply-chain": { observationWindow: "Trailing 36 months", observationCadence: "Weekly logistics and monthly capacity measurements", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Monthly" },
  "fishery-management": { observationWindow: "Trailing 5 stock-assessment years", observationCadence: "Seasonal catch, survey, habitat, and enforcement measurements", candidateTimeAnchor: "1 model time unit ≈ 1 harvest season", reviewCadence: "Each season" },
  "housing-affordability": { observationWindow: "Trailing 5 years", observationCadence: "Monthly market data and quarterly planning updates", candidateTimeAnchor: "1 model time unit ≈ 1 quarter", reviewCadence: "Quarterly" },
  "youth-mental-health": { observationWindow: "Trailing 3 school years", observationCadence: "Monthly support and wellbeing measures with term-level review", candidateTimeAnchor: "1 model time unit ≈ 1 school term", reviewCadence: "Each school term" },
  "pollinator-collapse": { observationWindow: "Trailing 5 flowering seasons", observationCadence: "Seasonal abundance, diversity, pesticide, and habitat measurements", candidateTimeAnchor: "1 model time unit ≈ 1 flowering season", reviewCadence: "Each flowering season" },
  "education-quality": { observationWindow: "Trailing 5 school years and available cohort histories", observationCadence: "Term-level learning, access, remediation, and workforce measures", candidateTimeAnchor: "1 model time unit ≈ 1 school term", reviewCadence: "Each school term" },
  "healthcare-workforce": { observationWindow: "Trailing 36 months", observationCadence: "Monthly staffing, workload, safety, absence, and retention measures", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Monthly" },
  "aging-infrastructure": { observationWindow: "Trailing 10 years of inspections, failures, and renewal work", observationCadence: "Inspection-event data with annual portfolio review", candidateTimeAnchor: "1 model time unit ≈ 1 year", reviewCadence: "Annual and after critical inspections" },
  "water-quality": { observationWindow: "Trailing 5 hydrological years", observationCadence: "Monthly sampling plus storm and discharge events", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Quarterly and after contamination events" },
  "geopolitical-escalation": { observationWindow: "Trailing 5 years of comparable signaling and crisis episodes", observationCadence: "Event-driven observations summarized weekly", candidateTimeAnchor: "1 model time unit ≈ 1 week", reviewCadence: "Weekly during crises" },
  "disaster-insurance": { observationWindow: "Trailing 10 underwriting years and catastrophe events", observationCadence: "Quarterly exposure and capital data plus per-event claims updates", candidateTimeAnchor: "1 model time unit ≈ 1 underwriting quarter", reviewCadence: "Quarterly and after major events" },
  "data-governance": { observationWindow: "Trailing 36 months", observationCadence: "Monthly audit, access, deletion, incident, and redress measures", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Quarterly and after material changes" },
  "llm-deployment": { observationWindow: "Trailing 12 months", observationCadence: "Per-response telemetry summarized weekly", candidateTimeAnchor: "1 model time unit ≈ 1 week", reviewCadence: "Monthly and after model releases" },
  "coding-agent": { observationWindow: "Trailing 12 months or 20 release cycles", observationCadence: "Per-task and per-change telemetry summarized by release", candidateTimeAnchor: "1 model time unit ≈ 1 release cycle", reviewCadence: "Each release" },
  "startup-growth": { observationWindow: "Trailing 24 months", observationCadence: "Monthly product, reliability, customer, workforce, and finance measures", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Monthly" },
  "hospital-throughput": { observationWindow: "Trailing 24 months", observationCadence: "Shift-level flow and safety data summarized daily and monthly", candidateTimeAnchor: "1 model time unit ≈ 1 day", reviewCadence: "Monthly and after surge periods" },
  "burnout-recovery": { observationWindow: "Trailing 12 months", observationCadence: "Daily workload and recovery signals summarized weekly", candidateTimeAnchor: "1 model time unit ≈ 1 week", reviewCadence: "Weekly" },
  "public-transit": { observationWindow: "Trailing 36 months", observationCadence: "Daily service and maintenance data summarized monthly", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Monthly" },
  "engagement-recommender": { observationWindow: "Trailing 24 months", observationCadence: "Per-session exposure and outcome signals summarized weekly", candidateTimeAnchor: "1 model time unit ≈ 1 week", reviewCadence: "Monthly and after model updates" },
  "urban-reservoir": { observationWindow: "Trailing 10 hydrological years", observationCadence: "Daily storage, inflow, demand, leakage, and release data summarized monthly", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Monthly" },
  "emergency-response": { observationWindow: "Trailing 5 years of incident and preparedness records", observationCadence: "Per-incident telemetry summarized monthly and seasonally", candidateTimeAnchor: "1 model time unit ≈ 1 month", reviewCadence: "Quarterly and after major incidents" },
  "research-integrity": { observationWindow: "Trailing 5 years of studies, reviews, corrections, and replications", observationCadence: "Per-study records summarized quarterly", candidateTimeAnchor: "1 model time unit ≈ 1 quarter", reviewCadence: "Quarterly" },
};

const proposed = (
  observable: string,
  normalization: string,
  updateCadence: string,
): ParameterObservationProxy => ({
  observable,
  normalization,
  updateCadence,
  sourceStatus: "proposed-observable-proxy",
});

function parameterProxies(
  labels: CalibrationLabels,
  cycles: CalibrationCycles,
  timing: CalibrationTiming,
): Record<ComposableParameterKey, ParameterObservationProxy> {
  const cadence = timing.reviewCadence;
  return {
    pressure: proposed(`Observed ${labels.pressure.toLowerCase()}.`, "Normalize recent intensity to a declared reference operating range; 1 represents that reference, not a universal unit.", cadence),
    error: proposed(`Observed misses, forecast residuals, or classification failures associated with ${labels.error.toLowerCase()}.`, "Divide material misses by the relevant decision, case, or exposure volume, then document exclusions and uncertainty.", cadence),
    feedback: proposed(`Coverage, reliability, and delay of ${labels.feedback.toLowerCase()}.`, "Combine signal coverage, correctness, and timeliness on a documented 0–1 scale.", cadence),
    correction: proposed(`Delivered capacity and effectiveness of ${labels.correction.toLowerCase()}.`, "Normalize effective corrective throughput to modeled burden during the same observation window.", cadence),
    drift: proposed(`Observed rate of change in ${labels.drift.toLowerCase()}.`, `Estimate change per candidate time anchor (${timing.candidateTimeAnchor}) with an uncertainty interval.`, cadence),
    irreversibleLoss: proposed(`Documented permanent or practically non-recoverable ${labels.irreversibleLoss.toLowerCase()}.`, `Normalize new loss per candidate time anchor (${timing.candidateTimeAnchor}); do not interpret it as a probability.`, cadence),
    initialDebt: proposed(`Outstanding stock or backlog represented by ${labels.initialDebt.toLowerCase()}.`, "Normalize the inherited deficit to the amount that could plausibly be repaid in one declared recovery cycle.", cadence),
    kappa: proposed(`Observed return rate associated with ${labels.restoration.toLowerCase()} after comparable disturbances.`, "Fit a recovery-rate range from return trajectories rather than selecting the value to improve the watchlist tier.", cadence),
    chi: proposed(`Change in ${labels.radialExcursion.toLowerCase()} associated with an additional unit of ${labels.initialDebt.toLowerCase()}.`, "Estimate debt sensitivity from comparable periods while reporting confounding and lag assumptions.", cadence),
    omegaTheta: proposed(`Observed recurrence cadence of ${cycles.minor.label}.`, "Convert the median operational-cycle period into angular frequency only after the calendar-time mapping is accepted.", cadence),
    omegaPhi: proposed(`Observed recurrence cadence of ${cycles.major.label}.`, "Convert the median external-cycle period into angular frequency only when at least two cycles are identifiable.", cadence),
    couplingA: proposed(`Lagged change in the timing of ${cycles.minor.label} following phase changes in ${cycles.major.label}.`, "Estimate directional phase coupling with uncertainty; synchronized timing alone is not evidence of alignment.", cadence),
    couplingB: proposed(`Lagged change in the timing of ${cycles.major.label} following phase changes in ${cycles.minor.label}.`, "Estimate the reciprocal directional effect separately rather than assuming symmetric coupling.", cadence),
    rho0: proposed(`Typical ${labels.radialExcursion.toLowerCase()} during independently accepted viable operation.`, "Estimate the reference excursion from viable historical windows; do not optimize it to produce a preferred status.", cadence),
    rhoCrit: proposed(`Domain-reviewed recoverability limit for ${labels.radialExcursion.toLowerCase()}.`, "Define the boundary from observable loss of recoverability and validate it out of sample; changing it changes classification, not the system.", cadence),
    alpha: proposed(`Rate at which unresolved ${labels.error.toLowerCase()} becomes ${labels.initialDebt.toLowerCase()}.`, "Fit debt accumulation from worsening-margin episodes with explicit lag and censoring assumptions.", cadence),
    beta: proposed(`Rate at which sustained ${labels.correction.toLowerCase()} repays ${labels.initialDebt.toLowerCase()}.`, "Fit debt repayment from corrective-surplus episodes; keep it distinct from immediate correction capacity.", cadence),
  };
}

export function currentStateEstimateFor(
  systemId: string,
  labels: CalibrationLabels,
  cycles: CalibrationCycles,
): CurrentStateEstimate {
  const timing = calibrationTimingBySystem[systemId];
  if (!timing) throw new Error(`Missing current-state calibration timing for ${systemId}`);
  return {
    asOfDate: CURRENT_STATE_ESTIMATE_DATE,
    ...timing,
    confidence: "low",
    basis: "illustrative-current-state-hypothesis",
    allModelParametersRevisable: true,
    parameterProxies: parameterProxies(labels, cycles, timing),
    limitations: [
      "The current values are provisional educational estimates for a representative bounded instance, not measurements of a named jurisdiction or organization.",
      "The candidate time anchor proposes how future observations could be aligned; the current simulation remains normalized time until frequencies and rates are fitted together.",
      "Every model parameter may be revised when the as-of date, system boundary, observation window, or supporting evidence changes.",
    ],
  };
}
