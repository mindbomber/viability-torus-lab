#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { LOCAL_EXECUTION_LIMITS } from "../contracts/constants.ts";
import { compareExperiments, formatContractError, runExperiment, sweepParameters } from "../contracts/experiments.ts";
import { getModelManifest } from "../contracts/metadata.ts";
import { validateScenarioProposal } from "../contracts/proposals.ts";
import { analyzeEmpiricalRequest, explainEmpiricalObservation, LOCAL_EMPIRICAL_POLICY } from "../empirical/headless.ts";
import { aggregateEmpiricalReceipts } from "../empirical/registry.ts";
import { scenarios } from "../scenarios/catalog.ts";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

function flag(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readJson(path: string | undefined) {
  if (!path) throw new Error("Provide --config <path>.");
  if (path === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  }
  return JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
}

async function emit(value: unknown) {
  const output = `${JSON.stringify(value, null, 2)}\n`;
  const target = flag("--out");
  if (target) {
    const outputPath = resolve(target);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
  }
  else process.stdout.write(output);
}

function help() {
  process.stdout.write(`Viability Torus Lab CLI\n\nCommands:\n  model\n  scenarios\n  simulate --config experiment.json [--out result.json]\n  compare --config comparison.json [--out result.json]\n  sweep --config sweep.json [--out result.json]\n  empirical-analyze --config empirical-request.json [--out result.json]\n  empirical-explain --config empirical-explanation-request.json [--out result.json]\n  empirical-aggregate --config registry-request.json [--out summary.json]\n  validate-proposal --config proposal.json [--out validation.json]\n\nUse --config - to read JSON from stdin. Empirical results are observed-descriptive model evidence, not causal or empirical validation. Registry aggregation includes only compatible observed receipts and is not a meta-analysis.\n`);
}

try {
  if (command === "help" || command === "--help" || command === "-h") help();
  else if (command === "model") await emit(getModelManifest());
  else if (command === "scenarios") await emit({ scenarios });
  else if (command === "simulate") await emit(runExperiment(await readJson(flag("--config")), LOCAL_EXECUTION_LIMITS));
  else if (command === "compare") await emit(compareExperiments(await readJson(flag("--config")), LOCAL_EXECUTION_LIMITS));
  else if (command === "sweep") await emit(sweepParameters(await readJson(flag("--config")), LOCAL_EXECUTION_LIMITS));
  else if (command === "empirical-analyze") await emit(analyzeEmpiricalRequest(await readJson(flag("--config")), LOCAL_EMPIRICAL_POLICY));
  else if (command === "empirical-explain") await emit(explainEmpiricalObservation(await readJson(flag("--config")), LOCAL_EMPIRICAL_POLICY));
  else if (command === "empirical-aggregate") await emit(aggregateEmpiricalReceipts(await readJson(flag("--config"))));
  else if (command === "validate-proposal") await emit(validateScenarioProposal(await readJson(flag("--config"))));
  else throw new Error(`Unknown command '${command}'. Run 'npm run vtl -- help'.`);
} catch (error) {
  process.stderr.write(`${JSON.stringify(formatContractError(error), null, 2)}\n`);
  process.exitCode = 1;
}
