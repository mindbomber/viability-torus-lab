# Architecture and maintenance guide

## Application architecture

The site is a scientific dashboard delivered through the vinext Sites runtime. It remains local-first for user state: there are no accounts, uploads, or cloud records. A saved preset uses browser storage, while shared runs serialize a validated subset of scenario, seed, and parameters into the URL. Stateless HTTP and MCP routes expose bounded, read-only computation without persisting requests or results.

The UI is organized into product views inside `app/page.tsx`. All views consume the same scenario definitions and simulation engine. The live torus, charts, status panel, explanations, comparisons, tables, and exports therefore derive from one authoritative frame sequence.

## Simulation update order

For each step:

1. Apply scheduled parameter interventions.
2. Compute divergence pressure `D = πε(1-γ) + Λ + Φ` and correction margin.
3. Split the requested `dt` into deterministic internal substeps no larger than `0.25`.
4. On each substep, update debt with `α[D-C]₊ - β[C-D]₊q(A)`, using `q(A)=exp(-ρ)`.
5. Advance both phases from the same prior state, draw deterministic seeded perturbations, and preserve unwrapped phase travel.
6. Update radial excursion from restoration, divergence, correction, and prior debt.
7. Derive alignment `A = exp(-ρ)` and classify viability status.
8. After the run, apply temporal/spectral phase-identifiability gates, estimate external phase from the synthetic mismatch signal, and classify the phase regime separately from viability.

Frame zero is the declared initial state; the first integration occurs at frame one. `engine/simulator.ts` caps a run at 10,000 output steps and returns both frames and a reproducible summary. The seeded generator is part of the exported engine surface and is covered by deterministic reference tests. Public work budgets charge internal substeps, not only returned frames.

## Machine contract

`contracts/` is the shared boundary for the CLI, HTTP API, MCP tools, configuration imports, proposal validation, and generated JSON Schemas. These surfaces call `engine/simulator.ts`; none reimplement the dynamics. Public operations apply both per-field limits and aggregate work budgets. Frames are opt-in and sampled to a total response budget.

Contract schemas are generated into `public/schemas/v1/`. Breaking changes require an explicit contract/API version decision; model-equation changes require a model-version decision and deterministic reference updates.

## Viability and phase diagnostics

Viability statuses are intentionally independent from phase diagnostics:

- Ruptured: `ρ >= ρcrit`
- Rupture approaching: `ρ >= 0.84 ρcrit`
- Recovering: negative radial velocity after material excursion or debt
- Expanding: radial velocity above `0.055`
- Debt accumulating: positive debt velocity with debt above `0.28`
- Drifting: correction margin below `-0.025`
- Fragile: excursion above half the critical radius or margin below `0.045`
- Warning: excursion above `0.34 ρcrit` or debt above `0.55`
- Stable: none of the above gates apply

The ordering is intentional: safety-critical radial states take precedence over lower-severity viability descriptions. Recovery is reported only when a warned, non-ruptured run ends with a sustained stable tail.

The external phase estimate is reported only when all of these conditions hold:

- mismatch amplitude is at least `0.02`;
- dominant spectral concentration is at least `0.2`;
- the dominant mismatch signal completes at least two cycles over the observation window; and
- the output sampling interval does not advance the major phase by `π/2` or more.

When identifiable, the phase regime is either recurrent winding or rational phase locking. Locking scans coprime signed ratios with numerator and denominator magnitudes up to four and requires a phase-locking value of at least `0.985`. The latent phase is available for synthetic ground-truth evaluation; the dashboard labels it as simulated and presents the estimator separately.

## Scenario schema and administration

`scenarios/catalog.ts` is the version-controlled published scenario registry. A scenario separates canonical variables from domain labels and supplies its title, version, category, cycles, viable region, hidden constraints, debt and loss mechanisms, defaults, and presets. Agent-created definitions remain draft proposal files until reviewed. To publish a scenario:

1. Add a typed definition to `scenarios`.
2. Map all visible canonical parameters.
3. Define both recurrent phases and test that they are meaningful in the domain.
4. Provide conservative viable, warning, rupture, and recovery interpretations.
5. Declare calibration status, parameter units, assumptions, references, and falsification criteria.
6. Add a deterministic reference configuration to the test suite.
7. Increment the scenario version in exported metadata.

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

The public application has no account, persistence, dataset upload, or arbitrary code path. Imported and posted JSON is size-limited, schema-checked, range-checked, and never evaluated or rendered as HTML. API and MCP operations are read-only and bounded by runs, steps, candidates, returned frames, and total integration work. Local analytics store only named UI events and structured values in session storage. No raw custom-system text is collected.

## Troubleshooting

- If the torus is not animating, verify that motion is not paused and reduced-motion settings are not forcing an effectively static transition.
- If a shared link is ignored, confirm the scenario id exists and numeric values are finite.
- If an import fails, export a fresh configuration and compare its `configuration` envelope and model version.
- If a build reports an engine requirement, use Node.js 22.13 or newer.

## Known limitations

The model is synthetic and scenario thresholds are illustrative. The custom-system builder generates a template-based definition rather than arbitrary equations. Presets are device-local. There is no user authentication, collaborative experiment history, uploaded data, durable job queue, empirical calibration pipeline, or automatic scenario marketplace. Public ensembles and sweeps are intentionally bounded synchronous computations.
