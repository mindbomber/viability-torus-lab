import { CONTRACT_VERSION } from "./constants.ts";
import { formatContractError } from "./experiments.ts";
import { MODEL_VERSION } from "../engine/simulator.ts";

const MAX_BODY_BYTES = 1_000_000;

export async function readBoundedJson(request: Request, maxBodyBytes = MAX_BODY_BYTES) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxBodyBytes) throw new Error(`Request body exceeds ${maxBodyBytes} bytes.`);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBodyBytes) throw new Error(`Request body exceeds ${maxBodyBytes} bytes.`);
  if (!text) throw new Error("A JSON request body is required.");
  return JSON.parse(text) as unknown;
}

export function apiJson(value: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Expose-Headers", "X-VTL-Contract-Version, X-VTL-Model-Version");
  headers.set("X-VTL-Contract-Version", CONTRACT_VERSION);
  headers.set("X-VTL-Model-Version", MODEL_VERSION);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(value, null, 2), { ...init, headers });
}

export function apiOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version, MCP-Session-Id",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function handleApi(operation: () => unknown | Promise<unknown>) {
  try {
    return apiJson(await operation(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const formatted = formatContractError(error);
    const status = error instanceof SyntaxError ? 400 : formatted.issues.length ? 422 : 400;
    return apiJson(formatted, { status, headers: { "Cache-Control": "no-store" } });
  }
}
