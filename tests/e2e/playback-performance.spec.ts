import { expect, test } from "@playwright/test";

type PlaybackProfile = {
  frameIntervals: number[];
  longTasks: number[];
};

declare global {
  interface Window {
    __playbackProfile?: PlaybackProfile;
    __stopPlaybackProfile?: () => void;
  }
}

test("playback stays responsive and deferred charts draw when revealed", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.locator(".simulation-bar select").selectOption("8");

  await page.evaluate(() => {
    const profile: PlaybackProfile = { frameIntervals: [], longTasks: [] };
    let active = true;
    let previous = performance.now();
    const observer = new PerformanceObserver((list) => {
      profile.longTasks.push(...list.getEntries().map((entry) => entry.duration));
    });
    try {
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // Chromium exposes long tasks; keep cadence coverage if another browser does not.
    }
    const sample = (now: number) => {
      profile.frameIntervals.push(now - previous);
      previous = now;
      if (active) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    window.__playbackProfile = profile;
    window.__stopPlaybackProfile = () => {
      active = false;
      observer.disconnect();
    };
  });

  await page.locator(".simulation-bar .primary").click();
  await page.waitForTimeout(12_000);

  const finalStep = Number(await page.locator(".aix-drawer").getAttribute("data-frame-step"));
  const profile = await page.evaluate(() => {
    window.__stopPlaybackProfile?.();
    return window.__playbackProfile ?? { frameIntervals: [], longTasks: [] };
  });
  const sorted = profile.frameIntervals.slice(5).sort((left, right) => left - right);
  const percentile = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? Number.POSITIVE_INFINITY;
  const result = {
    samples: sorted.length,
    p95: percentile(0.95),
    maxLongTask: Math.max(0, ...profile.longTasks),
    finalStep,
  };
  console.log("PLAYBACK_PROFILE", JSON.stringify(result));

  expect(result.finalStep).toBe(959);
  expect(result.samples).toBeGreaterThan(200);
  expect(result.p95).toBeLessThan(150);
  expect(result.maxLongTask).toBeLessThan(500);

  await page.locator(".chart-grid").scrollIntoViewIfNeeded();
  await expect.poll(async () => page.locator(".chart-grid canvas").evaluateAll((canvases) => canvases.every((canvas) => (canvas as HTMLCanvasElement).toDataURL().length > 1_500))).toBe(true);
  await page.locator(".chart-grid").screenshot({ path: testInfo.outputPath("playback-complete-charts.png") });

  await page.getByRole("button", { name: "|◀ Start", exact: true }).click();
  await page.locator(".torus-panel").scrollIntoViewIfNeeded();
  await page.locator(".simulation-bar .primary").click();
  await expect(page.locator(".aix-drawer")).toHaveAttribute("data-frame-step", "1");
  const firstHoldPaint = await page.locator(".torus-panel canvas").evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(120);
  await expect(page.locator(".aix-drawer")).toHaveAttribute("data-frame-step", "1");
  const secondHoldPaint = await page.locator(".torus-panel canvas").evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  expect(secondHoldPaint).not.toBe(firstHoldPaint);
});
