# Agent and programmatic interfaces

## Contract and evidence boundary

All machine interfaces use contract version `1.0.0` and report the engine's `modelVersion`. A result is reproducible when the model version, scenario version, parameters, interventions, seeds, steps, and integration step are identical.

The simulator produces synthetic model evidence. Parameter rankings and scenario mappings are hypotheses; they are not empirical findings or operational recommendations. Each experiment result includes a deterministic `experimentId`, an evidence receipt, the scenario calibration statement, and model/scenario versions. Published scenarios also expose parameter units, assumptions, references, and falsification criteria.

## Discovery

Start with one of:

- `GET /.well-known/viability-torus-lab.json`
- `GET /llms.txt`
- `GET /api/v1/model`
- `GET /schemas/v1/index.json`

`/api/v1/model` reports the public execution budget and canonical parameter ranges. Every API response includes `X-VTL-Contract-Version` and `X-VTL-Model-Version` headers.

## HTTP API

The API accepts and returns JSON. Cross-origin reads are allowed because all operations are stateless, read-only computations with bounded inputs.

### Run an ensemble

```http
POST /api/v1/simulate
Content-Type: application/json

{
  "schemaVersion": "1.0.0",
  "scenarioId": "llm-deployment",
  "parameters": {
    "pressure": 2.5,
    "feedback": 0.35,
    "correction": 0.35,
    "steps": 720
  },
  "seeds": [1, 2, 3, 4, 5],
  "includeFrames": false
}
```

Frames are omitted by default. Set `includeFrames: true` to receive sampled frames; the server increases the effective stride as needed to remain within the response budget.

Each run summary separates `finalStatus` (legacy radial status), `finalViabilityState` (viable recurrence, boundary crossing, recoverable excursion, or irreversible rupture), and `phase` diagnostics. A boundary crossing is not terminal: the scenario's explicit rupture policy also requires persistence, cumulative irreversible loss, and a severe debt or radial condition. Treat `phase.identifiable: false` as an instruction not to interpret an external phase coordinate. When frames are included, `phi` is synthetic latent ground truth used for evaluator testing; `estimatedPhi` is the paper-style estimate and remains absent unless the identifiability gates pass.

Frames expose all three radial quantities separately: `correctionMargin` = `C−D`, `debtAdjustedMargin` = `C−D−χΔ`, and `radialVelocity` = `dρ/dt`.

### Reproduce a paper fixture

`GET /api/v1/research/paper?case=stable-periodic` runs one case; omit `case` to list the available fixtures. Available cases are `stable-periodic`, `stable-quasiperiodic`, `neutral`, and `rupture`. Results use the locked `paper-2026-legacy` rules, archived initial phases, zero noise, expected metrics, and a versioned SHA-256 payload. This endpoint reproduces the checked-in archive; it does not claim external replication.

### Analyze external mismatch telemetry

```http
POST /api/v1/telemetry
Content-Type: application/json

{
  "source": {
    "name": "observer export",
    "units": "normalized mismatch",
    "provenance": "instrument and preprocessing description"
  },
  "samples": [
    { "time": 0, "mismatch": 0.71 },
    { "time": 0.25, "mismatch": 0.68 }
  ]
}
```

Provide 8–5,000 monotonically timed samples. The estimator applies sampling, amplitude, spectral-concentration, and observed-cycle gates. A successful phase estimate does not by itself establish torus topology or validate a scenario mapping.

### Analyze a researcher-supplied empirical study

The headless empirical service accepts the same study, mapping, phase, and radial-balance contract as the browser lab. The authoritative request schema is `/schemas/v1/empirical-research-request.schema.json`; the redacted receipt schema is `/schemas/v1/empirical-research-receipt.schema.json`.

The HTTP endpoint is intended for an explicitly configured self-hosted deployment and is disabled by default:

```text
VTL_ENABLE_EMPIRICAL_API=true
VTL_EMPIRICAL_API_TOKEN=<strong deployment secret>
VTL_EMPIRICAL_API_ORIGIN=https://research.example
```

```http
POST /api/v1/empirical/analyze
Authorization: Bearer <deployment secret>
Content-Type: application/json
```

The strict request contains:

- `scenarioId` and a complete study definition (`ω`, `τ`, `α`, viable region, two cycles, falsification criterion, and provenance);
- source name, optional connector resource URI, data classification, and declared preprocessing;
- `privacy.dataUseAuthorized: true`, `privacy.remoteProcessingAuthorized: true`, sensitivity/deidentification declarations, and `retention: "request-only"`;
- either bounded object rows with an explicit column list or bounded CSV text;
- an explicit mapping for all required and optional empirical roles, including units;
- declared `kappa`, `rho0`, `chi`, and `rhoCrit`; and
- replay inclusion/stride options.

The response contains validation gates, phase diagnostics, a response-budgeted observed-versus-predicted replay, and a redacted receipt. Source rows are not copied into the receipt. A canonical parsed-table fingerprint supports later matching, but it is not a hash of the original source bytes. Failed phase evidence sets `torusReplayReady: false` and `torusInterpretationWithheld: true`; the service does not force a torus claim.

