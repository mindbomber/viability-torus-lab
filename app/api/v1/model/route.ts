import { apiJson, apiOptions } from "../../../../contracts/http.ts";
import { getModelManifest } from "../../../../contracts/metadata.ts";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return apiJson(getModelManifest(origin), { headers: { "Cache-Control": "public, max-age=300" } });
}

export const OPTIONS = apiOptions;
