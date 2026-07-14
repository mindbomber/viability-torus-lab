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
  await expect(page.getByRole("heading", { name: "LLM Under Deployment Pressure" })).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  return consoleErrors;
}

async function canvasFingerprint(page: Page, selector: string) {
  return page.locator(selector).evaluate((canvas: HTMLCanvasElement) => ({
    data: canvas.toDataURL(),
    height: canvas.height,
    width: canvas.width,
  }));
}

test("canvases render and linked playback remains causal and synchronized", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  const canvases = page.locator("canvas");
  await expect(canvases).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    const dimensions = await canvases.nth(index).evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      return { height: canvas.height, width: canvas.width };
    });
    expect(dimensions.width).toBeGreaterThan(100);
    expect(dimensions.height).toBeGreaterThan(80);
  }

  await expect(page.getByText("Available after full run")).toBeVisible();
  await expect(page.getByText(/final outcome is not yet shown/i)).toBeVisible();
  const timeChart = page.locator('canvas[data-chart-kind="timeseries"]');
  const unwrapped = page.locator('canvas[data-chart-kind="unwrapped"]');
  const radial = page.locator('canvas[data-chart-kind="radial-stability"]');
  await expect(timeChart).toHaveAttribute("data-view-mode", "causal");
  await expect(timeChart).toHaveAttribute("data-visible-frame-count", "1");
  await expect(timeChart).toHaveAttribute(
    "aria-label",
    /future values are hidden.*Independent scales: proxy A 0 to 1, debt 0 to .* radial excursion 0 to/i,
  );
  await expect(unwrapped).toHaveAttribute("data-axis-order", "theta-x-phi-y");
  await expect(unwrapped).toHaveAttribute("data-phase-view", "latent");
  await expect(page.getByRole("button", { name: "Estimated φ" })).toBeDisabled();
  await expect(radial).toHaveAttribute("aria-label", /Positive d rho over dt means expansion; negative means contraction/i);
  await expect(page.getByText("Toy alignment proxy A=e⁻ρ")).toBeVisible();
  await expect(page.getByText("Illustrative classifier")).toBeVisible();
  await page.locator(".chart-grid").screenshot({ path: testInfo.outputPath("paper-aligned-causal-charts.png") });

  const torusBefore = await canvasFingerprint(page, 'canvas[data-chart-kind="torus"]');
  await page.getByRole("button", { name: "Step +1" }).click();
  await expect(page.locator(".status-panel").getByText(/step 1$/i)).toBeVisible();
  await expect(timeChart).toHaveAttribute("data-visible-frame-count", "2");
  await expect.poll(async () => (await canvasFingerprint(page, 'canvas[data-chart-kind="torus"]')).data).not.toBe(torusBefore.data);

  const timeline = page.getByLabel("Simulation time");
  const box = await timeChart.boundingBox();
  expect(box).not.toBeNull();
  await timeChart.click({ position: { x: box!.width * .52, y: box!.height * .5 } });
  expect(Number(await timeline.inputValue())).toBe(1);

  await page.getByRole("button", { name: "Projection", exact: true }).click();
  await expect(timeChart).toHaveAttribute("data-view-mode", "projection");
  const frameCount = Number(await timeline.getAttribute("max")) + 1;
  await expect(timeChart).toHaveAttribute("data-visible-frame-count", String(frameCount));
  await timeChart.click({ position: { x: box!.width * .52, y: box!.height * .5 } });
  const linkedStep = Number(await timeline.inputValue());
  expect(linkedStep).toBeGreaterThan(350);
  expect(linkedStep).toBeLessThan(600);

  await timeline.focus();
  await timeline.press("End");
  await expect(page.getByText("Available after full run")).toHaveCount(0);
  await expect(page.getByText(/final outcome is not yet shown/i)).toHaveCount(0);
  const estimatedPhaseButton = page.getByRole("button", { name: "Estimated φ" });
  await expect(estimatedPhaseButton).toBeEnabled();
  await estimatedPhaseButton.click();
  await expect(unwrapped).toHaveAttribute("data-phase-view", "estimated");

  await page.getByRole("button", { name: "Research", exact: true }).click();
  await expect(page.getByLabel("α debt accumulation")).toBeVisible();
  await expect(page.getByLabel("β debt repayment")).toBeVisible();
  await expect(page.getByLabel("a φ→θ phase coupling")).toBeVisible();
  await expect(page.getByLabel("b θ→φ phase coupling")).toBeVisible();
  const thetaBeforeCoupling = await unwrapped.getAttribute("data-current-theta");
  await page.getByLabel("a φ→θ phase coupling").fill("0.5");
  await expect(page.getByLabel("a φ→θ phase coupling")).toHaveValue("0.5");
  await expect.poll(async () => unwrapped.getAttribute("data-current-theta")).not.toBe(thetaBeforeCoupling);
  await page.locator(".chart-grid").screenshot({ path: testInfo.outputPath("paper-aligned-estimated-projection.png") });
  expect(consoleErrors).toEqual([]);
});

