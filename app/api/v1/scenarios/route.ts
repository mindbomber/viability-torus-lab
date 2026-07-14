import { apiJson, apiOptions } from "../../../../contracts/http.ts";
import { scenarios, watchlistCounts } from "../../../../scenarios/catalog.ts";
import { CONTRACT_VERSION } from "../../../../contracts/constants.ts";
import { MODEL_VERSION } from "../../../../engine/simulator.ts";

export function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const category = query.get("category")?.toLowerCase();
  const tier = query.get("tier")?.toLowerCase();
  const modelFamily = query.get("modelFamily")?.toLowerCase();
  const filtered = scenarios.filter((scenario) =>
    (!category || scenario.category.toLowerCase() === category) &&
    (!tier || scenario.watchlistTier === tier) &&
    (!modelFamily || scenario.modelFamily === modelFamily)
  );
  return apiJson({ schemaVersion: CONTRACT_VERSION, modelVersion: MODEL_VERSION, count: filtered.length, total: scenarios.length, watchlistCounts, filters: { category: category ?? null, tier: tier ?? null, modelFamily: modelFamily ?? null }, scenarios: filtered }, { headers: { "Cache-Control": "public, max-age=300" } });
}

export const OPTIONS = apiOptions;
