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

test("canvases render and linked playback remains causal and synchronized", async ({ page }) => {
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
  await expect(page.locator('canvas[data-chart-kind="timeseries"]')).toHaveAttribute(
    "aria-label",
    /Independent scales: alignment 0 to 1, debt 0 to .* radial excursion 0 to/i,
  );

  const torusBefore = await canvasFingerprint(page, 'canvas[data-chart-kind="torus"]');
  await page.getByRole("button", { name: "Step +1" }).click();
  await expect(page.getByText(/step 1$/i)).toBeVisible();
  await expect.poll(async () => (await canvasFingerprint(page, 'canvas[data-chart-kind="torus"]')).data).not.toBe(torusBefore.data);

  const timeline = page.getByLabel("Simulation time");
  const timeChart = page.locator('canvas[data-chart-kind="timeseries"]');
  const box = await timeChart.boundingBox();
  expect(box).not.toBeNull();
  await timeChart.click({ position: { x: box!.width * .52, y: box!.height * .5 } });
  const linkedStep = Number(await timeline.inputValue());
  expect(linkedStep).toBeGreaterThan(350);
  expect(linkedStep).toBeLessThan(600);

  await timeline.focus();
  await timeline.press("End");
  await expect(page.getByText("Available after full run")).toHaveCount(0);
  await expect(page.getByText(/final outcome is not yet shown/i)).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("comparison canvas preserves a signed zero baseline and responds to B", async ({ page }) => {
  const consoleErrors = await openDashboard(page);
  await page.locator(".top-actions button").filter({ hasText: "Compare" }).click();
  await expect(page.getByRole("heading", { name: "Compare two futures" })).toBeVisible();
  const difference = page.locator('canvas[data-chart-kind="difference"]');
  await expect(difference).toHaveAttribute("aria-label", /zero at the center/i);
  await expect(difference).toHaveAttribute("aria-label", /alignment \+0\.000, debt \+0\.000, radial excursion \+0\.000/i);
  const beforeLabel = await difference.getAttribute("aria-label");
  const before = await canvasFingerprint(page, 'canvas[data-chart-kind="difference"]');

  const pressure = page.getByLabel("B pressure π");
  await pressure.fill("2.5");
  await expect(page.getByText("1 controlled change", { exact: false }).first()).toBeVisible();
  await expect.poll(async () => difference.getAttribute("aria-label")).not.toBe(beforeLabel);
  await expect.poll(async () => (await canvasFingerprint(page, 'canvas[data-chart-kind="difference"]')).data).not.toBe(before.data);
  expect(consoleErrors).toEqual([]);
});

test("permitted extreme parameters keep off-scale rupture evidence visible", async ({ page }) => {
  test.setTimeout(60_000);
  const consoleErrors = await openDashboard(page);
  const values: Array<[string, string]> = [
    ["Deployment pressure numeric value", "3"],
    ["Feedback quality numeric value", "0"],
    ["Verification & correction numeric value", "0"],
    ["Constraint misunderstanding numeric value", "1"],
    ["Unresolved failure debt numeric value", "2"],
    ["Environment change numeric value", "0.5"],
    ["Downstream damage numeric value", "0.35"],
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
  const rendered = await canvasFingerprint(page, 'canvas[data-chart-kind="torus"]');
  expect(rendered.data.length).toBeGreaterThan(10_000);
  expect(consoleErrors).toEqual([]);
});

test("mobile dashboard renders the visualization fallback without clipping the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const consoleErrors = await openDashboard(page);
  await expect(page.getByRole("button", { name: /Open primary navigation menu/i })).toBeVisible();
  const torus = await canvasFingerprint(page, 'canvas[data-chart-kind="torus"]');
  expect(torus.width).toBeGreaterThanOrEqual(300);
  expect(torus.height).toBeGreaterThanOrEqual(150);
  expect(consoleErrors).toEqual([]);
});
