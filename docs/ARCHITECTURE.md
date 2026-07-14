# Architecture and maintenance guide

## Application architecture

The site is a client-side scientific dashboard delivered through the vinext Sites runtime. The application keeps the MVP intentionally local-first: there are no accounts, uploads, or cloud records. A saved preset uses browser storage, while shared runs serialize a validated subset of scenario, seed, and parameters into the URL.

The UI is organized into product views inside `app/page.tsx`. All views consume the same scenario definitions and simulation engine. The live torus, charts, status panel, explanations, comparisons, tables, and exports therefore derive from one authoritative frame sequence.

## Simulation update order

For each step:

1. Apply scheduled parameter interventions.
2. Draw deterministic seeded perturbations.
3. Compute divergence pressure `D = πε(1-γ) + Λ + Φ`.
4. Update debt with accumulation and repayment terms.
5. Compute radial velocity and update `ρ`.
6. Advance and wrap local phase `θ` and external phase `φ`.
7. Derive alignment `A = exp(-ρ)`.
8. Classify status from documented radial, debt, correction-margin, and phase gates.

`engine/simulator.ts` caps a run at 10,000 steps and returns both frames and a reproducible summary. The seeded generator is part of the exported engine surface and is covered by a fixed deterministic test.

## Status thresholds

- Ruptured: `ρ >= ρcrit`
- Rupture approaching: `ρ >= 0.84 ρcrit`
- Recovering: negative radial velocity after material excursion or debt
- Expanding: radial velocity above `0.055`
- Debt accumulating: positive debt velocity with debt above `0.28`
- Phase not identifiable: the combined phase frequencies are below `0.015`
- Phase locked: the current 2:1 phase residual is within `0.055` radians
- Drifting: correction margin below `-0.025`
- Fragile: excursion above half the critical radius or margin below `0.045`
- Warning: excursion above `0.34 ρcrit` or debt above `0.55`
- Stable: none of the above gates apply

The ordering is intentional: safety-critical radial states take precedence over descriptive phase states.

## Scenario schema and administration

`scenarios/catalog.ts` is the version-controlled scenario registry. A scenario separates canonical variables from domain labels and supplies its title, category, cycles, viable region, hidden constraints, debt and loss mechanisms, defaults, and presets. To publish a scenario:

1. Add a typed definition to `scenarios`.
2. Map all visible canonical parameters.
3. Define both recurrent phases and test that they are meaningful in the domain.
4. Provide conservative viable, warning, rupture, and recovery interpretations.
5. Add a deterministic reference configuration to the test suite.
6. Increment the scenario version in exported metadata.

The current MVP uses version-controlled TypeScript rather than a graphical CMS.

## Intervention schema

An intervention records an id, label, step, absolute parameter effects, and cost. During simulation it changes only modeled parameters and is included in configuration exports and run summaries. Delays, durations, and cooldowns can be added without changing frame consumers by expanding `ScheduledIntervention` and the event application step.

## 3D rendering

The torus is rendered with a lightweight high-DPI Canvas 2D projection of a parametric 3D mesh. This avoids a large WebGL payload while retaining rotation, pan, zoom, wireframe, fullscreen, state deformation, trajectory selection, and animated motion. A complete unwrapped 2D view and text summary are always available. Geometry is deformed from the current radial excursion and debt; visual deformation never feeds back into the simulation model.

## Accessibility

- Semantic controls and labels are keyboard reachable.
- Slider labels expose both scenario language and canonical symbols.
- Status changes use text and an `aria-live` region, not color alone.
- All charts include accessible descriptions and a data-table alternative.
- The torus canvas has a dynamic textual summary and a 2D fallback.
- Visible focus states, reduced-motion behavior, a skip link, high-contrast mode, and mobile touch targets are included.

## Performance

The torus uses adaptive mesh detail, a device-pixel-ratio cap, and a single animation frame loop. Charts render only when their frame data or container size changes. Runs are deterministic, bounded, and avoid per-frame React state beyond the playback cursor. For production studies beyond 10,000 steps or large ensembles, move `simulate` into a Web Worker or server-side job and preserve the same output schema.

## Security and privacy

The public MVP has no account, backend, dataset upload, or arbitrary code path. Imported JSON is size-limited, schema-checked, range-checked, and never evaluated or rendered as HTML. Local analytics store only named UI events and structured values in session storage. No raw custom-system text is collected.

## Troubleshooting

- If the torus is not animating, verify that motion is not paused and reduced-motion settings are not forcing an effectively static transition.
- If a shared link is ignored, confirm the scenario id exists and numeric values are finite.
- If an import fails, export a fresh configuration and compare its `configuration` envelope and model version.
- If a build reports an engine requirement, use Node.js 22.13 or newer.

## Known limitations

The model is synthetic and scenario thresholds are illustrative. The custom-system builder generates a template-based definition rather than arbitrary equations. Presets are device-local. There is no user authentication, collaborative experiment history, uploaded data, server-side ensemble execution, or public scenario marketplace in this MVP.
