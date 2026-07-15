import type {
  InterventionPlanDefinition,
  ScenarioDefinition,
  ScenarioProtocolDefinition,
  SystemTemplateDefinition,
} from "../contracts/types.ts";
import {
  explainSimulationFrame,
  type ScheduledIntervention,
  type SimulationExplanation,
  type SimulationFrame,
  type SimulationParameters,
  type SimulationSummary,
} from "./simulator.ts";
import type { WatchlistAssessment } from "./watchlist.ts";

export type ViabilityJourneyPhase =
  | "before-crossing"
  | "crossing"
  | "recovery-window"
  | "recovered"
  | "irreversible-rupture";

export type ViabilityJourney = {
  phase: ViabilityJourneyPhase;
  crossingStep?: number;
  ruptureStep?: number;
  crossed: boolean;
  recovered: boolean;
  ruptured: boolean;
  explanation: string;
};

/**
 * Derive only the viability history visible at the selected playback frame.
 * The full deterministic run is already available in memory, but this helper
 * deliberately refuses to use future frames.
 */
export function viabilityJourneyAt(
  frames: SimulationFrame[],
  frameIndex: number,
): ViabilityJourney {
  if (frames.length === 0) throw new RangeError("At least one frame is required to derive viability history.");
  const index = Math.max(0, Math.min(frameIndex, frames.length - 1));
  const visibleFrames = frames.slice(0, index + 1);
  const current = visibleFrames.at(-1)!;
  const crossingFrame = visibleFrames.find((frame) => frame.viabilityState === "Viability-boundary crossing");
  const ruptureFrame = visibleFrames.find((frame) => frame.viabilityState === "Irreversible rupture");
  const crossed = crossingFrame !== undefined;
  const ruptured = ruptureFrame !== undefined;
  const recovered = crossed && !ruptured && current.viabilityState === "Viable recurrence";

  if (ruptured) {
    return {
      phase: "irreversible-rupture",
      crossingStep: crossingFrame?.step,
      ruptureStep: ruptureFrame.step,
      crossed,
      recovered: false,
      ruptured: true,
      explanation: `The terminal policy fired at step ${ruptureFrame.step}. The earlier recovery window closed without a return to viable recurrence.`,
    };
  }
  if (current.viabilityState === "Viability-boundary crossing") {
    return {
      phase: "crossing",
      crossingStep: current.step,
      crossed: true,
      recovered: false,
      ruptured: false,
      explanation: "The viability boundary is being crossed at this frame. Recovery remains possible because the terminal policy has not fired.",
    };
  }
  if (current.viabilityState === "Recoverable excursion") {
    return {
      phase: "recovery-window",
      crossingStep: crossingFrame?.step,
      crossed: true,
      recovered: false,
      ruptured: false,
      explanation: "The system remains outside the viable tube, but this excursion is still nonterminal and can return to viable recurrence.",
    };
  }
  if (recovered) {
    return {
      phase: "recovered",
      crossingStep: crossingFrame?.step,
      crossed: true,
      recovered: true,
      ruptured: false,
      explanation: "The system returned inside the viable tube after an earlier boundary crossing. Continued viability still depends on later conditions.",
    };
  }
  return {
    phase: "before-crossing",
    crossed: false,
    recovered: false,
    ruptured: false,
    explanation: "No viability-boundary crossing has occurred by this playback frame.",
  };
}

export function isPlaybackTransitionFrame(
  frames: SimulationFrame[],
  frameIndex: number,
  interventionSteps: ReadonlySet<number> = new Set<number>(),
) {
  if (frameIndex <= 0 || frameIndex >= frames.length) return false;
  const current = frames[frameIndex];
  const previous = frames[frameIndex - 1];
  return interventionSteps.has(current.step)
    || current.viabilityState !== previous.viabilityState
    || current.status !== previous.status;
}

