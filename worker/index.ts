/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { getModelManifest } from "../contracts/metadata.ts";
import { GENERATED_JSON_SCHEMAS, GENERATED_SCHEMA_INDEX } from "../contracts/generated-schemas.ts";
import { CONTRACT_VERSION } from "../contracts/constants.ts";
import { MODEL_VERSION } from "../engine/simulator.ts";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/.well-known/viability-torus-lab.json") {
      const manifest = getModelManifest(url.origin);
      return Response.json({
        schemaVersion: manifest.contractVersion,
        name: manifest.name,
        description: manifest.description,
        homepage: `${url.origin}/`,
        scientificScope: manifest.scientificScope,
        api: manifest.endpoints.model,
        mcp: { transport: "streamable-http", url: manifest.endpoints.mcp },
        schemas: manifest.endpoints.schemas,
        agentDocumentation: `${url.origin}/llms.txt`,
        source: manifest.endpoints.source,
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300",
          "X-Content-Type-Options": "nosniff",
          "X-VTL-Contract-Version": CONTRACT_VERSION,
          "X-VTL-Model-Version": MODEL_VERSION,
        },
      });
    }

    if (url.pathname.startsWith("/schemas/v1/")) {
      const name = url.pathname.slice("/schemas/v1/".length);
      const value = name === "index.json" ? GENERATED_SCHEMA_INDEX : GENERATED_JSON_SCHEMAS[name];
      if (!value) return Response.json({ error: "Unknown schema." }, { status: 404 });
      return new Response(JSON.stringify(value, null, 2), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
          "Content-Type": name === "index.json" ? "application/json; charset=utf-8" : "application/schema+json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-VTL-Contract-Version": CONTRACT_VERSION,
          "X-VTL-Model-Version": MODEL_VERSION,
        },
      });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    headers.set("Link", '</.well-known/viability-torus-lab.json>; rel="service-desc", </llms.txt>; rel="alternate"; type="text/plain"');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

export default worker;
