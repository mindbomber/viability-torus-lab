import { apiJson, apiOptions } from "../../../../contracts/http.ts";
import { scenarios } from "../../../../scenarios/catalog.ts";
import { CONTRACT_VERSION } from "../../../../contracts/constants.ts";
import { MODEL_VERSION } from "../../../../engine/simulator.ts";

export function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  const filtered = category ? scenarios.filter((scenario) => scenario.category.toLowerCase() === category.toLowerCase()) : scenarios;
  return apiJson({ schemaVersion: CONTRACT_VERSION, modelVersion: MODEL_VERSION, count: filtered.length, scenarios: filtered }, { headers: { "Cache-Control": "public, max-age=300" } });
}

export const OPTIONS = apiOptions;
