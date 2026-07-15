import { apiJson, apiOptions } from "../../../../contracts/http.ts";
import { CONTRACT_VERSION } from "../../../../contracts/constants.ts";
import { MODEL_VERSION } from "../../../../engine/simulator.ts";
import { scenarios } from "../../../../scenarios/catalog.ts";
import { systemTemplates } from "../../../../scenarios/templates.ts";

export function GET() {
  return apiJson({
    schemaVersion: CONTRACT_VERSION,
    modelVersion: MODEL_VERSION,
    count: systemTemplates.length,
    templates: systemTemplates.map((template) => ({
      ...template,
      systemCount: scenarios.filter((scenario) => scenario.system.templateId === template.id).length,
    })),
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}

export const OPTIONS = apiOptions;

