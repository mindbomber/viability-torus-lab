import { EMPIRICAL_EXECUTION_LIMITS } from "../../../../../contracts/constants.ts";
import { apiJson, handleApi, readBoundedJson } from "../../../../../contracts/http.ts";
import { analyzeEmpiricalRequest } from "../../../../../empirical/headless.ts";

function configuredOrigin() {
  return process.env.VTL_EMPIRICAL_API_ORIGIN?.trim() || "";
}
function withEmpiricalCors(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  headers.delete("Access-Control-Allow-Origin");
  const allowedOrigin = configuredOrigin();
  const requestOrigin = request.headers.get("origin");
  if (allowedOrigin && requestOrigin === allowedOrigin) headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Vary", "Origin");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-VTL-Data-Retention", "request-only");
  headers.set("X-VTL-Raw-Input-Logging", "disabled");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function configurationError(request: Request, status: number, code: string, message: string) {
  return withEmpiricalCors(apiJson({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } }), request);
}

export async function POST(request: Request) {
  if (process.env.VTL_ENABLE_EMPIRICAL_API !== "true") {
    return configurationError(request, 403, "EMPIRICAL_API_DISABLED", "Remote empirical processing is disabled. Self-hosted operators must explicitly set VTL_ENABLE_EMPIRICAL_API=true.");
  }
  const token = process.env.VTL_EMPIRICAL_API_TOKEN?.trim();
  if (!token) return configurationError(request, 503, "EMPIRICAL_API_MISCONFIGURED", "VTL_EMPIRICAL_API_TOKEN is required when the empirical API is enabled.");
  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return configurationError(request, 401, "EMPIRICAL_API_UNAUTHORIZED", "A valid bearer token is required.");
  }
  const response = await handleApi(async () => analyzeEmpiricalRequest(
    await readBoundedJson(request, EMPIRICAL_EXECUTION_LIMITS.maxCsvBytes + 500_000),
    {
      mode: "http-api",
      tokenAuthenticated: true,
      allowSensitiveRemoteData: process.env.VTL_ALLOW_SENSITIVE_EMPIRICAL_DATA === "true",
      maxReturnedReplayPoints: EMPIRICAL_EXECUTION_LIMITS.maxReturnedReplayPoints,
    },
  ));
  return withEmpiricalCors(response, request);
}

export function OPTIONS(request: Request) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  const allowedOrigin = configuredOrigin();
  const requestOrigin = request.headers.get("origin");
  if (allowedOrigin && requestOrigin === allowedOrigin) headers.set("Access-Control-Allow-Origin", allowedOrigin);
  return new Response(null, { status: 204, headers });
}
