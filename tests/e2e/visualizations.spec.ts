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
  await expect(page.getByRole("heading", { name: "Production LLM Answering Service" })).toBeVisible();
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
  const torusCanvas = page.locator('canvas[data-chart-kind="torus"]');
  await expect(torusCanvas).toHaveAttribute("data-geometry-regime", "healthy");
  await expect(torusCanvas).toHaveAttribute("aria-label", /excursion offsets the trajectory; debt produces a potentially repayable asymmetric warp; accumulated loss produces a persistent visual scar/i);
  await expect(page.locator(".legend-minor")).toContainText("Generate");
  await expect(page.locator(".legend-minor")).toContainText("Generate → Verify → Retrieve → Revise → Gate");
  await expect(page.locator(".legend-major")).toContainText("User-context change");
  const stateInspector = page.getByLabel("Selected-point state inspector");
  await expect(stateInspector).toContainText("Healthy recurrence");
  await expect(stateInspector).toContainText("θ · local phase");
  await expect(stateInspector).toContainText("φ · simulated phase");
  await expect(stateInspector).toContainText("ρ · radial motion");
  await expect(stateInspector).toContainText("Memory");
  await expect(stateInspector).toContainText("Viability");
  await expect(stateInspector).toContainText("AIx · illustrative");
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