test("comparison canvas preserves a signed zero baseline and responds to B", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await page.locator(".top-actions button").filter({ hasText: "Compare" }).click();
  await expect(page.getByRole("heading", { name: "Compare two futures" })).toBeVisible();
  const difference = page.locator('canvas[data-chart-kind="difference"]');
  await expect(difference).toHaveAttribute("aria-label", /independent symmetric scales/i);
  await expect(difference).toHaveAttribute("aria-label", /toy proxy \+0\.000, debt \+0\.000, radial excursion \+0\.000/i);
  const beforeLabel = await difference.getAttribute("aria-label");
  const before = await canvasFingerprint(page, 'canvas[data-chart-kind="difference"]');

  const pressure = page.getByLabel(/B .*optimization pressure/i);
  await pressure.fill("2.5");
  await expect(page.getByText("1 controlled change", { exact: false }).first()).toBeVisible();
  await expect.poll(async () => difference.getAttribute("aria-label")).not.toBe(beforeLabel);
  await expect.poll(async () => (await canvasFingerprint(page, 'canvas[data-chart-kind="difference"]')).data).not.toBe(before.data);
  await page.locator(".compare-grid").screenshot({ path: testInfo.outputPath("controlled-one-factor-comparison.png") });
  expect(consoleErrors).toEqual([]);
});

