import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function openDashboard(page: Page) {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    const localVinextFontWarning = text.includes("Not allowed to load local resource: file:///") && text.includes("/.vinext/fonts/");
    if (message.type() === "error" && !localVinextFontWarning) consoleErrors.push(text);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/Viability Torus Lab/i);
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  return consoleErrors;
}

async function openEmpiricalLab(page: Page) {
  await page.locator(".sidebar nav button").filter({ hasText: "Empirical Lab" }).click();
  await expect(page.getByRole("heading", { name: "Empirical Lab" })).toBeVisible();
}

test("browser-local empirical replay validates two phases, updates attribution, and exports a redacted study record", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await openEmpiricalLab(page);
  await expect(page.getByText("Browser-local", { exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic example · observed-form", { exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic demonstration only", { exact: true })).toBeVisible();
  await expect(page.locator(".empirical-gate-rail article")).toHaveCount(5);
  await expect(page.locator(".empirical-gate-rail")).toContainText("PASS");
  await expect(page.locator(".empirical-gate-rail")).toContainText("READY");
  const explanation = page.locator(".empirical-explanation");
  await expect(explanation.getByRole("heading", { name: "Why this observed run looks this way" })).toBeVisible();
  await expect(explanation).toContainText("not causal identification or empirical validation");
  const cursor = page.getByLabel("Observed replay cursor");
  await cursor.fill("96");
  await expect(page.locator(".empirical-timeline > footer")).toContainText("row 97/240");
  await expect(explanation).toContainText("At this cursor, the declared model attributes");
  await page.screenshot({ path: testInfo.outputPath("empirical-first-viewport.png"), fullPage: false });
  await page.locator(".empirical-replay-stage").screenshot({ path: testInfo.outputPath("empirical-replay.png") });

  await page.getByRole("button", { name: "Compare Side-by-side outcomes", exact: true }).click();
  await openEmpiricalLab(page);
  await expect(page.locator(".empirical-timeline > footer")).toContainText("row 97/240");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export evidence", exact: true }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const receipt = JSON.parse(await readFile(downloadedPath!, "utf8"));
  expect(receipt.kind).toBe("browser-local-empirical-study");
  expect(receipt.source.localOnly).toBe(true);
  expect(receipt.source.rawDataIncluded).toBe(false);
  expect(receipt.source.datasetSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(receipt.validation.torusReplayReady).toBe(true);
  expect(receipt.replay.method).toBe("one-step-observed-driver-replay");
  expect(receipt.rows).toBeUndefined();
  expect(consoleErrors).toEqual([]);
});

test("a flat uploaded external signal produces a valid negative result and withholds the torus replay", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await openEmpiricalLab(page);
  const header = "time,theta_signal,phi_signal,pressure,error,feedback,correction,drift,irreversible_loss,debt,rho";
  const rows = Array.from({ length: 120 }, (_, index) => {
    const theta = 0.5 + 0.3 * Math.cos(index / 10 * Math.PI * 2);
    return `${index},${theta.toFixed(6)},0.5,1.2,0.25,0.7,0.5,0.04,0.01,0.2,0.5`;
  });
  await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles({
    name: "flat-external.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([header, ...rows].join("\n")),
  });
  await expect(page.getByText("Observed descriptive", { exact: true })).toBeVisible();
  await page.locator(".empirical-workflow button").filter({ hasText: "Study" }).click();
  await page.getByLabel("Reference population ω").fill("Observed service units and the patients affected by their decisions");
  await page.getByLabel("Time horizon τ").fill("One hundred and twenty evenly sampled observation periods");
  await page.getByLabel("Aggregation rule α").fill("Report the aggregate trajectory while retaining subgroup outcomes in the source study");
  await page.locator(".empirical-workflow button").filter({ hasText: "Data" }).click();
  await page.getByLabel("Data provenance").fill("Instrumented operational export with documented preprocessing and no omitted observation rows");
  await page.locator(".empirical-workflow button").filter({ hasText: "Validate" }).click();
  const externalGate = page.locator(".empirical-gate-rail article").filter({ hasText: "External recurrence" });
  await expect(externalGate).toContainText("FAIL");
  await expect(externalGate).toContainText("low-amplitude");
  await page.locator(".empirical-workflow button").filter({ hasText: "Replay" }).click();
  await expect(page.getByRole("heading", { name: "Torus replay withheld" })).toBeVisible();
  await expect(page.getByText("Do not force the geometry")).toBeVisible();
  await page.locator(".empirical-step").screenshot({ path: testInfo.outputPath("empirical-negative-result.png") });
  expect(consoleErrors).toEqual([]);
});

test("Empirical Lab remains usable without horizontal clipping on a phone viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const consoleErrors = await openDashboard(page);
  await page.getByRole("button", { name: "Open primary navigation menu" }).click();
  await page.locator(".sidebar nav button").filter({ hasText: "Empirical Lab" }).click();
  await expect(page.getByRole("heading", { name: "Empirical Lab" })).toBeVisible();
  await expect.poll(async () => page.locator(".sidebar").evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect(page.getByRole("heading", { name: "Why this observed run looks this way" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("empirical-mobile.png"), fullPage: false });
  expect(consoleErrors).toEqual([]);
});
