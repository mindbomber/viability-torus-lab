# Composable systems laboratory

The laboratory separates reusable structure, a bounded real-world hypothesis, exogenous conditions, operator actions, and observed model output. This prevents the example catalog from becoming the model itself.

```text
System template
  → bounded-system instance
    → scenario module
      → intervention plan
        → run assessment
```

## Layer responsibilities

| Layer | Question | May change | Must not claim |
| --- | --- | --- | --- |
| System template | What structural class is being represented? | Base dynamics and rupture policy | That a real system is calibrated merely because it fits an archetype |
| Bounded system | Who operates what, for whom, over what horizon? | Boundary, objective, population, phase meanings, independent defaults | That a broad social condition is itself a bounded system |
| Scenario module | What external or operating conditions occur? | Canonical initial-condition transforms | That an operator acted |
| Intervention plan | What does the operator change, and when? | Timed canonical transforms, duration, restoration, cost | That the translated real-world action has an empirically known effect size |
| Run assessment | What did this deterministic model run do? | Nothing; this is computed output | A forecast, diagnosis, policy recommendation, or empirical validation |

## Registries

- Eight `SystemTemplateDefinition` records cover regenerative stocks, threshold regime shifts, resistance contagion, trust and legitimacy, capability correction, network cascades, financial leverage, and human capacity.
- Thirty-two `BoundedSystemDefinition` instances declare accountable operators, system boundaries, objectives, affected populations, horizons, aggregation rules, viable regions, state variables, constraints, and two independently observable recurrent phases.
- Five `ScenarioModuleDefinition` records provide common default, pressure-surge, feedback-blind-spot, compound-stress, and reduced-stress contexts.
- Six `InterventionDefinition` records encode constraint visibility, misclassification reduction, pressure reduction, correction capacity, containment, and debt repayment.
- Eight `InterventionPlanDefinition` records arrange those mechanisms into comparable no-action, preventive, corrective, restorative, delayed, layered, and temporary strategies.

Counts are discoverable rather than contractual; clients should enumerate the versioned endpoints instead of hard-coding them.

## Deterministic composition order

`composeLaboratoryRun` performs these operations in order:

1. Resolve `systemId` and its referenced template.
2. Resolve `protocolId` as either a concrete system protocol or a reusable scenario-module id.
3. Resolve the selected intervention plan, defaulting to `no-action`.
4. Start from the system's independently selected defaults and apply the scenario transforms.
5. Apply explicit parameter overrides.
6. Compile the plan's relative timing and intensity into absolute scheduled events.
7. Add validated custom events and sort all events deterministically.

The experiment fingerprint includes the selected template, system, protocol, intervention plan, final parameters, compiled events, seeds, and version identifiers.

## Reuse examples

Passing `protocolId: "pressure-surge"` applies the same canonical pressure question to an aquifer, an AI deployment, a hospital capacity system, or a financial network. The resulting concrete parameter values remain system-specific because the transform starts from each system's default calibration hypothesis.

Passing `interventionPlanId: "visibility-first"` schedules the same canonical sequence—improve feedback, then reduce misclassification—while the UI explains a different real-world translation for AI, ecology, healthcare, organizations, infrastructure, the economy, or society.

Passing `interventionPlanId: "temporary-containment"` creates a start event and a paired end event. This makes “buying time” observably different from a persistent pressure reduction and exposes the risk of resuming without structural correction.

## Educational comparison protocol

For a useful classroom or research-design exercise:

1. Run the bounded system's dated `system-default` present-state hypothesis with `no-action` and read why its default watchlist outlook was derived.
2. Keep the system fixed and change only the scenario module to test sensitivity to stress or degraded feedback.
3. Keep that scenario fixed and compare intervention plans to distinguish prevention, correction, containment, and restoration.
4. Inspect the dynamic “Why this run looks this way” explanation, correction margin, debt-adjusted margin, radial velocity, debt, loss, and phase-identifiability gates.
5. Export the exact configuration and evidence receipt with the model and registry versions.
6. Treat any real-world translation as a falsifiable hypothesis requiring measurement, calibration, feasibility analysis, and side-effect monitoring.

## Machine access

The complete registry is returned by `GET /api/v1/laboratory`. Narrow endpoints expose templates, systems, scenario modules, and interventions separately. CLI and MCP discovery commands mirror those endpoints. Simulation, comparison, and sweep requests all use the shared composition engine; no surface reimplements the transformations.

See `AGENT_INTERFACES.md` for request schemas and examples.
