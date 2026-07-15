import assert from "node:assert/strict";
import test from "node:test";

import { assessWatchlistConfiguration } from "../engine/watchlist.ts";
import { parameterEducationFor } from "../scenarios/education.ts";
import { scenarios } from "../scenarios/catalog.ts";

const publishedWatchlist = scenarios;

test("common outcome protocols independently reproduce all published watchlist tiers", () => {
  for (const scenario of publishedWatchlist) {
    const assessment = assessWatchlistConfiguration(scenario.defaults);
    assert.equal(
      assessment.tier,
      scenario.watchlistTier,
      `${scenario.id} should derive ${scenario.watchlistTier} from its parameters`,
    );
  }
});

test("orange and yellow defaults have meaningfully different stress outcomes", () => {
  const orange = scenarios.find((scenario) => scenario.id === "llm-deployment");
  const yellow = scenarios.find((scenario) => scenario.id === "data-governance");
  assert.ok(orange && yellow);
  const orangeAssessment = assessWatchlistConfiguration(orange.defaults);
  const yellowAssessment = assessWatchlistConfiguration(yellow.defaults);

  assert.equal(orangeAssessment.protocols.baseline.terminalRate, 0);
  assert.ok(orangeAssessment.protocols["compound-stress"].terminalRate >= 0.25);
  assert.equal(yellowAssessment.protocols["compound-stress"].terminalRate, 0);
  assert.equal(yellowAssessment.protocols["compound-stress"].boundaryCrossingRate, 0);
});

test("a visible early-correction protocol can improve red and orange current tiers", () => {
  for (const id of ["antimicrobial-resistance", "llm-deployment"]) {
    const scenario = scenarios.find((item) => item.id === id);
    assert.ok(scenario);
    const recovery = scenario.protocols.find((protocol) => protocol.id.endsWith("early-correction"));
    assert.ok(recovery);
    const changed = assessWatchlistConfiguration(recovery.parameters);
    assert.notEqual(changed.tier, scenario.watchlistTier);
    assert.equal(changed.tier, id === "antimicrobial-resistance" ? "orange" : "yellow");
  }
});

test("watchlist assessment is deterministic and uses a tier-independent canonical policy", () => {
  const scenario = scenarios.find((item) => item.id === "antimicrobial-resistance");
  assert.ok(scenario);
  assert.deepEqual(
    assessWatchlistConfiguration(scenario.defaults),
    assessWatchlistConfiguration(scenario.defaults),
  );
  assert.equal(assessWatchlistConfiguration(scenario.defaults).protocolVersion, "educational-watchlist-v2");
});

test("sustained Warning or Fragile baseline status is visible in the orange outlook", () => {
  for (const id of ["groundwater-depletion", "engagement-recommender"]) {
    const scenario = scenarios.find((item) => item.id === id);
    assert.ok(scenario);
    const assessment = assessWatchlistConfiguration(scenario.defaults);
    assert.equal(assessment.tier, "orange");
    assert.ok(assessment.protocols.baseline.meanWarningOrFragileFraction >= 0.5, id);
    assert.match(assessment.reasons[0], /Warning or Fragile status/i, id);
  }
});

test("parameter education covers every engine parameter with scenario-specific equivalents", () => {
  const scenario = scenarios.find((item) => item.id === "groundwater-depletion");
  assert.ok(scenario);
  const education = parameterEducationFor(scenario, scenario.defaults);
  const rows = [...education.primary, ...education.advanced];
  assert.equal(rows.length, Object.keys(scenario.defaults).length);
  assert.equal(new Set(rows.map((row) => row.key)).size, Object.keys(scenario.defaults).length);
  assert.equal(education.primary.find((row) => row.key === "pressure")?.realWorldEquivalent, "Agricultural, industrial & urban withdrawal");
  assert.match(education.primary.find((row) => row.key === "pressure")?.observationProxy ?? "", /withdrawal/i);
  assert.ok(rows.filter((row) => !["seed", "steps", "dt"].includes(row.key)).every((row) => row.observationProxy && row.proxyNormalization && row.updateCadence));
  assert.ok(rows.every((row) => row.modelRole && row.scale && row.predictedEffect));
});
