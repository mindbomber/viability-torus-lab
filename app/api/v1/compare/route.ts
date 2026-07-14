import { PUBLIC_EXECUTION_LIMITS } from "../../../../contracts/constants.ts";
import { compareExperiments } from "../../../../contracts/experiments.ts";
import { handleApi, apiOptions, readBoundedJson } from "../../../../contracts/http.ts";

export function POST(request: Request) {
  return handleApi(async () => compareExperiments(await readBoundedJson(request), PUBLIC_EXECUTION_LIMITS));
}

export const OPTIONS = apiOptions;
