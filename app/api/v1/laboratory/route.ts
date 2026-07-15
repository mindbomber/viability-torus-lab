import { apiJson, apiOptions } from "../../../../contracts/http.ts";
import { CONTRACT_VERSION } from "../../../../contracts/constants.ts";
import { MODEL_VERSION } from "../../../../engine/simulator.ts";
import { scenarios } from "../../../../scenarios/catalog.ts";
import { interventionDefinitions, interventionPlans } from "../../../../scenarios/interventions.ts";
import { scenarioModules } from "../../../../scenarios/protocols.ts";
import { maintenancePatterns } from "../../../../scenarios/templates.ts";

export function GET() {
  return apiJson({
    schemaVersion: CONTRACT_VERSION,
    modelVersion: MODEL_VERSION,
    catalogModel: "maintenance-pattern → bounded-system → scenario-module → intervention-plan → run-assessment",
    maintenancePatterns,
    templates: maintenancePatterns,
    systems: scenarios,
    scenarioModules,
    interventionDefinitions,
    interventionPlans,
    composition: {
      experimentFields: ["systemId", "protocolId or scenario module id", "interventionPlanId", "parameters", "interventions", "seeds"],
      defaultInterventionPlanId: "no-action",
      note: "Scenario modules transform initial conditions; intervention plans compile timed operator actions. Run assessment remains an output.",
    },
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}

export const OPTIONS = apiOptions;

