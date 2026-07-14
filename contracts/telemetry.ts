import { analyzeExternalTelemetry } from "../engine/simulator.ts";
import { CONTRACT_VERSION } from "./constants.ts";
import { externalTelemetrySchema } from "./schemas.ts";
import { ContractError } from "./experiments.ts";

export function analyzeTelemetryRequest(input: unknown) {
  const parsed = externalTelemetrySchema.safeParse(input);
  if (!parsed.success) {
    throw new ContractError(
      "External telemetry failed contract validation.",
      parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }
  const analysis = analyzeExternalTelemetry(parsed.data.samples);
  return {
    schemaVersion: CONTRACT_VERSION,
    source: parsed.data.source,
    ...analysis,
    evidence: {
      kind: "imported-observation",
      empiricalValidation: false,
      calibrationStatus: "Uncalibrated imported telemetry. Phase analysis describes the submitted signal only.",
    },
  };
}
