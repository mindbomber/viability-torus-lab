# Architecture and maintenance guide

## Application architecture

The site is a scientific dashboard delivered through the vinext Sites runtime. It remains local-first for user state: there are no accounts, uploads, or cloud records. A saved preset uses browser storage, while shared runs serialize a validated subset of scenario, seed, and parameters into the URL. Stateless HTTP and MCP routes expose bounded, read-only computation without persisting requests or results.

The UI is organized into product views inside `app/page.tsx`. The laboratory has five explicit layers: `MaintenancePatternDefinition` supplies recurrent maintenance dynamics; `BoundedSystemDefinition` separately names the domain, dynamic traits, concrete boundary, and accountable operator; `ScenarioModuleDefinition` supplies reusable exogenous conditions; `InterventionPlanDefinition` compiles reusable corrective mechanisms into timed actions; and `RunAssessment` records the resulting dynamic explanation, watchlist assessment, frame, and summary. The live torus, charts, status panel, explanations, comparisons, tables, and exports derive from one authoritative frame sequence.

`scenarios/composition.ts` is the single composition boundary. It resolves a maintenance pattern and bounded system, applies one scenario module to that system's independently selected defaults, applies explicit parameter overrides, compiles one intervention plan, appends any validated custom intervention events, and returns the exact engine inputs. Scenarios never imply an operator action, interventions never redefine the system, and assessment is always an output.

## Simulation update order

For each step:

1. Apply scheduled parameter interventions.
2. Compute divergence pressure `D = πε(1-γ) + Λ + Φ` and correction margin.
3. Split the requested `dt` into deterministic internal substeps no larger than `0.25`.
4. On each substep, update debt with `α[D-C]₊ - β[C-D]₊q(A)`, using `q(A)=exp(-ρ)`.
5. Advance both phases from the same prior state, draw deterministic seeded perturbations, and preserve unwrapped phase travel.
6. Update radial excursion from restoration, divergence, correction, and prior debt.
7. Derive the paper's toy visualization proxy `A = exp(-ρ)` and apply the dashboard's illustrative viability-status rule.
8. After the run, apply temporal/spectral phase-identifiability gates, estimate external phase from the synthetic mismatch signal, and classify the phase regime separately from viability.

Frame zero is the declared initial state; the first integration occurs at frame one. `engine/simulator.ts` caps a run at 10,000 output steps and returns both frames and a reproducible summary. The seeded generator is part of the exported engine surface and is covered by deterministic reference tests. Public work budgets charge internal substeps, not only returned frames.

## Machine contract

`contracts/` is the shared boundary for the CLI, HTTP API, MCP tools, configuration imports, proposal validation, and generated JSON Schemas. These surfaces call `engine/simulator.ts`; none reimplement the dynamics. Public operations apply both per-field limits and aggregate work budgets. Frames are opt-in and sampled to a total response budget.

Contract schemas are generated into `public/schemas/v1/`. Breaking changes require an explicit contract/API version decision; model-equation changes require a model-version decision and deterministic reference updates.

The maintenance-pattern catalog revision retains the v1 transport and compatibility fields while changing the published registry. The seven patterns and 21 published systems carry registry version `2.0.0`. New records expose `maintenancePatternId`, `domain`, and `dynamicTraits`; `modelFamily`, `templateId`, `template`, `/api/v1/system-templates`, CLI `templates`, and MCP `list_system_templates` remain compatibility aliases. Experiment requests still prefer `systemId`, a concrete protocol id or reusable scenario-module id in `protocolId`, and `interventionPlanId`. Removed broad examples are no longer resolvable as published systems; saved studies should migrate to one of the 21 bounded system ids before rerunning.

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

These labels and numerical cutoffs are educational product rules, not status classes or calibrated thresholds supplied by the paper. The ordering is intentional: safety-critical radial states take precedence over lower-severity viability descriptions. Recovery is reported only when a warned, non-ruptured run ends with a sustained stable tail.

The external phase estimate is reported only when all of these conditions hold:

