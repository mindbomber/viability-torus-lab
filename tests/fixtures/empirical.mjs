import { exampleEmpiricalStudy } from "../../empirical/analysis.ts";
import { scenarioById } from "../../scenarios/catalog.ts";

export function empiricalResearchFixture(overrides = {}) {
  const scenario = scenarioById["llm-deployment"];
  const example = exampleEmpiricalStudy(scenario);
  const request = {
    scenarioId: scenario.id,
    study: example.study,
    source: {
      name: "research-observations.csv",
      resourceUri: "connector://research/test-study",
      dataClassification: "internal",
      preprocessing: ["Source columns were converted to the declared canonical proxy scales before submission"],
    },
    privacy: {
      dataUseAuthorized: true,
      remoteProcessingAuthorized: false,
      containsSensitiveData: false,
      deidentified: false,
      retention: "request-only",
    },
    data: {
      format: "rows",
      columns: example.dataset.headers,
      rows: example.dataset.rows,
    },
    mapping: example.mapping,
    assumptions: example.assumptions,
    options: { includeReplayPoints: true, replayStride: 1 },
  };
  return {
    scenario,
    example,
    request: {
      ...request,
      ...overrides,
      source: { ...request.source, ...overrides.source },
      privacy: { ...request.privacy, ...overrides.privacy },
      options: { ...request.options, ...overrides.options },
    },
  };
}
export function empiricalCsv(example) {
  const quote = (value) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    example.dataset.headers.map(quote).join(","),
    ...example.dataset.rows.map((row) => example.dataset.headers.map((header) => quote(row[header])).join(",")),
  ].join("\n");
}
