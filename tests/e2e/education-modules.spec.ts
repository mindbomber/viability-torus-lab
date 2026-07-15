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

test("simulation laboratory preserves planned changes plus a custom event and reports observed seed fractions", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await page.getByLabel("Select changes to test").selectOption({ label: "Visibility first" });
  await page.getByRole("button", { name: /Increase Correction/i }).click();
  await page.locator(".sidebar nav button").filter({ hasText: "Simulation Lab" }).click();
  await expect(page.getByRole("heading", { name: "Simulation Laboratory" })).toBeVisible();
  await expect(page.getByText(/Visibility first.*3 planned changes retained in every run/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projected full-run result" })).toBeVisible();
  await expect(page.locator('[data-result-scope="full-run-projection"]')).toContainText("Final viability state");
  await expect(page.getByText(/independent of the playback cursor/i)).toBeVisible();
  await page.getByLabel("Ensemble seeds").fill("2");
  await page.getByRole("button", { name: "Run batch" }).click();
  await expect(page.getByText(/observed fractions, not calibrated probabilities/i)).toBeVisible();
  await expect(page.getByText("Terminal-rupture seed fraction")).toBeVisible();
  await expect(page.getByText("Mean time outside tube")).toBeVisible();
  await expect(page.getByText("Recovery among warned seeds")).toBeVisible();
  await page.locator(".lab-layout").screenshot({ path: testInfo.outputPath("simulation-lab-protocol.png") });
  expect(consoleErrors).toEqual([]);
});

test("telemetry with a failed phase gate withholds phase and coupling charts honor nonuniform x values", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await page.getByRole("button", { name: /^Experiments Reproducible studies$/i }).click();
  await page.locator(".module-rail > button").filter({ hasText: "Telemetry" }).click();
  const csv = ["time,mismatch", ...Array.from({ length: 64 }, (_, index) => `${index * .25},0.5`)].join("\n");
  await page.locator('.telemetry-upload input[type="file"]').setInputFiles({ name: "flat.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.locator(".study-stats > span").filter({ hasText: "Identifiable" })).toContainText("No");
  await expect(page.getByText("Phase not plotted")).toBeVisible();
  await expect(page.getByText(/does not replace missing phase with an arbitrary zero angle/i)).toBeVisible();
  await expect(page.locator(".research-chart header")).not.toContainText("φ / 2π");
  await page.locator(".experiment-stage").screenshot({ path: testInfo.outputPath("telemetry-phase-withheld.png") });

  await page.locator(".module-rail > button").filter({ hasText: "Coupled Tori" }).click();
  await page.getByRole("button", { name: /Run experiment/i }).click();
  await expect(page.getByRole("heading", { name: "Coordination is not alignment" })).toBeVisible();
  const path = page.locator('.research-chart').first().locator('svg path[stroke="#8c76ff"]');
  const d = await path.getAttribute("d");
  const x = [...(d ?? "").matchAll(/[ML]([\d.]+),/g)].map((match) => Number(match[1]));
  expect(x).toHaveLength(7);
  expect(x[5] - x[4]).toBeGreaterThan((x[1] - x[0]) * 1.8);
  await expect(page.locator(".research-chart").first().locator("footer")).toContainText("coupling 0.000");
  await expect(page.locator(".research-chart").first().locator("footer")).toContainText("coupling 0.200");
  expect(consoleErrors).toEqual([]);
});

test("builder gates torus eligibility, validates a real proposal contract, and tests only a valid draft", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const consoleErrors = await openDashboard(page);
  await page.locator(".sidebar nav button").filter({ hasText: "Build Your Own System" }).click();
  await expect(page.getByRole("heading", { name: /Test whether a real system/i })).toBeVisible();
  await expect(page.locator(".builder-shell > aside button")).toHaveCount(24);
  const values = [
    "Emergency Department QA",
    "Human capacity and recovery",
    "Hospital flow, staffing, bed-management, and quality teams",
    "Emergency arrivals, triage, treatment spaces, staffing, discharge paths, and safety feedback",
    "Patients by acuity, families, clinical staff, and the region served",
    "Three years with daily flow and seasonal demand cycles",
    "Safety and access floors by acuity and subgroup before throughput averages",
    "Healthcare",
    "Treat urgent patients safely and promptly",
    "Arrival load and wait-time targets",
    "triage → diagnose → treat → reassess",
    "review demand → revise staffing → evaluate outcomes",
    "Yes — independently recurrent",
    "Workflow timestamps identify the operational stage",
    "Quarterly demand telemetry with spectral and cycle-count gates",
    "Outcome audits and follow-up data",
    "Acuity hidden by incomplete intake information",
    "Senior review and surge staffing",
    "Seasonal disease and changing care standards",
    "Unresolved cases, fatigue, and audit backlog",
    "Preventable death or permanent trust loss",
    "Safe outcomes, bounded queues, and sustainable workload",
    "Demand spike, staffing loss, early surge activation",
    "The external signal does not recur or the cycles are not dynamically distinct",
  ];
  for (let index = 0; index < values.length; index += 1) {
    await page.locator(".builder-shell > aside button").nth(index).click();
    const select = page.locator(".builder-question select");
    if (await select.count()) await select.selectOption({ label: values[index] });
    else await page.locator(".builder-question textarea").fill(values[index]);
  }
  await expect(page.getByText("Two-phase eligibility established for a draft test")).toBeVisible();
  await page.getByRole("button", { name: "Check draft system" }).click();
  await expect(page.getByText("VALID DRAFT · HUMAN REVIEW REQUIRED")).toBeVisible();
  await expect(page.getByText(/All required fields, safety limits, and test scenarios passed/i)).toBeVisible();
  const testButton = page.getByRole("button", { name: "Test checked draft" });
  await expect(testButton).toBeEnabled();
  await testButton.click();
  await expect(page.locator(".builder-test-result")).toBeVisible();
  await page.locator(".builder-shell").screenshot({ path: testInfo.outputPath("builder-valid-draft.png") });
  await page.getByRole("button", { name: "Open in Empirical Lab" }).click();
  await expect(page.getByRole("heading", { name: "Empirical Lab" })).toBeVisible();
  await expect(page.getByText("Emergency Department QA observed-form demonstration")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("learn uses correct equations and launches guided examples; theory separates evidence layers", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await page.locator(".sidebar nav button").filter({ hasText: "Learn" }).click();
  await page.getByRole("button", { name: /Radial excursion Distance from viable recurrence/i }).click();
  await expect(page.locator(".lesson-copy code")).toContainText("ρ̇=−κ(ρ−ρ₀)+D−C+χΔ");
  await expect(page.locator(".lesson-copy code")).not.toContainText("Aₜ = e");
  await page.getByRole("button", { name: /Phase identifiability Estimated φ may be undefined/i }).click();
  await expect(page.getByText(/Failure means undefined—not φ=0/i)).toBeVisible();
  await page.locator(".learn-layout").screenshot({ path: testInfo.outputPath("learn-phase-identifiability.png") });
  await page.getByRole("button", { name: "Load guided example" }).click();
  await expect(page.getByRole("heading", { name: "Production LLM Answering Service" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Research", exact: true })).toHaveClass(/active/);
  await expect(page.getByLabel("ωφ external frequency")).toHaveValue("0.004");

  await page.locator(".sidebar nav button").filter({ hasText: "About the Theory" }).click();
  await expect(page.getByRole("heading", { name: "Two different meanings of alignment" })).toBeVisible();
  await expect(page.getByText("ATS 4.0 definition")).toBeVisible();
  await expect(page.getByText("Section 14 minimal toy proxy")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Six paper design principles" })).toBeVisible();
  await expect(page.locator(".principle-grid article")).toHaveCount(6);
  await expect(page.getByText("Educational additions on this site")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("theory-layer-crosswalk.png"), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("corrected educational modules remain usable without horizontal clipping on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const consoleErrors = await openDashboard(page);
  await page.getByRole("button", { name: "Open primary navigation menu" }).click();
  await page.locator(".sidebar nav button").filter({ hasText: "Learn" }).click();
  await expect(page.getByRole("heading", { name: /Understand the geometry/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: /When not a torus/i }).click();
  await expect(page.getByText(/responsible conclusion is that this toroidal representation is not established/i)).toBeVisible();

  await page.getByRole("button", { name: "Open primary navigation menu" }).click();
  await page.locator(".sidebar nav button").filter({ hasText: "Build Your Own System" }).click();
  await expect(page.getByRole("heading", { name: /Test whether a real system/i })).toBeVisible();
  await expect.poll(async () => page.locator(".sidebar").evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile-builder.png"), fullPage: false });
  expect(consoleErrors).toEqual([]);
});
