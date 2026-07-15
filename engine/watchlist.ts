import {
  simulate,
  type ScheduledIntervention,
  type SimulationParameters,
} from "./simulator.ts";

export type SimulatedWatchlistTier = "red" | "orange" | "yellow";

export type WatchlistProtocolId =
  | "baseline"
  | "mild-stress"
  | "compound-stress"
  | "timely-action";

export type WatchlistProtocolMetrics = {
  id: WatchlistProtocolId;
  label: string;
  description: string;
  runs: number;
  boundaryCrossingRate: number;
  terminalRate: number;
  recoveryRate: number;
  meanStableFraction: number;
  meanWarningOrFragileFraction: number;
  meanFinalDebt: number;
  meanMaxRho: number;
};

export type WatchlistAssessment = {
  tier: SimulatedWatchlistTier;
  protocolVersion: "educational-watchlist-v2";
  seeds: readonly number[];
  protocols: Record<WatchlistProtocolId, WatchlistProtocolMetrics>;
  reasons: string[];
  causalBalance: {
    optimizationPressure: number;
    drift: number;
    irreversibleLoss: number;
    correction: number;
    initialDebtPressure: number;
    initialDebtAdjustedMargin: number;
  };
};

export const WATCHLIST_PROTOCOL_SEEDS = [11, 29, 47, 83] as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const protocolDefinitions: Record<WatchlistProtocolId, {
  label: string;
  description: string;
  schedule: (parameters: SimulationParameters) => ScheduledIntervention[];
}> = {
  baseline: {
    label: "Ordinary baseline",
    description: "The selected slider values run without an added shock.",
    schedule: () => [],
  },
  "mild-stress": {
    label: "Temporary stress",
    description: "A common moderate challenge tests whether stable recurrence narrows before compound failure.",
    schedule: (parameters) => [{
      id: "watchlist-mild-stress-start",
      label: "Temporary stress begins",
      step: 120,
      cost: 0,
      effects: {
        pressure: clamp(parameters.pressure + 0.35, 0, 3),
        error: clamp(parameters.error + 0.06, 0, 1),
        feedback: clamp(parameters.feedback - 0.08, 0, 1),
        drift: clamp(parameters.drift + 0.03, 0, 0.5),
      },
    }, {
      id: "watchlist-mild-stress-end",
      label: "Temporary stress clears",
      step: 420,
      cost: 0,
      effects: {
        pressure: parameters.pressure,
        error: parameters.error,
        feedback: parameters.feedback,
        drift: parameters.drift,
      },
    }],
  },
  "compound-stress": {
    label: "Compound stress",
    description: "Pressure, error, drift, and loss rise while feedback and correction weaken.",
    schedule: (parameters) => [{
      id: "watchlist-compound-stress",
      label: "Compound stress begins",
      step: 120,
      cost: 0,
      effects: {
        pressure: clamp(parameters.pressure + 0.75, 0, 3),
        error: clamp(parameters.error + 0.15, 0, 1),
        feedback: clamp(parameters.feedback - 0.18, 0, 1),
        correction: clamp(parameters.correction - 0.1, 0, 2),
        drift: clamp(parameters.drift + 0.08, 0, 0.5),
        irreversibleLoss: clamp(parameters.irreversibleLoss + 0.03, 0, 0.5),
      },
    }],
  },
  "timely-action": {
    label: "Timely corrective action",
    description: "A common early response reduces pressure, error, drift, and loss while reinforcing feedback, correction, and debt repayment.",
    schedule: (parameters) => [{
      id: "watchlist-timely-action",
      label: "Timely corrective action",
      step: 1,
      cost: 0,
      effects: {
        pressure: clamp(parameters.pressure - 0.45, 0, 3),
        error: clamp(parameters.error - 0.12, 0, 1),
        feedback: clamp(parameters.feedback + 0.22, 0, 1),
        correction: clamp(parameters.correction + 0.42, 0, 2),
        drift: clamp(parameters.drift - 0.07, 0, 0.5),
        irreversibleLoss: clamp(parameters.irreversibleLoss - 0.08, 0, 0.5),
        beta: clamp(parameters.beta + 0.12, 0, 1),
      },
    }],
  },
};

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

function summarizeProtocol(
  id: WatchlistProtocolId,
  runs: ReturnType<typeof simulate>[],
): WatchlistProtocolMetrics {
  const definition = protocolDefinitions[id];
  const summaries = runs.map((run) => run.summary);
  const crossingRuns = summaries.filter((summary) => summary.boundaryCrossingStep !== undefined);
  return {
    id,
    label: definition.label,
    description: definition.description,
    runs: summaries.length,
    boundaryCrossingRate: crossingRuns.length / summaries.length,
    terminalRate: summaries.filter((summary) => summary.irreversibleRuptureStep !== undefined).length / summaries.length,
    recoveryRate: crossingRuns.length
      ? crossingRuns.filter((summary) => summary.recoveredAfterCrossing).length / crossingRuns.length
      : 0,
    meanStableFraction: mean(summaries.map((summary) => summary.stableFraction)),
    meanWarningOrFragileFraction: mean(runs.map((run) => (
      run.frames.filter((frame) => frame.status === "Warning" || frame.status === "Fragile").length /
      Math.max(run.frames.length, 1)
    ))),
    meanFinalDebt: mean(summaries.map((summary) => summary.finalDebt)),
    meanMaxRho: mean(summaries.map((summary) => summary.maxRho)),
  };
}