test("every live simulation module follows the playback frame through crossing, recovery window, rupture, and rewind", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const consoleErrors = await openDashboard(page);
  await page.getByLabel("Select a scenario").selectOption({ label: "Compound stress" });
  const timeline = page.getByLabel("Simulation time");
  const progression = page.locator(".viability-progression");
  const status = page.locator(".status-panel");
  const torus = page.locator('canvas[data-chart-kind="torus"]');
  const timeSeries = page.locator('canvas[data-chart-kind="timeseries"]');
  const unwrapped = page.locator('canvas[data-chart-kind="unwrapped"]');
  const radial = page.locator('canvas[data-chart-kind="radial-stability"]');
  const insight = page.locator(".run-insight");
  const aix = page.locator(".aix-drawer");
  const liveOutlookStatus = page.locator(".classification-step").filter({ hasText: "Live frame status" });
  const dataRows = page.locator(".data-table-fallback tbody tr");
  const scenarioFacts = page.locator(".scenario-facts");

  await expect(progression).toHaveAttribute("data-phase", "before-crossing");
  await expect(progression.locator("span.active")).toHaveCount(0);
  await expect(progression.locator("span.complete")).toHaveCount(0);
  await expect(status).toContainText("No viability-boundary crossing has occurred by this playback frame");
  await expect(timeSeries).toHaveAttribute("data-visible-frame-count", "1");
  await expect(page.getByLabel("Selected-point state inspector")).toContainText("step 0");
  await expect(insight).toContainText("step 0");
  await expect(aix).toHaveAttribute("data-frame-step", "0");
  await expect(liveOutlookStatus).toContainText("Drifting");
  await expect(scenarioFacts).toContainText("Drifting");
  await expect(dataRows).toHaveCount(1);
  const initialAix = await aix.getAttribute("data-aix-score");

  await timeline.fill("675");
  await expect(progression).toHaveAttribute("data-phase", "crossing");
  await expect(progression.locator("span").nth(0)).toHaveClass(/active/);
  await expect(status).toContainText("BOUNDARY CROSSED");
  await expect(timeSeries).toHaveAttribute("data-visible-frame-count", "676");
  await expect(page.getByLabel("Selected-point state inspector")).toContainText("step 675");
  await expect(unwrapped).toHaveAttribute("data-current-theta", /.+/);
  await expect(radial).toHaveAttribute("aria-label", /Current excursion 2\.50/i);
  await expect(insight).toContainText("step 675");
  await expect(aix).toHaveAttribute("data-frame-step", "675");
  await expect(liveOutlookStatus).toContainText("Boundary crossed");
  await expect(scenarioFacts).toContainText("Boundary crossed");
  await expect(dataRows).toHaveCount(13);
  await expect(dataRows.last()).toContainText("675");
  await expect(aix).not.toHaveAttribute("data-aix-score", initialAix ?? "");
  await status.screenshot({ path: testInfo.outputPath("system-status-boundary-causal.png") });

  await timeline.fill("676");
  await expect(progression).toHaveAttribute("data-phase", "recovery-window");
  await expect(progression.locator("span").nth(0)).toHaveClass(/complete/);
  await expect(progression.locator("span").nth(1)).toHaveClass(/active/);
  await expect(status).toContainText("RECOVERABLE EXCURSION");
  await expect(status).toContainText("still nonterminal");

  await timeline.fill("684");
  await expect(progression).toHaveAttribute("data-phase", "irreversible-rupture");
  await expect(progression.locator("span").nth(0)).toHaveClass(/complete/);
  await expect(progression.locator("span").nth(1)).toHaveClass(/failed/);
  await expect(progression.locator("span").nth(2)).toHaveClass(/active/);
  await expect(status).toContainText("IRREVERSIBLE RUPTURE");
  await expect(torus).toHaveAttribute("data-geometry-regime", "collapse");
  await expect(insight).toContainText("Terminal policy");
  await expect(liveOutlookStatus).toContainText("Irreversible rupture");
  await expect(scenarioFacts).toContainText("Irreversible rupture");
  await status.screenshot({ path: testInfo.outputPath("system-status-terminal-causal.png") });

  await timeline.fill("0");
  await expect(progression).toHaveAttribute("data-phase", "before-crossing");
  await expect(progression.locator("span.active")).toHaveCount(0);
  await expect(progression.locator("span.complete")).toHaveCount(0);
  await expect(status).toContainText("DRIFTING");
  await expect(status).not.toContainText("IRREVERSIBLE RUPTURE");
  await expect(torus).not.toHaveAttribute("data-geometry-regime", "collapse");
  await expect(timeSeries).toHaveAttribute("data-visible-frame-count", "1");
  await expect(aix).toHaveAttribute("data-aix-score", initialAix ?? "");
  await expect(insight).toContainText("The final outcome is not yet shown");
  await expect(liveOutlookStatus).toContainText("Drifting");
  await expect(scenarioFacts).toContainText("Drifting");
  await expect(dataRows).toHaveCount(1);

  await timeline.fill("674");
  const playback = page.locator(".simulation-bar");
  await expect(playback.getByRole("button", { name: /Resume/ })).toHaveCount(1);
  await expect(playback.getByRole("button", { name: /Pause/ })).toBeDisabled();
  await playback.getByRole("button", { name: /Resume/ }).click();
  await expect.poll(async () => Number(await timeline.inputValue()), { timeout: 4_000 }).toBe(675);
  await expect(progression).toHaveAttribute("data-phase", "crossing");
  await expect(playback.getByRole("button", { name: /Pause/ })).toBeEnabled();
  await playback.getByRole("button", { name: /Pause/ }).click();
  expect(consoleErrors).toEqual([]);
});

