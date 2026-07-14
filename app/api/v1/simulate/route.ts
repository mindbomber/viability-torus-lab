import { PUBLIC_EXECUTION_LIMITS } from "../../../../contracts/constants.ts";
import { handleApi, apiOptions, readBoundedJson } from "../../../../contracts/http.ts";
import { runExperiment } from "../../../../contracts/experiments.ts";

export function POST(request: Request) {
  return handleApi(async () => runExperiment(await readBoundedJson(request), PUBLIC_EXECUTION_LIMITS));
}

export const OPTIONS = apiOptions;