- mismatch amplitude is at least `0.02`;
- dominant spectral concentration is at least `0.2`;
- the dominant mismatch signal completes at least two cycles over the observation window; and
- the output sampling interval does not advance the major phase by `π/2` or more.

When identifiable, the phase regime is either recurrent winding or rational phase locking. Locking scans coprime signed ratios with numerator and denominator magnitudes up to four and requires a phase-locking value of at least `0.985`. The latent phase is available for synthetic ground-truth evaluation; the dashboard labels it as simulated and presents the estimator separately.

## Composable laboratory schema

The five registries have separate responsibilities:

- `scenarios/templates.ts` defines seven maintenance patterns, their base dynamics, characteristic traits, structural assumptions, learning questions, and rupture policy.
- `scenarios/systems.ts` supplies the concrete operator, boundary, objective, population, horizon, aggregation rule, and independently selected default parameters for each bounded system.
- `scenarios/protocols.ts` defines common exogenous condition modules and resolves their canonical transforms into system-specific protocols.
- `scenarios/interventions.ts` defines corrective mechanisms, real-world translations, compatibility, timing semantics, and reusable plans.
- `engine/assessment.ts` constructs the output layer after a run; it does not select inputs.

`scenarios/catalog.ts` publishes the resolved combinations. Broad conditions such as drought, engagement pressure, delayed restoration, or demand shocks belong to scenario modules rather than standing in for the system itself. Agent-created definitions remain draft proposal files until reviewed. To publish a system and its resolved protocols:

1. Choose or define the recurrent maintenance pattern independently of domain and desired watchlist outcome.
2. Define the bounded system, accountable operator, objective, population, horizon, aggregation rule, and viable region.
3. Define both recurrent phases, their observation sources, and the independence claim.
4. Resolve at least one compatible scenario module with conditions, stressors, learning objective, parameter rationale, and complete parameters.
5. Map all visible canonical parameters and reusable interventions to system-specific meanings.
6. Run the common watchlist classifier on the default scenario with no intervention and store its derived result; never select parameters from a desired color tier.
7. Provide conservative viable, warning, rupture, and recovery interpretations and disclose calibration status, units, assumptions, references, and falsification criteria.
8. Add deterministic composition and protocol references to the test suite and increment the version in exported metadata.

The current MVP uses version-controlled TypeScript rather than a graphical CMS.

## Intervention schema

An `InterventionDefinition` names a reusable ATS mechanism, canonical parameter transforms, compatible templates, onset and decay semantics, prerequisites, tradeoffs, illustrative cost, and category-specific real-world equivalents. An `InterventionPlanDefinition` combines those mechanisms by relative run timing and intensity. Compilation produces one or more `ScheduledIntervention` events with provenance back to both definition and plan.

Persistent actions change the active modeled parameters from their scheduled step onward. Temporary containment compiles a start event and a deterministic end event that restores the affected parameters after its declared duration. Custom one-off events remain supported and are appended after the selected plan. All compiled states are contract-validated; interventions cannot alter seed, steps, or integration interval. These modules are educational hypotheses, not evidence that the translated real-world action will have the modeled magnitude or effect.

## 3D rendering

The torus is rendered with a lightweight high-DPI Canvas 2D projection of a parametric 3D mesh. This avoids a large WebGL payload while retaining rotation, pan, zoom, wireframe, fullscreen, state deformation, trajectory selection, and animated motion. A complete unwrapped 2D view and text summary are always available. Geometry is deformed from the current radial excursion and debt; visual deformation never feeds back into the simulation model. The local warp is explicitly illustrative of the paper's phase-dependent radial field: the engine does not currently simulate separate `D(θ,φ)`, `C(θ,φ)`, and `Δ(θ,φ)` fields.

## Paper-traceable visualization semantics