function evaluateProtocol(
  id: WatchlistProtocolId,
  parameters: SimulationParameters,
): WatchlistProtocolMetrics {
  const definition = protocolDefinitions[id];
  const runs = WATCHLIST_PROTOCOL_SEEDS.map((seed) => simulate(
    { ...parameters, seed },
    definition.schedule(parameters),
  ));
  return summarizeProtocol(id, runs);
}

function classify(protocols: WatchlistAssessment["protocols"]): SimulatedWatchlistTier {
  if (
    protocols.baseline.terminalRate >= 0.25 ||
    protocols.baseline.boundaryCrossingRate >= 0.5
  ) return "red";

  if (
    protocols.baseline.meanWarningOrFragileFraction >= 0.5 ||
    protocols.baseline.meanStableFraction < 0.8 ||
    protocols["compound-stress"].terminalRate >= 0.25 ||
    protocols["compound-stress"].boundaryCrossingRate >= 0.5 ||
    protocols["mild-stress"].meanStableFraction < 0.8
  ) return "orange";

  return "yellow";
}

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function explainTier(
  tier: SimulatedWatchlistTier,
  protocols: WatchlistAssessment["protocols"],
): string[] {
  const baseline = protocols.baseline;
  const mild = protocols["mild-stress"];
  const compound = protocols["compound-stress"];
  const action = protocols["timely-action"];

  if (tier === "red") {
    return [
      `Ordinary baseline crosses the viability boundary in ${percent(baseline.boundaryCrossingRate)} of seeded runs and reaches modeled terminal rupture in ${percent(baseline.terminalRate)}.`,
      `Stable status occupies ${percent(baseline.meanStableFraction)} of the baseline horizon, while Warning or Fragile status occupies ${percent(baseline.meanWarningOrFragileFraction)}.`,
      `Under the common timely-action package, ${percent(action.meanStableFraction)} of the simulated horizon is stable and terminal rupture falls to ${percent(action.terminalRate)}.`,
    ];
  }

  if (tier === "orange") {
    const baselineReason = baseline.meanWarningOrFragileFraction >= 0.5 || baseline.meanStableFraction < 0.8
      ? `Ordinary baseline spends ${percent(baseline.meanWarningOrFragileFraction)} of the simulated horizon in Warning or Fragile status and ${percent(baseline.meanStableFraction)} in Stable status, even without formal rupture.`
      : `Ordinary baseline terminal rupture is ${percent(baseline.terminalRate)}, but the configuration has limited stress resilience.`;
    return [
      baselineReason,
      `Temporary stress leaves ${percent(mild.meanStableFraction)} of the simulated horizon stable.`,
      `Compound stress crosses the viability boundary in ${percent(compound.boundaryCrossingRate)} of runs and reaches terminal rupture in ${percent(compound.terminalRate)}.`,
    ];
  }

  return [
    `Ordinary baseline remains inside the viability boundary in ${percent(1 - baseline.boundaryCrossingRate)} of seeded runs.`,
    `Ordinary baseline spends ${percent(baseline.meanWarningOrFragileFraction)} of the horizon in Warning or Fragile status; temporary stress retains Stable status for ${percent(mild.meanStableFraction)}.`,
    `Even compound stress reaches terminal rupture in only ${percent(compound.terminalRate)} of runs under this illustrative test.`,
  ];
}

/**
 * Derives an educational watchlist tier from common deterministic protocols.
 * The canonical engine rupture policy is intentionally used for every tier so
 * the classification is an outcome of the parameters, not an input to it.
 */
export function assessWatchlistConfiguration(
  parameters: SimulationParameters,
): WatchlistAssessment {
  const protocols = {
    baseline: evaluateProtocol("baseline", parameters),
    "mild-stress": evaluateProtocol("mild-stress", parameters),
    "compound-stress": evaluateProtocol("compound-stress", parameters),
    "timely-action": evaluateProtocol("timely-action", parameters),
  };
  const tier = classify(protocols);
  const optimizationPressure = parameters.pressure * parameters.error * (1 - parameters.feedback);
  const initialDebtPressure = parameters.chi * parameters.initialDebt;

  return {
    tier,
    protocolVersion: "educational-watchlist-v2",
    seeds: WATCHLIST_PROTOCOL_SEEDS,
    protocols,
    reasons: explainTier(tier, protocols),
    causalBalance: {
      optimizationPressure,
      drift: parameters.drift,
      irreversibleLoss: parameters.irreversibleLoss,
      correction: parameters.correction,
      initialDebtPressure,
      initialDebtAdjustedMargin:
        parameters.correction -
        optimizationPressure -
        parameters.drift -
        parameters.irreversibleLoss -
        initialDebtPressure,
    },
  };
}
