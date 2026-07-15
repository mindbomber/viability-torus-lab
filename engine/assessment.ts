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
