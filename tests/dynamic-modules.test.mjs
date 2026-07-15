import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAix,
  explainSimulationFrame,
  simulate,
} from "../engine/simulator.ts";
import {
  activeParametersAtFrame,
  nextPlaybackFrameIndex,
  viabilityJourneyAt,
} from "../engine/assessment.ts";
import {
  deriveTorusGeometry,
  phaseAnalysisAvailable,
  timeSeriesScales,
} from "../components/charts/visualizationMath.ts";
import { scenarios } from "../scenarios/catalog.ts";
import {
  compileInterventionPlan,
  interventionAppliesTo,
  interventionPlans,
} from "../scenarios/interventions.ts";

function transitionIndices(frames, interventionSteps = new Set()) {
  const indices = [];
  for (let index = 1; index < frames.length; index += 1) {
    if (
      interventionSteps.has(frames[index].step)
      || frames[index].status !== frames[index - 1].status
      || frames[index].viabilityState !== frames[index - 1].viabilityState
    ) indices.push(index);
  }
  return indices;
}

function visitedPlaybackIndices(frames, stride, interventionSteps = new Set()) {
  const visited = new Set([0]);
  let current = 0;
  while (current < frames.length - 1) {
    const next = nextPlaybackFrameIndex(frames, current, stride, interventionSteps);
    assert.ok(next > current, `Playback did not advance from step ${current}.`);
    visited.add(next);
    current = next;
  }
  return visited;
}

test("all published system scenarios keep status, geometry, AIx, explanation, and playback causal", () => {
  let runCount = 0;
  let checkpointCount = 0;
  for (const scenario of scenarios) {
    for (const protocol of scenario.protocols) {
      runCount += 1;
      const parameters = protocol.parameters;
      const { frames, summary } = simulate(parameters, [], { rupturePolicy: scenario.rupturePolicy });
      const label = `${scenario.id}/${protocol.id}`;
      assert.equal(frames.length, parameters.steps, `${label}: frame count`);

      const boundary = frames.find((frame) => frame.viabilityState === "Viability-boundary crossing");
      const terminal = frames.find((frame) => frame.viabilityState === "Irreversible rupture");
      assert.equal(summary.boundaryCrossingStep, boundary?.step, `${label}: boundary summary`);
      assert.equal(summary.irreversibleRuptureStep, terminal?.step, `${label}: terminal summary`);
      if (terminal) {
        assert.ok(
          frames.slice(terminal.step).every((frame) => frame.viabilityState === "Irreversible rupture"),
          `${label}: terminal state must remain latched`,
        );
      }

      const transitions = transitionIndices(frames);
      for (const stride of [2, 4, 8]) {
        const visited = visitedPlaybackIndices(frames, stride);
        for (const transition of transitions) {
          assert.ok(visited.has(transition), `${label}: ${stride}x playback skipped transition ${transition}`);
        }
      }

      const checkpoints = new Set([
        0,
        Math.min(frames.length - 1, 1),
        summary.firstWarningStep,
        summary.boundaryCrossingStep,
        summary.boundaryCrossingStep === undefined ? undefined : Math.min(frames.length - 1, summary.boundaryCrossingStep + 1),
        summary.irreversibleRuptureStep,
        frames.length - 1,
      ].filter((value) => value !== undefined));

      for (const frameIndex of checkpoints) {
        checkpointCount += 1;
        const visibleFrames = frames.slice(0, frameIndex + 1);
        const frame = frames[frameIndex];
        const journey = viabilityJourneyAt(frames, frameIndex);
        const visibleJourney = viabilityJourneyAt(visibleFrames, visibleFrames.length - 1);
        assert.deepEqual(journey, visibleJourney, `${label}: journey leaked future data at ${frameIndex}`);

        const fullGeometry = deriveTorusGeometry(frames, frameIndex, parameters, scenario.rupturePolicy);
        const visibleGeometry = deriveTorusGeometry(visibleFrames, visibleFrames.length - 1, parameters, scenario.rupturePolicy);
        assert.deepEqual(fullGeometry, visibleGeometry, `${label}: torus geometry leaked future data at ${frameIndex}`);

        const aix = evaluateAix(frame, parameters);
        assert.ok(Number.isFinite(aix.score) && aix.score >= 0 && aix.score <= 100, `${label}: invalid live AIx at ${frameIndex}`);
        const explanation = explainSimulationFrame(visibleFrames, summary, parameters, {
          complete: frameIndex === frames.length - 1,
          rupturePolicy: scenario.rupturePolicy,
        });
        assert.equal(explanation.statusLabel === "Irreversible rupture", frame.viabilityState === "Irreversible rupture", `${label}: explanation status at ${frameIndex}`);
        if (frameIndex < frames.length - 1 && frame.viabilityState !== "Irreversible rupture") {
          assert.match(explanation.outcome, /final outcome is not yet shown/i, `${label}: future outcome leaked at ${frameIndex}`);
        }

        const scales = timeSeriesScales(visibleFrames, parameters);
        assert.equal(scales.debt, Math.max(1, ...visibleFrames.map((item) => item.debt)), `${label}: causal debt scale at ${frameIndex}`);
        assert.equal(scales.rho, Math.max(parameters.rhoCrit, ...visibleFrames.map((item) => item.rho)), `${label}: causal rho scale at ${frameIndex}`);
        assert.equal(phaseAnalysisAvailable(frameIndex, frames.length), frameIndex === frames.length - 1, `${label}: phase disclosure at ${frameIndex}`);
      }
    }
  }
  assert.equal(runCount, scenarios.length * 5);
  assert.ok(checkpointCount > runCount * 3);
});

test("all compatible intervention plans update active parameters causally and remain visible at accelerated playback", () => {
  let composedRuns = 0;
  for (const scenario of scenarios) {
    const protocol = scenario.protocols.find((item) => item.id === scenario.defaultProtocolId) ?? scenario.protocols[0];
    for (const plan of interventionPlans) {
      if (!interventionAppliesTo(plan.compatibleTemplateIds, scenario.system.templateId)) continue;
      composedRuns += 1;
      const events = compileInterventionPlan(plan, protocol.parameters);
      const eventSteps = new Set(events.map((event) => event.step));
      const { frames } = simulate(protocol.parameters, events, { rupturePolicy: scenario.rupturePolicy });
      const visited = visitedPlaybackIndices(frames, 8, eventSteps);

      for (const event of events) {
        assert.ok(visited.has(event.step), `${scenario.id}/${plan.id}: playback skipped intervention step ${event.step}`);
        const before = activeParametersAtFrame(protocol.parameters, events, Math.max(0, event.step - 1));
        const active = activeParametersAtFrame(protocol.parameters, events, event.step);
        for (const [key, value] of Object.entries(event.effects)) {
          assert.equal(active[key], value, `${scenario.id}/${plan.id}: ${key} not active at step ${event.step}`);
          if (event.step > 0 && before[key] !== value) assert.notEqual(before[key], value, `${scenario.id}/${plan.id}: ${key} leaked before step ${event.step}`);
        }
        const aix = evaluateAix(frames[event.step], active);
        assert.ok(Number.isFinite(aix.score), `${scenario.id}/${plan.id}: live AIx invalid at intervention ${event.step}`);
      }
    }
  }
  assert.ok(composedRuns >= scenarios.length * 7);
});
