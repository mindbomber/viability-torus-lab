import { handleApi, apiOptions, readBoundedJson } from "../../../../../contracts/http.ts";
import { validateScenarioProposal } from "../../../../../contracts/proposals.ts";
import { PUBLIC_EXECUTION_LIMITS } from "../../../../../contracts/constants.ts";

export function POST(request: Request) {
  return handleApi(async () => validateScenarioProposal(await readBoundedJson(request), PUBLIC_EXECUTION_LIMITS));
}

export const OPTIONS = apiOptions;