Remote sensitive or `restricted` data are rejected unless deidentified. An operator can change that default with `VTL_ALLOW_SENSITIVE_EMPIRICAL_DATA=true`, but must then independently secure transport, upstream request logs, retention, jurisdiction, and researcher authorization. Application code itself retains data for the request only and does not log raw input.

### Compare and descriptively aggregate evidence receipts

`POST /api/v1/empirical/aggregate` accepts `/schemas/v1/empirical-evidence-registry-request.schema.json` under the same opt-in bearer-token deployment gate. Provide one to 500 browser-local or headless redacted receipts and, optionally, a computed anchor receipt id. The response classifies every receipt as anchor, compatible, partially comparable, non-comparable, or excluded with dimension-level reasons. Its cohort summary includes only compatible observed receipts. It is not parameter fitting, row pooling, effect estimation, or meta-analysis. Exported browser registry bundles validate against `/schemas/v1/empirical-evidence-registry.schema.json`.

### Compare experiments

`POST /api/v1/compare` accepts `{ "left": ExperimentSpec, "right": ExperimentSpec }` and returns both results plus signed ensemble differences (`left - right`).

### Sweep parameters

```http
POST /api/v1/sweep
Content-Type: application/json

{
  "base": {
    "scenarioId": "llm-deployment",
    "parameters": { "steps": 720 },
    "seeds": [1, 2, 3, 4, 5]
  },
  "grid": {
    "pressure": [1.4, 1.8, 2.2],
    "feedback": [0.5, 0.7, 0.9],
    "correction": [0.4, 0.6, 0.8]
  },
  "topK": 10
}
```

Candidates are ranked lexicographically by lower rupture rate, higher final alignment, lower final debt, and higher stable fraction. This ranking is descriptive of the chosen synthetic objective and grid, not a claim of real-world optimality.

### Error contract

Validation and execution-budget failures return HTTP `422`:

```json
{
  "error": "Experiment failed contract validation.",
  "issues": [
    { "path": "parameters.feedback", "message": "Too big: expected number to be <=1" }
  ]
}
```

Unknown object fields are rejected. General API bodies are capped at 1 MB; empirical analysis allows enough envelope overhead for a canonical dataset capped at 2 MB, 5,000 rows, and 64 columns, while registry aggregation accepts at most 500 redacted receipts in a 10 MB body. Parameters are finite and range-checked, `rho0` must remain below `rhoCrit`, interventions cannot change seed/steps/dt, and every cumulative intervention state is revalidated. Computation is limited by runs, candidates, steps, rows, receipts, returned frames, returned replay points, and an overall internal integration-substep budget.

## CLI

```bash
npm run vtl -- model
npm run vtl -- scenarios
npm run experiment -- --config experiment.json --out result.json
npm run vtl -- compare --config comparison.json
npm run sweep -- --config sweep.json
npm run vtl -- empirical-analyze --config empirical-request.json --out empirical-result.json
npm run vtl -- empirical-explain --config empirical-explanation-request.json --out observation-explanation.json
npm run vtl -- empirical-aggregate --config registry-request.json --out registry-summary.json
npm run proposal:validate -- --config proposal.json
```

Pass `--config -` for stdin. CLI execution has larger but still finite local limits.

## MCP

The local server uses stdio and the public `/mcp` route uses stateless Streamable HTTP with JSON responses. Core tools are:

- `get_model_info`
- `list_scenarios`
- `get_scenario`
- `run_simulation`
- `compare_runs`
- `sweep_parameters`
- `validate_scenario_proposal`
- `reproduce_paper_case`
- `analyze_external_telemetry`

The local stdio server additionally exposes:

- `empirical_analyze_table` — analyze bounded connector-provided rows or CSV text;
- `empirical_analyze_resource` — read a `.csv` after real-path verification confines it to `VTL_EMPIRICAL_ROOTS`;
- `empirical_explain_observation` — return the model contribution trace and residual for one observation;
- `empirical_export_receipt` — return only the redacted evidence receipt.
- `empirical_aggregate_receipts` — compare receipts against an anchor and summarize only the compatible observed cohort.

Authenticated remote MCP requests expose the table, explanation, and receipt tools, but never the local-file resource tool. They use the same `VTL_ENABLE_EMPIRICAL_API`, bearer token, consent, and sensitive-data policy as the HTTP endpoint. For database, Sheets, or repository connectors, the MCP client should read the authorized resource and pass the bounded rows to `empirical_analyze_table`; the optional `source.resourceUri` preserves provenance without granting this server open connector access.

The MCP server instructions require agents to preserve the synthetic/observed-descriptive evidence boundary, treat failed topology gates as valid negative results, and use proposal validation before recommending publication.

## Scenario proposals

Proposals are contract-validated drafts with explicit rationale, assumptions, references, and seeded acceptance/failure cases. The validator checks:

- stable ids and semantic versions;
- complete parameter labels and bounded defaults;
- two distinct recurrent cycles;
- explicit calibration status, parameter units, scenario assumptions, references, and falsification criteria for publication readiness;
- viable reference behavior;
- claimed failure and recovery behavior;
- execution budgets and intervention timing.

The result always sets `publishable: false`. A human-reviewed pull request must deliberately add a definition to `scenarios/catalog.ts` and add deterministic reference tests.
