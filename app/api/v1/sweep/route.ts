import { PUBLIC_EXECUTION_LIMITS } from "../../../../contracts/constants.ts";
import { sweepParameters } from "../../../../contracts/experiments.ts";
import { handleApi, apiOptions, readBoundedJson } from "../../../../contracts/http.ts";

export function POST(request: Request) {
  return handleApi(async () => sweepParameters(await readBoundedJson(request), PUBLIC_EXECUTION_LIMITS));
}

export const OPTIONS = apiOptions;
