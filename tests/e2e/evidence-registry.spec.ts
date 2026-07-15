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
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  return consoleErrors;
}

async function openRegistry(page: Page) {
  await page.locator(".sidebar nav button").filter({ hasText: "Evidence Registry" }).click();
  await expect(page.getByRole("heading", { name: "Evidence Registry" })).toBeVisible();
}

test("Evidence Registry explains compatibility and excludes synthetic and mismatched studies from descriptive aggregation", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await openRegistry(page);
  await expect(page.getByRole("heading", { name: "Start with a redacted study record" })).toBeVisible();
  await page.getByRole("button", { name: /Load synthetic demonstration/i }).first().click();
  await expect(page.locator(".registry-table-wrap tbody tr")).toHaveCount(5);
  await expect(page.locator(".registry-summary-strip")).toContainText("Observed studies");
  await expect(page.locator(".registry-summary-strip")).toContainText("4");
  await expect(page.locator(".registry-summary-strip")).toContainText("Negative studies");
  await expect(page.locator(".registry-inspector")).toContainText("Study C — adjacent cohort");
  await expect(page.locator(".registry-inspector")).toContainText("Horizon τ");
  await expect(page.locator(".registry-inspector")).toContainText("Data preparation is not declared in both study records");
  await expect(page.locator(".registry-verdict")).toContainText("Partially comparable — do not aggregate");
  await expect(page.locator(".registry-verdict")).toContainText("Preprocessing: unknown");
  await expect(page.locator(".registry-verdict")).toContainText("Non-combinability is a valid result");
  await expect(page.locator(".registry-cohort")).toContainText("0.111");
  await expect(page.locator(".registry-cohort")).toContainText("91.4%");
  await expect(page.locator(".registry-cohort")).toContainText("no averaged watchlist tier");
  await expect(page.locator(".toast")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("evidence-registry-first-viewport.png"), fullPage: false });

  await page.locator(".registry-filters button").filter({ hasText: "Negative" }).click();
  await expect(page.locator(".registry-table-wrap tbody tr")).toHaveCount(1);
  await expect(page.locator(".registry-table-wrap")).toContainText("Study C — adjacent cohort");
  await page.locator(".registry-filters button").filter({ hasText: "Synthetic" }).click();
  await expect(page.locator(".registry-table-wrap tbody tr")).toHaveCount(1);
  await expect(page.locator(".registry-table-wrap")).toContainText("Excluded");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export registry/i }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const bundle = JSON.parse(await readFile(path!, "utf8"));
  expect(bundle.kind).toBe("empirical-evidence-registry");
  expect(bundle.privacy.rawObservationsIncluded).toBe(false);
  expect(bundle.receipts).toHaveLength(5);
  expect(bundle.summary.cohort.compatibleObservedStudies).toBe(2);
  expect(bundle.rows).toBeUndefined();
  expect(consoleErrors).toEqual([]);
});

test("Empirical Lab can register a redacted receipt and device persistence stores no source rows", async ({ page }) => {
  const consoleErrors = await openDashboard(page);
  await page.locator(".sidebar nav button").filter({ hasText: "Empirical Lab" }).click();
  await expect(page.getByRole("heading", { name: "Empirical Lab" })).toBeVisible();
  const add = page.getByRole("button", { name: "Add to registry", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByRole("heading", { name: "Evidence Registry" })).toBeVisible();
  await expect(page.locator(".registry-table-wrap tbody tr")).toHaveCount(1);
  await expect(page.locator(".registry-table-wrap")).toContainText("Synthetic");
  await expect(page.locator(".registry-table-wrap")).toContainText("Excluded");
  await page.locator(".registry-persistence input").check();
  await expect(page.locator(".registry-persistence")).toContainText("Saved on this device");
  const stored = await page.evaluate(() => window.localStorage.getItem("vtl:evidence-registry:v1"));
  expect(stored).not.toBeNull();
  const bundle = JSON.parse(stored!);
  expect(bundle.privacy.rawObservationsIncluded).toBe(false);
  expect(bundle.receipts[0].data).toBeUndefined();
  expect(bundle.receipts[0].source.rawDataIncluded).toBe(false);
  expect(consoleErrors).toEqual([]);
});

test("Evidence Registry contains its wide table at phone width", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const consoleErrors = await openDashboard(page);
  await page.getByRole("button", { name: "Open primary navigation menu" }).click();
  await page.locator(".sidebar nav button").filter({ hasText: "Evidence Registry" }).click();
  await page.getByRole("button", { name: /Load synthetic demonstration/i }).first().click();
  await expect(page.locator(".registry-table-wrap tbody tr")).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(await page.locator(".registry-table-wrap").evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("evidence-registry-mobile.png"), fullPage: false });
  expect(consoleErrors).toEqual([]);
});