test("permitted extreme parameters keep terminal rupture evidence visible", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const consoleErrors = await openDashboard(page);
  const values: Array<[string, string]> = [
    ["Response speed & automation pressure numeric value", "3"],
    ["Retrieval and verifier fidelity numeric value", "0"],
    ["Correction iterations & human escalation numeric value", "0"],
    ["Hallucination & hidden-constraint error numeric value", "1"],
    ["Unresolved failure patterns numeric value", "2"],
    ["User-context and distribution shift numeric value", "0.5"],
    ["Irreversible downstream action numeric value", "0.5"],
  ];
  for (const [label, value] of values) await page.getByLabel(label).fill(value);

  const timeline = page.getByLabel("Simulation time");
  await timeline.focus();
  await timeline.press("End");
  const torus = page.locator('canvas[data-chart-kind="torus"]');
  const radial = page.locator('canvas[data-chart-kind="radial-stability"]');
  await expect(torus).toHaveAttribute("data-offscale", "true");
  await expect(radial).toHaveAttribute("data-offscale", "true");
  await expect(torus).toHaveAttribute("aria-label", /off the display scale/i);
  await expect(radial).toHaveAttribute("aria-label", /marker is clamped to the chart boundary/i);
  await expect(page.getByText("Terminal rupture", { exact: true })).toBeVisible();
  await expect(page.getByText("Modeled recurrence has been lost")).toBeVisible();
  await expect(page.locator(".viability-progression span").last()).toHaveClass(/active/);
  await expect(page.locator(".status-mini-grid")).toContainText("C−D");
  await expect(page.locator(".status-mini-grid")).toContainText("C−D−χΔ");
  await expect(page.locator(".status-mini-grid")).toContainText("dρ/dt");
  const rendered = await canvasFingerprint(page, 'canvas[data-chart-kind="torus"]');
  expect(rendered.data.length).toBeGreaterThan(10_000);
  await page.screenshot({ path: testInfo.outputPath("terminal-rupture.png"), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("causal explanation updates from parameters through current status and terminal outcome", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const consoleErrors = await openDashboard(page);
  const insight = page.locator(".run-insight");
  await expect(insight.getByRole("heading", { name: "Why this run looks this way" })).toBeVisible();
  await expect(page.locator(".run-insight + .watchlist-receipt")).toHaveCount(1);
  await expect(insight).toContainText("Active causal balance");
  await expect(insight).toContainText("Stable");
  await expect(insight).toContainText("The final outcome is not yet shown");

  await page.locator(".preset-row button").filter({ hasText: "Growth at risk" }).click();
  await expect(insight).toContainText("Drifting");
  await expect(insight).toContainText("Divergence exceeds correction");
  await expect(insight).toContainText("π·ε·(1−γ)");

  await page.getByRole("button", { name: "Step +1" }).click();
  await expect(insight).toContainText("Worsening");
  await expect(insight).toContainText("step 1");
  await insight.screenshot({ path: testInfo.outputPath("dynamic-explanation-worsening.png") });

  const timeline = page.getByLabel("Simulation time");
  await timeline.focus();
  await timeline.press("End");
  await expect(insight).toContainText("Irreversible rupture");
  await expect(insight).toContainText("Terminal policy");
  await expect(insight).toContainText("Fired at step 642");
  await expect(insight).toContainText("finished in irreversible rupture");
  await insight.screenshot({ path: testInfo.outputPath("dynamic-explanation-terminal.png") });
  expect(consoleErrors).toEqual([]);
});

test("experiments workspace verifies the paper and exposes all research modules", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await page.getByRole("button", { name: /^Experiments Protocol-driven studies$/i }).click();
  await expect(page.getByRole("heading", { name: "Experiments", exact: true })).toBeVisible();
  await expect(page.locator(".module-rail > button")).toHaveCount(6);
  await expect(page.getByText("Archived result reproduced")).toBeVisible();
  await expect(page.locator(".verification-strip")).toHaveClass(/verified/);
  await expect(page.getByText("ATS 4.0 AIx product extension", { exact: true })).toBeVisible();
  await expect(page.getByText(/AANA gate:/i)).toBeVisible();

  await page.locator(".module-rail > button").filter({ hasText: "Topology" }).click();
  await expect(page.getByRole("heading", { name: "Topology & phase" })).toBeVisible();
  await expect(page.locator(".research-note").getByText("Interpretation boundary")).toBeVisible();

  await page.locator(".module-rail > button").filter({ hasText: "Hysteresis" }).click();
  await expect(page.getByRole("heading", { name: "Hysteresis" })).toBeVisible();
  await page.getByRole("button", { name: /Run experiment/i }).click();
  await expect(page.getByRole("heading", { name: "Debt-dependent recovery" })).toBeVisible();

  await page.locator(".module-rail > button").filter({ hasText: "Telemetry" }).click();
  await expect(page.getByRole("heading", { name: "External mismatch telemetry" })).toBeVisible();
  await expect(page.getByText("Bundled recurrent example")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("experiments-workspace.png"), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("scenario pack explains its baseline tier and recalculates the tier from slider changes", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await page.locator(".sidebar nav button").filter({ hasText: "Scenarios" }).click();
  await expect(page.getByRole("heading", { name: /Choose a familiar system/i })).toBeVisible();
  await expect(page.getByText("32 included educational simulations")).toBeVisible();
  await expect(page.locator(".library-grid .scenario-card")).toHaveCount(32);

  await page.getByRole("button", { name: "Red watchlist", exact: true }).click();
  await expect(page.getByText("Showing 6 scenarios")).toBeVisible();
  await expect(page.locator(".library-grid .scenario-card")).toHaveCount(6);

  await page.getByRole("button", { name: /Climate & Biosphere/i }).click();
  await expect(page.getByRole("heading", { name: "Climate System & Biosphere Stability" })).toBeVisible();
  await expect(page.getByText("RED /", { exact: false })).toBeVisible();
  const receipt = page.locator(".watchlist-receipt");
  await expect(receipt.getByRole("heading", { name: "Why the default is on this educational watchlist" })).toBeVisible();
  await expect(receipt).toContainText("Protocol reproduced");
  await expect(receipt).toContainText("not a classification defined by the paper");
  await expect(receipt.locator(".classification-step").filter({ hasText: "Derived default protocol" })).toContainText("red tier");
  await expect(receipt.locator(".classification-step").filter({ hasText: "Current parameter protocol" })).toContainText("red tier");
  await expect(receipt).toContainText("Ordinary baseline crosses the viability boundary");
  await expect(receipt.locator(".protocol-row")).toHaveCount(5);

  const translations = page.locator(".parameter-translation");
  await expect(translations.getByRole("heading", { name: "What each parameter means in this system" })).toBeVisible();
  await expect(translations).toContainText("Emissions, extraction & land-use pressure");
  await expect(translations.locator(".translation-grid:not(.advanced) .translation-card")).toHaveCount(7);
  await expect(translations.locator(".translation-grid.advanced")).not.toBeVisible();
  await translations.locator("summary").click();
  await expect(translations.locator(".translation-grid.advanced")).toBeVisible();
  await expect(translations.locator(".translation-grid.advanced .translation-card")).toHaveCount(13);
  await expect(translations).toContainText("The scenario-defined recoverability limit for climate and biosphere overshoot");
  await translations.screenshot({ path: testInfo.outputPath("parameter-real-world-translation.png") });

  await page.locator(".preset-row button").filter({ hasText: "Recovery" }).click();
  await expect(receipt.locator(".classification-step").filter({ hasText: "Derived default protocol" })).toContainText("red tier");
  await expect(receipt.locator(".classification-step").filter({ hasText: "Current parameter protocol" })).toContainText("yellow tier");
  await expect(receipt).toContainText("What the sliders changed");
  await expect(receipt).toContainText("improves modeled resilience");
  await receipt.screenshot({ path: testInfo.outputPath("watchlist-red-to-yellow.png") });
  const evidence = page.locator(".scenario-evidence");
  await evidence.locator("summary").click();
  await expect(evidence.getByRole("heading", { name: "Canonical parameter map" })).toBeVisible();
  await expect(evidence.getByText("Climate and biosphere overshoot", { exact: true })).toBeVisible();
  await expect(evidence.getByRole("heading", { name: "Scenario-specific AIx layers" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("mobile dashboard renders the visualization fallback without clipping the canvas", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const consoleErrors = await openDashboard(page);
  const mobileMenu = page.getByRole("button", { name: /Open primary navigation menu/i });
  await expect(mobileMenu).toBeVisible();
  await expect(mobileMenu.locator("span").first()).toBeVisible();
  const torus = await canvasFingerprint(page, 'canvas[data-chart-kind="torus"]');
  expect(torus.width).toBeGreaterThanOrEqual(300);
  expect(torus.height).toBeGreaterThanOrEqual(150);
  await mobileMenu.click();
  await expect(page.locator(".sidebar")).toHaveClass(/open/);
  await page.locator(".sidebar nav button").filter({ hasText: "Scenarios" }).click();
  await expect(page.getByRole("heading", { name: /Choose a familiar system/i })).toBeVisible();
  await page.getByRole("button", { name: "Featured", exact: true }).click();
  await expect(page.getByText("Showing 10 scenarios")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await mobileMenu.click();
  await expect(page.locator(".sidebar")).toHaveClass(/open/);
  await page.locator(".sidebar nav button").filter({ hasText: "Home" }).click();
  const insight = page.locator(".run-insight");
  await expect(insight).toBeVisible();
  await expect(insight).toContainText("Active causal balance");
  await insight.screenshot({ path: testInfo.outputPath("mobile-run-explanation.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(consoleErrors).toEqual([]);
});
