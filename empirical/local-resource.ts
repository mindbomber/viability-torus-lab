import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { EMPIRICAL_EXECUTION_LIMITS } from "../contracts/constants.ts";
import { ContractError } from "../contracts/experiments.ts";
import { empiricalResearchResourceRequestSchema } from "../contracts/schemas.ts";

function withinRoot(target: string, root: string) {
  const pathFromRoot = relative(root, target);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

export async function materializeEmpiricalCsvResource(input: unknown, configuredRoots: string[]) {
  const parsed = empiricalResearchResourceRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new ContractError("Empirical resource request failed contract validation.", parsed.error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    })));
  }
  if (!configuredRoots.length) {
    throw new ContractError("Local empirical resource access is disabled.", [{
      path: "filePath",
      message: "Configure at least one VTL_EMPIRICAL_ROOTS directory before reading a local CSV.",
    }]);
  }

  const requested = resolve(parsed.data.filePath);
  let target: string;
  try {
    target = await realpath(requested);
  } catch {
    throw new ContractError("Empirical resource could not be opened.", [{ path: "filePath", message: "The requested file does not exist or is not accessible." }]);
  }
  const roots = await Promise.all(configuredRoots.map(async (root) => {
    try { return await realpath(resolve(root)); }
    catch { return null; }
  }));
  if (!roots.some((root) => root && withinRoot(target, root))) {
    throw new ContractError("Empirical resource is outside the approved roots.", [{
      path: "filePath",
      message: "The resolved file must remain within a directory declared by VTL_EMPIRICAL_ROOTS.",
    }]);
  }
  if (extname(target).toLowerCase() !== ".csv") {
    throw new ContractError("Empirical resource type is not allowed.", [{ path: "filePath", message: "Only .csv resources are accepted." }]);
  }
  const metadata = await stat(target);
  if (!metadata.isFile()) throw new ContractError("Empirical resource is not a file.", [{ path: "filePath", message: "A regular CSV file is required." }]);
  if (metadata.size > EMPIRICAL_EXECUTION_LIMITS.maxCsvBytes) {
    throw new ContractError("Empirical resource is too large.", [{ path: "filePath", message: `CSV resources are limited to ${EMPIRICAL_EXECUTION_LIMITS.maxCsvBytes} bytes.` }]);
  }
  const csv = await readFile(target, "utf8");
  const request = {
    schemaVersion: parsed.data.schemaVersion,
    scenarioId: parsed.data.scenarioId,
    study: parsed.data.study,
    source: parsed.data.source,
    privacy: parsed.data.privacy,
    mapping: parsed.data.mapping,
    assumptions: parsed.data.assumptions,
    options: parsed.data.options,
  };
  return { ...request, data: { format: "csv" as const, csv } };
}