test("a real post-crossing correction renders recovery as the alternative branch to rupture", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  const config = {
    modelVersion: "torus-1.2.0",
    interventionPlanId: "no-action",
    experiment: {
      schemaVersion: "1.0.0",
      systemId: "llm-deployment",
      scenarioId: "llm-deployment",
      interventionPlanId: "no-action",
      parameters: {
        steps: 960,
        pressure: 2.35,
        feedback: 0.42,
        correction: 0.42,
        initialDebt: 0.34,
        kappa: 0.22,
        chi: 0.18,
        omegaTheta: 0.12,
      },
      interventions: [{
        id: "post-crossing-recovery",
        label: "Post-crossing recovery",
        step: 410,
        cost: 1,
        effects: { pressure: 0.3, error: 0.1, feedback: 0.95, correction: 1.8, irreversibleLoss: 0, beta: 1 },
      }],
      seeds: [4217],
      includeFrames: false,
    },
  };
  await page.goto(`/?config=${encodeURIComponent(JSON.stringify(config))}`);
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  const timeline = page.getByLabel("Simulation time");
  const progression = page.locator(".viability-progression");
  const status = page.locator(".status-panel");

  await timeline.fill("409");
  await expect(progression).toHaveAttribute("data-phase", "crossing");
  await expect(progression.locator("span").nth(0)).toHaveClass(/active/);
  await timeline.fill("410");
  await expect(progression).toHaveAttribute("data-phase", "recovered");
  await expect(progression.locator("span").nth(0)).toHaveClass(/complete/);
  await expect(progression.locator("span").nth(1)).toHaveClass(/complete.*recovered/);
  await expect(progression.locator("span").nth(2)).not.toHaveClass(/active/);
  await expect(status).toContainText("returned inside the viable tube");
  await expect(page.locator(".intervention-log .occurred")).toContainText("Post-crossing recovery");
  await status.screenshot({ path: testInfo.outputPath("system-status-recovered-branch.png") });
  expect(consoleErrors).toEqual([]);
});

test("planned changes distinguish future schedule from actions active at the selected frame", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await page.getByLabel("Select changes to test").selectOption({ label: "Visibility first" });
  const timeline = page.getByLabel("Simulation time");
  const log = page.locator(".intervention-log");
  const insight = page.locator(".run-insight");
  const aix = page.locator(".aix-drawer");
  const initialAix = await aix.getAttribute("data-aix-score");

  await expect(log.locator(".occurred")).toHaveCount(0);
  await expect(log.locator(".upcoming")).toContainText("Scheduled for");
  await expect(log.locator(".upcoming")).toContainText("not active yet");
  const firstEventStep = Number(await log.locator(".upcoming").getAttribute("data-event-step"));
  expect(firstEventStep).toBeGreaterThan(0);
  await expect(insight).toContainText(`Next action at step ${firstEventStep}`);

  await timeline.fill(String(firstEventStep));
  await expect(log.locator(".occurred")).toContainText("Applied at");
  await expect(log.locator(".occurred")).toContainText("Improve feedback");
  await expect(log.locator(".upcoming")).toContainText("Add audit");
  await expect(insight).toContainText("1 modeled action active");
  await expect(aix).not.toHaveAttribute("data-aix-score", initialAix ?? "");
  await log.screenshot({ path: testInfo.outputPath("causal-change-timeline.png") });

  await timeline.fill("0");
  await expect(log.locator(".occurred")).toHaveCount(0);
  await expect(log.locator(".upcoming")).toContainText("not active yet");
  await expect(aix).toHaveAttribute("data-aix-score", initialAix ?? "");
  expect(consoleErrors).toEqual([]);
});

