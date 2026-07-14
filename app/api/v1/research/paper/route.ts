import { handleApi } from "../../../../../contracts/http.ts";
import { listPaperCases, reproducePaperCase } from "../../../../../contracts/research.ts";

export function GET(request: Request) {
  return handleApi(async () => {
    const url = new URL(request.url);
    const caseId = url.searchParams.get("case");
    if (!caseId) return listPaperCases();
    return reproducePaperCase(caseId, url.searchParams.get("includeFrames") === "true");
  });
}
