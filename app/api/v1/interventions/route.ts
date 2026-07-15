import { apiJson, apiOptions } from "../../../../contracts/http.ts";
import { CONTRACT_VERSION } from "../../../../contracts/constants.ts";
import { MODEL_VERSION } from "../../../../engine/simulator.ts";
import { interventionDefinitions, interventionPlans } from "../../../../scenarios/interventions.ts";

export function GET() {
  return apiJson({
    schemaVersion: CONTRACT_VERSION,
    modelVersion: MODEL_VERSION,
    definitionCount: interventionDefinitions.length,
    planCount: interventionPlans.length,
    interventionDefinitions,
    interventionPlans,
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}

export const OPTIONS = apiOptions;