- The unwrapped torus follows Section 12: `θ` (local correction phase) is horizontal and `φ` (external adaptation phase) is vertical, with opposite edges identified.
- Synthetic latent `φ` is the default ground-truth view. Offline estimated `φ` becomes selectable only after a complete run passes the identifiability gates.
- The time-series defaults to a causal disclosure mode that renders only frames reached by playback. A clearly labeled projection mode can reveal the precomputed full run.
- `A = exp(-ρ)` is always labeled as a toy alignment proxy, not an ATS probability mass or empirically validated alignment score.
- The radial stability plot is an Equation 11 slice: positive `dρ/dt` is expansion, negative `dρ/dt` is contraction, and current `χΔ` is held fixed while the `C-D` reference curves are compared.
- Research mode exposes `α`, `β`, `a`, and `b` alongside `κ`, `χ`, `ωθ`, `ωφ`, `ρ₀`, and `ρcrit`, so every implemented debt and phase dynamic can be varied from the interface.

## Educational watchlist classification

`engine/watchlist.ts` derives Red, Orange, or Yellow from four common deterministic protocols and four fixed seeds. The ordinary baseline, temporary stress, compound stress, and timely-action protocols all use the engine's canonical rupture policy so a tier is an outcome of parameter behavior rather than a tier-specific threshold. Red means failure is already present under the ordinary baseline; Orange includes sustained Warning/Fragile operation or material stress sensitivity without baseline rupture; Yellow means recoverable operation across this illustrative stress suite.

The interface keeps the full causal sequence separate: the bounded system, dated default present-state hypothesis, selected future scenario protocol, derived default watchlist outlook, recomputed outlook for the current slider configuration, and live frame status during playback. Editorial featured status is independent of the risk classifier. `scenarios/calibration.ts` supplies a candidate observation window, cadence, time anchor, review cadence, and observable proxy for all 17 model parameters. `scenarios/education.ts` maps every simulation parameter to its equation role, system-specific proxy, scale interpretation, and conditional predicted direction. These outputs are educational model claims, not fitted forecasts or operational recommendations.

### Watchlist v2 migration note

`educational-watchlist-v2` adds the mean share of Warning/Fragile frames to every common protocol receipt and uses prolonged baseline strain as an Orange criterion. Boundary crossing and terminal rupture remain the Red criteria. The public `watchlistTier` field retains the same Red/Orange/Yellow semantics; the 21 published systems cache their independently derived default result.

## Browser-local Empirical Lab

The Empirical Lab is a deliberately bounded bridge from the scenario builder to observational work. A user documents the study boundary, imports a multi-column CSV, and explicitly maps observed columns to `t`, two recurrent phase signals, `π`, `ε`, `γ`, `C`, `Φ`, `Λ`, `Δ`, and `ρ`. Files are parsed and analyzed in the browser, limited to 2 MB, 5,000 rows, and 64 columns, and are neither uploaded nor persisted by the lab.

The torus replay is gated. Both phase signals must independently pass the existing sampling, amplitude, spectral-concentration, and cycle-count diagnostics; a low-order locking diagnostic and joint phase-coverage floor must also pass. A failed phase gate is reported as a valid negative result and withholds the torus view instead of forcing a topology claim.

When the gates pass, the first release evaluates the authoritative radial-balance equation one step at a time using observed drivers and user-declared `κ`, `ρ₀`, `χ`, and `ρcrit`. It does not fit those values. The first 70% of rows form a calibration segment for an empirical 90% residual interval, while the final 30% report holdout RMSE, MAE, and interval coverage. The cursor-linked explanation decomposes the modeled radial rate and residual at the current observation; it is explicitly model-based attribution, not causal identification or empirical validation.

Evidence export is a schema-validated JSON receipt containing the study definition, canonical parsed-table SHA-256 fingerprint, mappings, declared assumptions, gates, diagnostics, holdout metrics, versions, and limitations. Raw observations are excluded.

Failed phase gates are also exportable. Their receipt carries a null replay, a not-supported or insufficient-data classification, and the gate failure as negative evidence instead of silently dropping the study.

