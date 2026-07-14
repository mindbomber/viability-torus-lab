# Viability Torus Lab agent guide

## Scope and evidence

- Treat every run as synthetic model evidence. Never describe a scenario mapping, parameter optimum, or simulated outcome as empirical validation or operational advice.
- `engine/simulator.ts` is the single authoritative dynamics implementation. The dashboard, CLI, HTTP API, MCP server, tests, and proposal evaluator must call it rather than reimplementing equations.
- Preserve deterministic behavior for identical model version, configuration, interventions, and seed.

## Required verification

- Use Node.js 22.13 or newer.
- Run `npm run schemas:generate` after changing any contract schema.
- Run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` before publishing.
- Add or update deterministic reference cases when changing model behavior or publishing a scenario.

## Contract rules

- Public contracts live under `contracts/` and generated JSON Schemas under `public/schemas/v1/`.
- Additive, backward-compatible changes may keep the current contract version. Breaking field or semantic changes require a contract-version and API-version decision plus migration notes.
- Keep public execution bounded by `PUBLIC_EXECUTION_LIMITS`. Do not add arbitrary code execution, unbounded grids, unbounded seed counts, or automatic server-side publication.
- Return structured, machine-readable errors with field paths.

## Scenario proposal workflow

- Agent-created scenarios must remain `status: "draft"` and live under `proposals/` until reviewed.
- Run `npm run proposal:validate -- --config <proposal.json>` and retain the evidence output.
- Validation is read-only and must never add a proposal to `scenarios/catalog.ts` automatically.
- Publication requires human review of the domain mapping, assumptions, references, recurrent phases, harm language, parameter defaults, and deterministic reference cases.
