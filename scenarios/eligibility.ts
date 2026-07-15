import type { RecurrentPhaseDefinition, ScenarioDefinition } from "../contracts/types.ts";

export type PublishedTorusEligibility = {
  eligible: boolean;
  issues: string[];
};

function normalizedStages(cycle: RecurrentPhaseDefinition) {
  return cycle.stages.map((stage) => stage.trim()).filter(Boolean);
}

/**
 * Publication gate for educational system entries. This establishes that the
 * catalog declares a falsifiable two-cycle mapping; it does not claim that the
 * mapping has been empirically validated for the real-world domain.
 */
export function assessPublishedTorusEligibility(
  scenario: ScenarioDefinition,
): PublishedTorusEligibility {
  const issues: string[] = [];
  const minor = normalizedStages(scenario.cycles.minor);
  const major = normalizedStages(scenario.cycles.major);
  const systemMinor = normalizedStages(scenario.system.cycles.minor);
  const systemMajor = normalizedStages(scenario.system.cycles.major);

  if (minor.length < 2 || new Set(minor.map((stage) => stage.toLowerCase())).size < 2) {
    issues.push("The minor phase must contain at least two distinct recurrent stages.");
  }
  if (major.length < 2 || new Set(major.map((stage) => stage.toLowerCase())).size < 2) {
    issues.push("The major phase must contain at least two distinct recurrent stages.");
  }
  if (minor.join("→").toLowerCase() === major.join("→").toLowerCase()) {
    issues.push("The minor and major phases cannot be the same staged cycle.");
  }
  if (!Number.isFinite(scenario.cycles.minor.defaultFrequency) || scenario.cycles.minor.defaultFrequency <= 0) {
    issues.push("The minor phase must declare a positive finite frequency.");
  }
  if (!Number.isFinite(scenario.cycles.major.defaultFrequency) || scenario.cycles.major.defaultFrequency <= 0) {
    issues.push("The major phase must declare a positive finite frequency.");
  }
  if (scenario.cycles.minor.description.trim() === scenario.cycles.major.description.trim()) {
    issues.push("The two phases must have distinct operational meanings.");
  }
  if (minor.join("\u0000") !== systemMinor.join("\u0000") || major.join("\u0000") !== systemMajor.join("\u0000")) {
    issues.push("The scenario and bounded-system phase definitions must agree.");
  }
  if (scenario.system.phaseEvidence.thetaSource.trim().length < 20) {
    issues.push("The minor phase needs a declared observation source.");
  }
  if (scenario.system.phaseEvidence.phiSource.trim().length < 20) {
    issues.push("The major phase needs a declared observation source.");
  }
  if (scenario.system.phaseEvidence.independenceClaim.trim().length < 20) {
    issues.push("The two phases need an explicit independence claim and test boundary.");
  }

  return { eligible: issues.length === 0, issues };
}

export function assertPublishedTorusEligibility(scenarios: ScenarioDefinition[]) {
  const rejected = scenarios
    .map((scenario) => ({ scenario, assessment: assessPublishedTorusEligibility(scenario) }))
    .filter(({ assessment }) => !assessment.eligible);
  if (rejected.length === 0) return;
  throw new Error(rejected
    .map(({ scenario, assessment }) => `${scenario.id}: ${assessment.issues.join(" ")}`)
    .join("\n"));
}
