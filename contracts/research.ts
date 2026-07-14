import {
  PAPER_LEGACY_EXPECTED_DIGESTS,
  paperLegacyCases,
  simulateLegacyPaperCase,
  type PaperLegacyCaseId,
} from "../engine/simulator.ts";
import { CONTRACT_VERSION } from "./constants.ts";
import { ContractError } from "./experiments.ts";

const caseIds = new Set(paperLegacyCases.map((item) => item.id));

export function reproducePaperCase(caseId: string, includeFrames = false) {
  if (!caseIds.has(caseId as PaperLegacyCaseId)) {
    throw new ContractError("Unknown paper reproduction case.", [{
      path: "case",
      message: `Expected one of ${[...caseIds].join(", ")}.`,
    }]);
  }
  const result = simulateLegacyPaperCase(caseId as PaperLegacyCaseId);
  return {
    schemaVersion: CONTRACT_VERSION,
    evidence: {
      kind: "synthetic-paper-reproduction",
      empiricalValidation: false,
      archivedSource: "toroidal_lab_results.zip",
      exactProtocol: true,
      expectedSha256: PAPER_LEGACY_EXPECTED_DIGESTS[result.caseId],
      digestInput: result.verificationPayload,
      note: "Compute SHA-256 over digestInput and compare with expectedSha256 after confirming matchesArchive is true.",
    },
    ...result,
    frames: includeFrames ? result.frames : undefined,
  };
}

export function listPaperCases() {
  return {
    schemaVersion: CONTRACT_VERSION,
    engineVersion: "paper-2026-legacy",
    cases: paperLegacyCases.map((item) => ({
      ...item,
      expectedSha256: PAPER_LEGACY_EXPECTED_DIGESTS[item.id],
    })),
  };
}
