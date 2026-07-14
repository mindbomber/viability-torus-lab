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

Each run summary separates `finalStatus` (viability) from `phase` diagnostics. Treat `phase.identifiable: false` as an instruction not to interpret an external phase coordinate. When frames are included, `phi` is synthetic latent ground truth used for evaluator testing; `estimatedPhi` is the paper-style estimate and remains absent unless the identifiability gates pass.

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

Unknown object fields are rejected. Bodies are capped at 1 MB, parameters are finite and range-checked, `rho0` must remain below `rhoCrit`, interventions cannot change seed/steps/dt, and every cumulative intervention state is revalidated. Computation is limited by runs, candidates, steps, returned frames, and an overall internal integration-substep budget.

## CLI

```bash
npm run vtl -- model
npm run vtl -- scenarios
npm run experiment -- --config experiment.json --out result.json
npm run vtl -- compare --config comparison.json
npm run sweep -- --config sweep.json
npm run proposal:validate -- --config proposal.json
```

Pass `--config -` for stdin. CLI execution has larger but still finite local limits.

## MCP

The local server uses stdio and the public `/mcp` route uses stateless Streamable HTTP with JSON responses. Both expose:

- `get_model_info`
- `list_scenarios`
- `get_scenario`
- `run_simulation`
- `compare_runs`
- `sweep_parameters`
- `validate_scenario_proposal`

The MCP server instructions require agents to preserve the synthetic-evidence boundary and use proposal validation before recommending publication.

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
