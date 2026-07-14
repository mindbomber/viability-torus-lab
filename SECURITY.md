# Security policy

Viability Torus Lab is a public, local-first simulator. It does not accept executable content, user accounts, or dataset uploads.

- Imported JSON is size-limited and checked for the expected configuration envelope and bounded numeric values.
- Imported strings are never evaluated or inserted as HTML.
- Saved presets remain in browser storage.
- Custom-system answers are not collected; generated definitions download directly to the device.
- No raw scenario text is included in local analytics events.

Before enabling accounts, public publishing, or datasets, add authenticated authorization, rate limits, file type and size validation, isolated parsing, malware scanning, storage access controls, retention/deletion controls, and an explicit privacy policy.
