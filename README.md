# Viability Torus Lab

[![Viability Torus Lab — agent-operable toroidal viability experiments](public/og.png)](https://viability-torus-lab.citizen-of-earth.chatgpt.site)

Viability Torus Lab is an interactive ATS/AANA/AIx simulation environment. It maps a fast local correction phase and a slower external adaptation phase onto a torus, then uses radial excursion, correction capacity, divergence pressure, alignment debt, and irreversible loss to explain whether a system stays viable, drifts, recovers, or ruptures.

## Local development

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run schemas:generate
npm run typecheck
npm test
npm run lint
npm run build
```

## Agent and programmatic use

The dashboard, CLI, HTTP API, and MCP server all call the same deterministic `torus-1.2.0` engine and use contract version `1.0.0`. Results include reproducible experiment fingerprints, scenario calibration statements, explicit boundary/recovery/terminal states, and a synthetic-evidence receipt.

Run a checked-in experiment:

```bash
npm run experiment -- --config experiments/deployment-stress.json
npm run sweep -- --config experiments/deployment-sweep.json
npm run vtl -- compare --config experiments/deployment-comparison.json
```

Read JSON from stdin by passing `--config -`, or add `--out result.json` for a file. Use `npm run vtl -- help` for all commands.

Start the local stdio MCP server:

```bash
npm run mcp
```

The local server exposes the headless empirical tools. `empirical_analyze_table` accepts connector-provided rows or CSV content; `empirical_analyze_resource` reads a local CSV only from an approved root; `empirical_aggregate_receipts` compares redacted receipts and summarizes only a compatible observed cohort. Configure those roots before startup (use the platform path delimiter for multiple roots):

```powershell
$env:VTL_EMPIRICAL_ROOTS="C:\Research\Approved Data"
npm run mcp
```

The checked-in `.codex/config.toml` registers the stdio server for trusted Codex workspaces. The public deployment also exposes a stateless Streamable HTTP MCP endpoint at `/mcp`, but remote empirical tools appear only when the self-hosted empirical service is enabled and the MCP request carries its bearer token.

Public discovery and data contracts:

- `/.well-known/viability-torus-lab.json` - service description
- `/llms.txt` - concise agent instructions
- `/api/v1/model` - versions, capabilities, bounds, and endpoints
- `/api/v1/laboratory` - the complete composable registry and five-layer workflow
- `/api/v1/system-templates` - reusable structural system classes
- `/api/v1/systems` - bounded-system instances, resolved protocols, derived default tiers, and separate featured flags
- `/api/v1/scenario-modules` - reusable baseline, stress, and recovery-context transformations
- `/api/v1/interventions` - reusable corrective mechanisms and timed intervention plans
- `/api/v1/scenarios` - v1 compatibility alias for the system registry
- `POST /api/v1/simulate` - single-seed or ensemble execution
- `POST /api/v1/compare` - paired experiment comparison
- `POST /api/v1/sweep` - bounded parameter search
- `POST /api/v1/proposals/validate` - draft-only scenario evidence validation
- `GET /api/v1/research/paper?case=stable-periodic` - exact versioned legacy-paper fixture reproduction
- `POST /api/v1/telemetry` - external `time,mismatch` telemetry analysis
- `POST /api/v1/empirical/analyze` - opt-in, token-protected headless empirical analysis for self-hosted research deployments
- `POST /api/v1/empirical/aggregate` - opt-in, token-protected compatibility and descriptive aggregation for redacted receipts
- `/schemas/v1/index.json` - JSON Schema catalog

See `docs/LABORATORY_COMPOSITION.md` for the five-layer model and `docs/AGENT_INTERFACES.md` for request examples, limits, errors, and MCP tools.

The empirical HTTP endpoint is disabled by default. A self-hosted operator must set `VTL_ENABLE_EMPIRICAL_API=true` and `VTL_EMPIRICAL_API_TOKEN`, and should set `VTL_EMPIRICAL_API_ORIGIN` to the one browser origin allowed to read responses. Remote requests must still declare `privacy.remoteProcessingAuthorized: true`. Sensitive or restricted data are rejected unless deidentified; changing that default additionally requires `VTL_ALLOW_SENSITIVE_EMPIRICAL_DATA=true`.

## Product areas

- Live bounded-system simulator with 3D and accessible 2D torus views
- A composable educational laboratory: `SystemTemplate → BoundedSystem → ScenarioModule → InterventionPlan → RunAssessment`
- Eight reusable structural templates and 32 bounded-system instances; every instance declares an operator, boundary, objective, population, horizon, aggregation rule, viable region, and two observable recurrent phases
- Five reusable scenario modules that apply the same baseline, stress, feedback-loss, compound-stress, or recovery-context question to compatible systems
- Six reusable intervention mechanisms and eight intervention plans with explicit timing, duration, prerequisites, tradeoffs, illustrative cost, and domain-specific real-world translations
- Default red/orange/yellow watchlist outlooks are cached classifier outputs from independently chosen per-system protocol parameters; 10 editorially featured systems are flagged separately and still retain their derived watchlist result
- Deterministic seeded simulation, playback controls, interventions, and explanations
- Dated, low-confidence present-state hypotheses for all 32 published systems, with candidate observation windows, cadences, time anchors, review schedules, and proposed observable proxies for all 17 model parameters
- Explainable educational watchlist-v2 receipts that separate the default present-state outlook, the recalculated current-slider outlook, and the illustrative frame-by-frame status; prolonged Warning/Fragile operation is visible even without boundary rupture
- Paper-traceable chart interactions: Section 12 θ/φ axis order, gated latent-versus-estimated external phase, causal-versus-projected time disclosure, an explicitly toy `A=e⁻ρ` proxy, and Equation 11 expansion/contraction semantics
- Separate viability-boundary crossing, recoverable excursion, and policy-triggered irreversible rupture states with a reduced-motion-aware fragment visualization
- Versioned Experiments workspace for paper reproduction, topology, hysteresis, coupled tori, navigation, and imported telemetry
- Browser-local Empirical Lab for documented multi-column CSV observations: explicit paper-variable mapping, two-phase recurrence/independence gates, one-step observed-driver replay, calibration-residual uncertainty, holdout metrics, dynamic model attribution, and redacted evidence receipts
- Browser-local Evidence Registry for importing redacted receipts, selecting an anchor study, explaining compatibility failures, preserving negative and synthetic studies, and summarizing only compatible observed receipts without averaging watchlist tiers
- Full eight-component ATS 4.0 AIx display and verifier-grounded AANA decision gate, clearly labeled as an uncalibrated synthetic diagnostic
- Unwrapped phase, time-series, and radial-stability charts with table alternatives
- Side-by-side compare mode and difference summaries
- Template-based custom-system builder that requires a structural template, bounded operator, population, horizon, aggregation rule, two independently observable phases, and explicit protocols
- Guided learning modules and full theory/paper section
- JSON, CSV, share-link, chart, and torus export tools
- Version-controlled template, bounded-system, scenario-module, intervention, and protocol registries for administrative maintenance
- Versioned JSON Schemas, CLI (`templates`, `systems`, `scenario-modules`, and `interventions`), HTTP API, and MCP tools for composable agent experiments
- Draft-only scenario proposal validation with human publication gates

## Repository map

- `app/` - responsive product shell and application views
- `components/simulation/` - interactive torus renderer and camera controls
- `components/charts/` - linked scientific canvas charts
- `components/research/` - experiment workspaces, evidence views, and ATS/AANA panels
- `engine/` - equations, seeded simulation, status classification, summaries
- `contracts/` - versioned validation, limits, experiment operations, and metadata
- `scenarios/` - structured domain definitions and parameter mappings
- `mcp/` - shared MCP tool server used by local stdio and public HTTP transports
- `scripts/` - CLI, MCP entry point, and schema generation
- `experiments/` - reproducible reference experiment specifications
- `research/` - live study protocols and archived-result mappings
- `proposals/` - un-published scenario drafts and evidence
- `tests/` - deterministic unit and scientific reference cases
- `docs/` - architecture, extension, accessibility, and operating notes

## Scientific scope

The simulator demonstrates synthetic model behavior. It is not empirical evidence that any specific hospital, company, person, ecosystem, or AI system follows a toroidal manifold. The model is conditional on two meaningful recurrent phases. Viability status and phase regime are reported independently; when recurrence is weak, too short, spectrally diffuse, or undersampled, the external phase estimate is omitted. A rendered torus is not itself topology evidence, and imported mismatch telemetry can validate only the observable phase estimator—not the domain mapping or toroidal hypothesis by itself.

The full paper is served at `/paper.pdf` and cited in the About the Theory view.
