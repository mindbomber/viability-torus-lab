# Draft scenario proposals

This directory is a review queue, not a runtime registry. Files here are intentionally excluded from the published scenario catalog until a human approves their scientific and domain assumptions.

Validate a draft:

```bash
npm run proposal:validate -- --config proposals/social-platform.draft.json
```

A publishable pull request must include:

1. A schema-valid draft with explicit assumptions and references.
2. Passing nominal, failure, and—where claimed—recovery reference evaluations across multiple seeds.
3. Human review of both recurrent phases, viability language, harm claims, parameter mappings, and intervention interpretations.
4. A deliberate addition to `scenarios/catalog.ts`.
5. Deterministic reference tests and a scenario-version entry.

The validator always returns `publishable: false`; it supplies evidence for review but never publishes automatically.
