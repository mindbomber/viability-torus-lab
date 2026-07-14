# Security policy

Viability Torus Lab is a public, local-first simulator with stateless read-only API and MCP computation. It does not accept executable content, user accounts, durable server records, or dataset uploads. The Evidence Registry is session-only by default; its explicit device-persistence option stores only versioned redacted receipts in browser local storage, never raw observations.

- Imported JSON is size-limited and checked for the expected configuration envelope and bounded numeric values.
- Imported strings are never evaluated or inserted as HTML.
- Saved presets remain in browser storage.
- Custom-system answers are not collected; generated definitions download directly to the device.
- No raw scenario text is included in local analytics events.
- API and MCP inputs use strict schemas that reject unknown keys, non-finite numbers, out-of-range parameters, late interventions, and oversized bodies.
- Public execution is bounded by runs, steps, grid dimensions, candidates, returned frames, and a total integration-step work budget.
- Frames are omitted by default and sampled when requested.
- Scenario validation never writes to the published catalog; human-reviewed source changes are required.
- Global responses set content-type, referrer, framing, and browser-permission hardening headers.

The current public compute endpoints have deterministic resource caps but no identity-aware rate limiter. Add edge rate limiting and abuse telemetry before materially raising budgets or promoting the API for high-volume use. Before enabling accounts, public publishing, or datasets, add authenticated authorization, file type and size validation, isolated parsing, malware scanning, storage access controls, retention/deletion controls, and an explicit privacy policy.