/** Advance by the requested stride without skipping a status, viability, or intervention transition. */
export function nextPlaybackFrameIndex(
  frames: SimulationFrame[],
  frameIndex: number,
  stride: number,
  interventionSteps: ReadonlySet<number> = new Set<number>(),
) {
  if (frames.length === 0) return 0;
  const current = Math.max(0, Math.min(frameIndex, frames.length - 1));
  const target = Math.min(frames.length - 1, current + Math.max(1, Math.round(stride)));
  for (let index = current + 1; index <= target; index += 1) {
    if (isPlaybackTransitionFrame(frames, index, interventionSteps)) return index;
  }
  return target;
}

export function finalViabilityOutcomeLabel(summary: SimulationSummary) {
  if (summary.irreversibleRuptureStep !== undefined || summary.finalViabilityState === "Irreversible rupture") {
    return "Irreversible rupture";
  }
  if (summary.recoveredAfterCrossing) return "Recovered after boundary crossing";
  if (summary.finalViabilityState === "Recoverable excursion") return "Outside boundary · recovery still possible";
  if (summary.finalViabilityState === "Viability-boundary crossing") return "Boundary crossing";
  return summary.finalViabilityState;
}

/** Apply only intervention events that have occurred by the selected frame. */
export function activeParametersAtFrame(
  configuredParameters: SimulationParameters,
  interventions: ScheduledIntervention[],
  step: number,
) {
  return [...interventions]
    .sort((left, right) => left.step - right.step || left.id.localeCompare(right.id))
    .filter((event) => event.step <= step)
    .reduce(
      (current, event) => ({ ...current, ...event.effects }),
      { ...configuredParameters },
    );
}

/**
 * A run assessment is an output record. It deliberately points back to the
 * bounded system and protocol that produced it instead of treating either as
 * part of the observed status.
 */
export type RunAssessment = {
  templateId: string;
  systemId: string;
  protocolId: string;
  interventionPlanId: string;
  frameIndex: number;
  frame: SimulationFrame;
  summary: SimulationSummary;
  educationalWatchlist: WatchlistAssessment;
  explanation: SimulationExplanation;
};

export function assessRun(input: {
  scenario: ScenarioDefinition;
  template: SystemTemplateDefinition;
  protocol: ScenarioProtocolDefinition;
  interventionPlan: InterventionPlanDefinition;
  frames: SimulationFrame[];
  summary: SimulationSummary;
  frameIndex: number;
  configuredParameters: SimulationParameters;
  activeParameters: SimulationParameters;
  interventions: ScheduledIntervention[];
  educationalWatchlist: WatchlistAssessment;
}): RunAssessment {
  const frameIndex = Math.min(Math.max(0, input.frameIndex), input.frames.length - 1);
  const visibleFrames = input.frames.slice(0, Math.max(1, frameIndex + 1));
  return {
    templateId: input.scenario.system.templateId,
    systemId: input.scenario.system.id,
    protocolId: input.protocol.id,
    interventionPlanId: input.interventionPlan.id,
    frameIndex,
    frame: input.frames[frameIndex],
    summary: input.summary,
    educationalWatchlist: input.educationalWatchlist,
    explanation: explainSimulationFrame(visibleFrames, input.summary, input.activeParameters, {
      complete: frameIndex >= input.frames.length - 1,
      interventions: input.interventions,
      rupturePolicy: input.scenario.rupturePolicy,
      attribution: {
        system: {
          templateTitle: input.template.title,
          systemTitle: input.scenario.system.shortTitle,
          structureSummary: input.template.stateArchetype,
          baselineParameters: input.scenario.defaults,
          structuralParameterKeys: Object.keys(input.template.baseDynamics) as (keyof SimulationParameters)[],
        },
        scenario: {
          title: input.protocol.title,
          kind: input.protocol.kind,
          parameters: input.protocol.parameters,
        },
        configuredParameters: input.configuredParameters,
        interventionPlan: {
          title: input.interventionPlan.title,
          strategy: input.interventionPlan.strategy,
        },
      },
    }),
  };
}