`empirical/headless.ts` is the shared server-side adapter over the same `analyzeEmpiricalStudy` core. The CLI, local MCP tools, authenticated remote MCP tools, and opt-in HTTP API all validate `empiricalResearchRequestSchema` and issue `empiricalResearchReceiptSchema`. They do not reimplement the equation or phase gates. Replay points are response-budgeted; receipts never contain source rows.

The stdio MCP server enables empirical table analysis by default. Its local-resource tool resolves real paths and accepts only `.csv` files inside `VTL_EMPIRICAL_ROOTS`, preventing path traversal and symlink escape. Connector-backed researchers should have their MCP client read the authorized resource, then pass the bounded rows and resource URI to `empirical_analyze_table`.

Remote empirical processing is deployment-gated. `/api/v1/empirical/analyze` is unavailable unless `VTL_ENABLE_EMPIRICAL_API=true`, requires `VTL_EMPIRICAL_API_TOKEN`, has a configurable single CORS origin, retains data for the request only, and does not log raw inputs in application code. Every remote request must independently declare data-use and remote-processing authorization. Sensitive or restricted data must be deidentified unless the operator explicitly changes the server policy. Reverse proxies, hosting platforms, and connector systems must separately disable body logging and enforce their own retention policies.

## Evidence Registry

`empirical/registry.ts` is a browser-safe, deterministic receipt-comparison engine shared by the Evidence Registry UI, CLI, MCP, and opt-in HTTP API. It normalizes both browser-local evidence bundles and headless research receipts, creates timestamp-independent receipt identities, removes duplicates, and compares each study with an explicit anchor.

Compatibility is conservative. Model version, scenario/version, population `ω`, aggregation rule `α`, viable region `X*`, two recurrent phase definitions, and mapped units are hard gates. A different horizon `τ`, missing or changed preprocessing, or different declared `κ`, `χ`, `ρ₀`, and `ρcrit` makes a receipt only partially comparable. Synthetic receipts are always excluded. Every decision includes dimension-level reasons, and non-combinability is treated as a valid result.

The cohort summary is descriptive only. It reports compatible receipt counts, phase-gate pass rate, negative studies preserved, holdout error and interval-coverage summaries, and declared-assumption ranges. It never pools raw rows, estimates a common effect, fits parameters, or averages watchlist colors. Negative, partially comparable, non-comparable, and synthetic studies remain visible outside the cohort.

The browser registry is session-only by default. Researchers can explicitly opt into saving the versioned redacted registry bundle in local storage; raw observations are never part of that bundle. `/api/v1/empirical/aggregate` and the remote MCP aggregation tool share the same disabled-by-default bearer-token deployment gate as empirical analysis. The local CLI command is `empirical-aggregate`.

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

The default public application has no account, persistence, enabled empirical upload, or arbitrary code path. Imported and posted JSON is size-limited, schema-checked, range-checked, and never evaluated or rendered as HTML. API and MCP operations are read-only and bounded by runs, steps, candidates, rows, columns, bytes, returned frames, and returned replay points. The optional self-hosted empirical API requires bearer-token authentication and explicit remote-processing consent. Local analytics store only named UI events and structured values in session storage. No raw custom-system text is collected.

## Troubleshooting

- If the torus is not animating, verify that motion is not paused and reduced-motion settings are not forcing an effectively static transition.
- If a shared link is ignored, confirm the scenario id exists and numeric values are finite.
- If an import fails, export a fresh configuration and compare its `configuration` envelope and model version.
- If a build reports an engine requirement, use Node.js 22.13 or newer.

## Known limitations

The model is synthetic and scenario thresholds are illustrative. The custom-system builder generates a maintenance-pattern-based definition rather than arbitrary equations. Presets are device-local. There is no account system, collaborative experiment history, durable job queue, automated parameter fitting, inferential meta-analysis, or automatic scenario marketplace. The Evidence Registry compares redacted receipts locally but does not create a shared evidence database. The opt-in researcher API uses a deployment bearer token rather than user identities and does not persist submitted data or results. Public ensembles and sweeps remain bounded synchronous computations.
