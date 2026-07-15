import type { LaboratoryComposition } from "../contracts/types.ts";
import type { ScheduledIntervention, SimulationParameters } from "../engine/simulator.ts";
import { scenarioById } from "./catalog.ts";
import {
  compileInterventionPlan,
  interventionAppliesTo,
  interventionPlanById,
} from "./interventions.ts";
import { systemTemplateById } from "./templates.ts";

export type LaboratoryCompositionInput = {
  systemId: string;
  protocolId?: string;
  interventionPlanId?: string;
  parameters?: Partial<SimulationParameters>;
  interventions?: ScheduledIntervention[];
};

export class CompositionError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(message);
    this.name = "CompositionError";
    this.path = path;
  }
}

/** Resolve reusable modules into the concrete configuration executed by the engine. */
export function composeLaboratoryRun(input: LaboratoryCompositionInput): LaboratoryComposition {
  const scenario = scenarioById[input.systemId];
  if (!scenario) throw new CompositionError("systemId", `Unknown bounded system '${input.systemId}'.`);
  const template = systemTemplateById[scenario.system.templateId];
  if (!template) throw new CompositionError("systemId", `System '${input.systemId}' references an unknown template.`);
  const protocolReference = input.protocolId ?? scenario.defaultProtocolId;
  const protocol = scenario.protocols.find((item) => item.id === protocolReference || item.moduleId === protocolReference);
  if (!protocol) throw new CompositionError("protocolId", `Unknown protocol or scenario module '${protocolReference}' for system '${scenario.system.id}'.`);
  const interventionPlan = interventionPlanById[input.interventionPlanId ?? "no-action"];
  if (!interventionPlan) throw new CompositionError("interventionPlanId", `Unknown intervention plan '${input.interventionPlanId}'.`);
  if (!interventionAppliesTo(interventionPlan.compatibleTemplateIds, template.id)) {
    throw new CompositionError("interventionPlanId", `Intervention plan '${interventionPlan.id}' is not compatible with template '${template.id}'.`);
  }
  const parameters = { ...protocol.parameters, ...input.parameters };
  const plannedInterventions = compileInterventionPlan(interventionPlan, parameters);
  return {
    template,
    system: scenario.system,
    protocol,
    interventionPlan,
    parameters,
    interventions: [...plannedInterventions, ...(input.interventions ?? [])]
      .sort((left, right) => left.step - right.step || left.id.localeCompare(right.id)),
  };
}