test("the global run control never advances a hidden simulation behind another module", async ({ page }) => {
  const consoleErrors = await openDashboard(page);
  const timeline = page.getByLabel("Simulation time");
  await page.locator(".top-actions").getByRole("button", { name: "Run system" }).click();
  await expect.poll(async () => Number(await timeline.inputValue())).toBeGreaterThan(0);
  const beforeNavigation = Number(await timeline.inputValue());
  await page.locator(".sidebar nav button").filter({ hasText: "Systems" }).click();
  await expect(page.getByRole("heading", { name: /Choose how a system maintains viability/i })).toBeVisible();
  await page.waitForTimeout(500);
  await page.locator(".sidebar nav button").filter({ hasText: "Home" }).click();
  await expect(page.getByRole("heading", { name: "Production LLM Answering Service" })).toBeVisible();
  expect(Number(await timeline.inputValue())).toBeLessThanOrEqual(beforeNavigation + 2);

  await page.locator(".top-actions button").filter({ hasText: "Compare" }).click();
  await expect(page.getByRole("heading", { name: "Compare two futures" })).toBeVisible();
  await page.locator(".top-actions").getByRole("button", { name: /Resume system|Run system/ }).click();
  await expect(page.getByRole("heading", { name: "Production LLM Answering Service" })).toBeVisible();
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

test("comparison outcomes do not call a nonterminal boundary excursion ruptured", async ({ page }) => {
  const consoleErrors = await openDashboard(page);
  await page.getByLabel("Select a maintenance pattern").selectOption("regeneration-depletion");
  await page.locator(".laboratory-selectors select").nth(1).selectOption("groundwater-depletion");
  await page.getByLabel("Select a scenario").selectOption({ label: "Pressure surge" });
  await page.locator(".top-actions button").filter({ hasText: "Compare" }).click();
  const outcomes = page.locator(".compare-summary .summary-stat").filter({ hasText: "Outcome" });
  await expect(outcomes).toHaveCount(2);
  await expect(outcomes.nth(0)).toContainText("Outside boundary · recovery still possible");
  await expect(outcomes.nth(1)).toContainText("Outside boundary · recovery still possible");
  await expect(outcomes.nth(0)).not.toContainText("Ruptured");
  await expect(outcomes.nth(1)).not.toContainText("Ruptured");
  expect(consoleErrors).toEqual([]);
});

test("torus geometry distinguishes repayable debt deformation from irreversible scarring", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  const torus = page.locator('canvas[data-chart-kind="torus"]');
  const debtControl = page.getByLabel("Unresolved failure patterns numeric value");
  const lossControl = page.getByLabel("Irreversible downstream action numeric value");
  const timeline = page.getByLabel("Simulation time");
  const initialDebt = await debtControl.inputValue();
  const initialWarp = Number(await torus.getAttribute("data-debt-warp"));
  const initialScar = Number(await torus.getAttribute("data-loss-scar"));
  await page.locator(".torus-panel").screenshot({ path: testInfo.outputPath("torus-geometry-healthy.png") });

  await debtControl.fill("2");
  await expect.poll(async () => Number(await torus.getAttribute("data-debt-warp"))).toBeGreaterThan(initialWarp);
  await expect(torus).toHaveAttribute("data-geometry-regime", "fragile");

  await debtControl.fill(initialDebt);
  await lossControl.fill("0.5");
  await timeline.fill("4");
  await expect.poll(async () => Number(await torus.getAttribute("data-loss-scar"))).toBeGreaterThan(initialScar);
  await expect(torus).toHaveAttribute("data-geometry-regime", "hysteretic");
  await expect(page.getByLabel("Selected-point state inspector")).toContainText("Hysteretic · memory-shaped");
  await page.locator(".torus-panel").screenshot({ path: testInfo.outputPath("torus-geometry-hysteretic.png") });
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
  await expect(torus).toHaveAttribute("data-geometry-regime", "collapse");
  await expect(page.getByLabel("Selected-point state inspector")).toContainText("Collapse · no invariant torus");
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
  await expect(insight).toContainText("Active equation balance");
  for (const source of ["System structure", "Scenario pressure", "User overrides", "Intervention activity", "System memory"]) {
    await expect(insight).toContainText(source);
  }
  await expect(insight).toContainText("Sliders match the selected scenario");
  await expect(insight).toContainText("not empirical causal identification");
  await expect(insight.getByRole("heading", { name: "Why the torus has this shape" })).toBeVisible();
  await expect(insight).toContainText("Excursion ρ");
  await expect(insight).toContainText("Debt deformation χΔ");
  await expect(insight).toContainText("Irreversible scar ΣΛ");
  await expect(insight).toContainText("not a unique 3D deformation law");
  await expect(insight).toContainText("Stable");
  await expect(insight).toContainText("The final outcome is not yet shown");
  await expect(insight).toContainText("Radial Neutral");
  await expect(insight).toContainText("Neutral C*");
  await expect(insight).toContainText("Gap C*−C");
  await expect(insight).toContainText("synthetic radial equation");

  await page.getByLabel("Select a scenario").selectOption({ label: "Compound stress" });
  await expect(insight).toContainText("Drifting");
  await expect(insight).toContainText("Divergence exceeds correction");
  await expect(insight).toContainText("Narrows the declared margin");
  await expect(insight).toContainText("π·ε·(1−γ)");

  await page.getByLabel("Response speed & automation pressure numeric value").fill("3");
  await expect(insight).toContainText("1 slider change");
  await page.getByRole("button", { name: "Reset scenario" }).click();
  await expect(insight).toContainText("Sliders match the selected scenario");

  await page.getByRole("button", { name: "Step +1" }).click();
  await expect(insight).toContainText("Worsening");
  await expect(insight).toContainText("Radial Expansion");
  await expect(insight).toContainText("step 1");
  await insight.screenshot({ path: testInfo.outputPath("dynamic-explanation-worsening.png") });

  const timeline = page.getByLabel("Simulation time");
  await timeline.focus();
  await timeline.press("End");
  await expect(insight).toContainText("Irreversible rupture");
  await expect(insight).toContainText("Terminal policy");
  await expect(insight).toContainText("Fired at step 684");
  await expect(insight).toContainText("Terminal history is latched");
  await expect(insight).toContainText("Collapse · no invariant torus");
  await expect(insight).toContainText("The terminal latch removes the coherent torus");
  await expect(insight).toContainText("finished in irreversible rupture");
  await insight.screenshot({ path: testInfo.outputPath("dynamic-explanation-terminal.png") });
  expect(consoleErrors).toEqual([]);
});

test("experiments workspace verifies the paper and exposes all research studies", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await page.getByRole("button", { name: /^Experiments Reproducible studies$/i }).click();
  await expect(page.getByRole("heading", { name: "Experiments", exact: true })).toBeVisible();
  await expect(page.locator(".module-rail > button")).toHaveCount(6);
  await expect(page.getByText("Archived result reproduced")).toBeVisible();
  await expect(page.locator(".verification-strip")).toHaveClass(/verified/);
  await expect(page.getByText("ATS 4.0 AIx product extension", { exact: true })).toBeVisible();
  await expect(page.getByText(/AANA gate:/i)).toBeVisible();
  await expect(page.locator(".experiment-context-aix")).toContainText("Separate from this study");
  await expect(page.locator(".experiment-context-aix")).toContainText("It is not an output of the selected");

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

test("systems catalog explains its default outlook and recalculates after scenario changes", async ({ page }, testInfo) => {
  const consoleErrors = await openDashboard(page);
  await page.locator(".sidebar nav button").filter({ hasText: "Systems" }).click();
  await expect(page.getByRole("heading", { name: /Choose how a system maintains viability/i })).toBeVisible();
  await expect(page.getByText("21 bounded systems", { exact: true })).toBeVisible();
  await expect(page.locator(".library-grid .scenario-card")).toHaveCount(21);
  await page.screenshot({ path: testInfo.outputPath("composable-systems-library.png") });

  await page.getByRole("button", { name: /Red watchlist · 3/i }).click();
  await expect(page.getByText("Showing 3 systems")).toBeVisible();
  await expect(page.locator(".library-grid .scenario-card")).toHaveCount(3);

  await page.getByRole("button", { name: /Antibiotic Stewardship Network/i }).click();
  await expect(page.getByRole("heading", { name: "Regional Hospital Antibiotic Stewardship Network" })).toBeVisible();
  const systemDefinition = page.locator(".system-definition-panel");
  await expect(systemDefinition).not.toHaveAttribute("open", "");
  await expect(systemDefinition.locator(":scope > summary")).toContainText("See exactly what this simulation represents");
  await expect(systemDefinition.locator(".system-definition-body")).not.toBeVisible();
  await systemDefinition.screenshot({ path: testInfo.outputPath("system-composition-collapsed.png") });
  await systemDefinition.locator(":scope > summary").click();
  await expect(systemDefinition).toHaveAttribute("open", "");
  await expect(systemDefinition.locator(".system-definition-body")).toBeVisible();
  await expect(systemDefinition).toContainText("Maintenance pattern");
  await expect(systemDefinition).toContainText("Bounded system");
  await expect(systemDefinition).toContainText("Scenario conditions");
  await expect(systemDefinition).toContainText("Changes to test");
  await expect(systemDefinition).toContainText("Run result");
  await expect(systemDefinition.locator(".system-definition-body > details")).not.toHaveAttribute("open", "");
  await systemDefinition.screenshot({ path: testInfo.outputPath("system-composition-expanded.png") });
  await expect(page.getByText("RED /", { exact: false })).toBeVisible();
  const receipt = page.locator(".watchlist-receipt");
  await expect(receipt.getByRole("heading", { name: "Why this system has this watchlist outlook" })).toBeVisible();
  await expect(receipt).toContainText("Default result reproduced");
  await expect(receipt).toContainText("red, orange, or yellow label shown beside the system name");
  await expect(receipt).toContainText("Illustrative current-state hypothesis");
  await expect(receipt).toContainText("2026-07-14");
  await expect(receipt.locator(".classification-step").filter({ hasText: "Derived default ensemble" })).toContainText("red tier");
  await expect(receipt.locator(".classification-step").filter({ hasText: "Current slider outlook" })).toContainText("red tier");
  await expect(receipt).toContainText("Ordinary baseline crosses the viability boundary");
  await expect(receipt.locator(".protocol-row")).toHaveCount(5);

  const translations = page.locator(".parameter-translation");
  await expect(translations.getByRole("heading", { name: "What each parameter means in this system" })).toBeVisible();
  await expect(translations).toContainText("Antibiotic selection pressure");
  await expect(translations).toContainText("Candidate observable");
  await expect(translations.locator(".translation-grid:not(.advanced) .translation-card")).toHaveCount(7);
  await expect(translations.locator(".translation-grid.advanced")).not.toBeVisible();
  await translations.locator("summary").click();
  await expect(translations.locator(".translation-grid.advanced")).toBeVisible();
  await expect(translations.locator(".translation-grid.advanced .translation-card")).toHaveCount(13);
  await expect(translations).toContainText("The scenario-defined recoverability limit for treatment-failure and transmission risk");
  await translations.screenshot({ path: testInfo.outputPath("parameter-real-world-translation.png") });

  await page.getByLabel("Select a scenario").selectOption({ label: "Reduced-stress context" });
  await expect(receipt.locator(".classification-step").filter({ hasText: "Derived default ensemble" })).toContainText("red tier");
  await expect(receipt.locator(".classification-step").filter({ hasText: "Current slider outlook" })).toContainText("orange tier");
  await expect(receipt).toContainText("What the sliders changed");
  await expect(receipt).toContainText("improves modeled resilience");
  await receipt.screenshot({ path: testInfo.outputPath("watchlist-red-to-orange.png") });
  const evidence = page.locator(".scenario-evidence");
  await evidence.locator("summary").click();
  await expect(evidence.getByRole("heading", { name: "What each equation variable means here" })).toBeVisible();
  await expect(evidence.getByText("Treatment-failure and transmission risk", { exact: true })).toBeVisible();
  await expect(evidence.getByRole("heading", { name: "AIx meanings in this scenario" })).toBeVisible();
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
  await page.locator(".sidebar nav button").filter({ hasText: "Systems" }).click();
  await expect(page.getByRole("heading", { name: /Choose how a system maintains viability/i })).toBeVisible();
  await page.getByRole("button", { name: /Featured · 6/i }).click();
  await expect(page.getByText("Showing 6 systems")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await mobileMenu.click();
  await expect(page.locator(".sidebar")).toHaveClass(/open/);
  await page.locator(".sidebar nav button").filter({ hasText: "Home" }).click();
  const insight = page.locator(".run-insight");
  await expect(insight).toBeVisible();
  await expect(insight).toContainText("Active equation balance");
  await insight.screenshot({ path: testInfo.outputPath("mobile-run-explanation.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(consoleErrors).toEqual([]);
});
