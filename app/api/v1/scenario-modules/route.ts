import { apiJson, apiOptions } from "../../../../contracts/http.ts";
import { CONTRACT_VERSION } from "../../../../contracts/constants.ts";
import { MODEL_VERSION } from "../../../../engine/simulator.ts";
import { scenarioModules } from "../../../../scenarios/protocols.ts";

export function GET() {
  return apiJson({ schemaVersion: CONTRACT_VERSION, modelVersion: MODEL_VERSION, count: scenarioModules.length, scenarioModules }, { headers: { "Cache-Control": "public, max-age=300" } });
}

export const OPTIONS = apiOptions;

