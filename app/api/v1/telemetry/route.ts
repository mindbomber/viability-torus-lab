import { apiOptions, handleApi, readBoundedJson } from "../../../../contracts/http.ts";
import { analyzeTelemetryRequest } from "../../../../contracts/telemetry.ts";

export function POST(request: Request) {
  return handleApi(async () => analyzeTelemetryRequest(await readBoundedJson(request)));
}

export const OPTIONS = apiOptions;
