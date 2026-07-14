import assert from "node:assert/strict";
import test from "node:test";

import { assessWatchlistConfiguration } from "../engine/watchlist.ts";
import { parameterEducationFor } from "../scenarios/education.ts";
import { scenarios } from "../scenarios/catalog.ts";

const publishedWatchlist = scenarios.filter((scenario) => scenario.watchlistTier !== "featured");

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
  const orange = scenarios.find((scenario) => scenario.id === "ai-agent-ecosystems");
  const yellow = scenarios.find((scenario) => scenario.id === "data-governance");
  assert.ok(orange && yellow);
  const orangeAssessment = assessWatchlistConfiguration(orange.defaults);
  const yellowAssessment = assessWatchlistConfiguration(yellow.defaults);

  assert.equal(orangeAssessment.protocols.baseline.terminalRate, 0);
  assert.ok(orangeAssessment.protocols["compound-stress"].terminalRate >= 0.25);
  assert.equal(yellowAssessment.protocols["compound-stress"].terminalRate, 0);
  assert.equal(yellowAssessment.protocols["compound-stress"].boundaryCrossingRate, 0);
});

test("a visible recovery parameter package can change red and orange current tiers", () => {
  for (const id of ["climate-biosphere", "ai-agent-ecosystems"]) {
    const scenario = scenarios.find((item) => item.id === id);
    assert.ok(scenario);
    const recovery = scenario.presets.find((preset) => preset.name === "Recovery");
    assert.ok(recovery);
    const changed = assessWatchlistConfiguration({ ...scenario.defaults, ...recovery.values });
    assert.equal(changed.tier, "yellow");
    assert.equal(changed.protocols["compound-stress"].terminalRate, 0);
  }
});

test("watchlist assessment is deterministic and uses a tier-independent canonical policy", () => {
  const scenario = scenarios.find((item) => item.id === "climate-biosphere");
  assert.ok(scenario);
  assert.deepEqual(
    assessWatchlistConfiguration(scenario.defaults),
    assessWatchlistConfiguration(scenario.defaults),
  );
});

test("parameter education covers every engine parameter with scenario-specific equivalents", () => {
  const scenario = scenarios.find((item) => item.id === "climate-biosphere");
  assert.ok(scenario);
  const education = parameterEducationFor(scenario, scenario.defaults);
  const rows = [...education.primary, ...education.advanced];
  assert.equal(rows.length, Object.keys(scenario.defaults).length);
  assert.equal(new Set(rows.map((row) => row.key)).size, Object.keys(scenario.defaults).length);
  assert.equal(education.primary.find((row) => row.key === "pressure")?.realWorldEquivalent, "Emissions, extraction & land-use pressure");
  assert.ok(rows.every((row) => row.modelRole && row.scale && row.predictedEffect));
});
