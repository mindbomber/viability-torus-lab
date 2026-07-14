# Viability Torus Lab

Viability Torus Lab is an interactive ATS/AANA/AIx simulation environment. It maps a fast local correction phase and a slower external adaptation phase onto a torus, then uses radial excursion, correction capacity, divergence pressure, alignment debt, and irreversible loss to explain whether a system stays viable, drifts, recovers, or ruptures.

## Local development

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run dev
```

Production checks:

```bash
npm test
npm run build
```

## Product areas

- Live scenario simulator with 3D and accessible 2D torus views
- Six structured scenarios with domain-specific parameter labels and presets
- Deterministic seeded simulation, playback controls, interventions, and explanations
- Unwrapped phase, time-series, and radial-stability charts with table alternatives
- Side-by-side compare mode and difference summaries
- Template-based custom-system builder
- Guided learning modules and full theory/paper section
- JSON, CSV, share-link, chart, and torus export tools
- Version-controlled scenario registry for administrative maintenance

## Repository map

- `app/` - responsive product shell and application views
- `components/simulation/` - interactive torus renderer and camera controls
- `components/charts/` - linked scientific canvas charts
- `engine/` - equations, seeded simulation, status classification, summaries
- `scenarios/` - structured domain definitions and parameter mappings
- `tests/` - deterministic unit and scientific reference cases
- `docs/` - architecture, extension, accessibility, and operating notes

## Scientific scope

The simulator demonstrates synthetic model behavior. It is not empirical evidence that any specific hospital, company, person, ecosystem, or AI system follows a toroidal manifold. The model is conditional on two meaningful recurrent phases. When recurrence is weak or unidentifiable, phase should be reported as undefined.

The full paper is served at `/paper.pdf` and cited in the About the Theory view.
