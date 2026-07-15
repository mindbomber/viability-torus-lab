import { apiJson, apiOptions } from "../../../../contracts/http.ts";
import { CONTRACT_VERSION } from "../../../../contracts/constants.ts";
import { MODEL_VERSION } from "../../../../engine/simulator.ts";
import { scenarios } from "../../../../scenarios/catalog.ts";
import { maintenancePatterns } from "../../../../scenarios/templates.ts";

export function GET() {
  return apiJson({
    schemaVersion: CONTRACT_VERSION,
    modelVersion: MODEL_VERSION,
    count: maintenancePatterns.length,
    maintenancePatterns: maintenancePatterns.map((pattern) => ({
      ...pattern,
      systemCount: scenarios.filter((scenario) => scenario.system.maintenancePatternId === pattern.id).length,
    })),
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}

export const OPTIONS = apiOptions;
