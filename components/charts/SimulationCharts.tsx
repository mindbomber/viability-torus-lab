"use client";

import { useEffect, useMemo, useRef } from "react";
import type { SimulationFrame, SimulationParameters } from "@/engine/simulator";
import {
  displayExcursion,
  nearestFrameForUnwrappedPoint,
  signedDifferenceMetricScales,
  timeSeriesScales,
} from "./visualizationMath";

type BaseProps = {
  frames: SimulationFrame[];
  frameIndex: number;
  params: SimulationParameters;
  onSelect?: (index: number) => void;
  label?: string;
};

type TimeSeriesProps = BaseProps & {
  revealFuture?: boolean;
};

export type ExternalPhaseView = "latent" | "estimated";

type UnwrappedProps = BaseProps & {
  phaseView?: ExternalPhaseView;
};

export function TimeSeriesChart({ frames, frameIndex, params, onSelect, revealFuture = false, label = "Toy alignment proxy A equals e to the minus rho, debt, and radial excursion over time" }: TimeSeriesProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const visibleCount = revealFuture
    ? frames.length
    : Math.max(1, Math.min(frameIndex + 1, frames.length));
  const renderedFrames = useMemo(
    () => frames.slice(0, visibleCount),
    [frames, visibleCount],
  );
  const scales = useMemo(() => timeSeriesScales(renderedFrames, params), [params, renderedFrames]);
  useChart(ref, (ctx, width, height) => {
    const pad = { l: 35, r: 12, t: 30, b: 27 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    drawGrid(ctx, pad.l, pad.t, w, h);
    const series = [
      { color: "#71e17d", value: (f: SimulationFrame) => f.alignment },
      { color: "#ff5b62", value: (f: SimulationFrame) => f.debt / scales.debt },
      { color: "#49bfff", value: (f: SimulationFrame) => f.rho / scales.rho, dash: [5, 4] },
    ];
    for (const item of series) {
      ctx.beginPath();
      ctx.setLineDash(item.dash ?? []);
      renderedFrames.forEach((frame, index) => {
        const x = pad.l + (index / Math.max(1, frames.length - 1)) * w;
        const y = pad.t + h - item.value(frame) * h;
        if (index) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.7;
      ctx.stroke();
      const current = renderedFrames.at(-1);
      if (current) {
        const currentX = pad.l + ((renderedFrames.length - 1) / Math.max(1, frames.length - 1)) * w;
        const currentY = pad.t + h - item.value(current) * h;
        ctx.fillStyle = item.color;
        ctx.beginPath(); ctx.arc(currentX, currentY, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.setLineDash([]);
    if (!revealFuture && visibleCount < frames.length) {
      const futureX = pad.l + (Math.max(0, visibleCount - 1) / Math.max(1, frames.length - 1)) * w;
      const shadeX = Math.min(pad.l + w, futureX + 4);
      ctx.fillStyle = "rgba(3, 11, 25, .62)";
      ctx.fillRect(shadeX, pad.t, pad.l + w - shadeX, h);
      ctx.fillStyle = "rgba(181,204,235,.54)";
      ctx.font = "10px ui-monospace";
      ctx.fillText("future not revealed", Math.min(futureX + 7, pad.l + w - 102), pad.t + 14);
    }
    const cursorX = pad.l + (frameIndex / Math.max(1, frames.length - 1)) * w;
    ctx.strokeStyle = "rgba(255,255,255,.65)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cursorX, pad.t); ctx.lineTo(cursorX, pad.t + h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(181,204,235,.7)";
    ctx.font = "10px ui-monospace";
    ctx.fillText("0", 12, pad.t + h + 4);
    ctx.fillText("1.0", 8, pad.t + 4);
    ctx.fillText(`${frames.at(-1)?.time.toFixed(0) ?? 0}s`, width - 38, height - 8);
    drawScaleLegend(ctx, scales.debt, scales.rho);
  });
  return <canvas ref={ref} className="chart-canvas" role="img" data-chart-kind="timeseries" data-view-mode={revealFuture ? "projection" : "causal"} data-visible-frame-count={visibleCount} aria-label={`${label}. ${revealFuture ? "Full-run projection is visible" : `Causal playback view through step ${frameIndex}; future values are hidden`}. Independent scales: proxy A 0 to 1, debt 0 to ${scales.debt.toFixed(2)}, radial excursion 0 to ${scales.rho.toFixed(2)}.`} onPointerDown={(event) => {
    if (!onSelect || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - 35) / Math.max(1, rect.width - 47)));
    const selectableEnd = revealFuture ? frames.length - 1 : Math.min(frameIndex, frames.length - 1);
    onSelect(Math.min(selectableEnd, Math.round(ratio * (frames.length - 1))));
  }} />;
}

export function UnwrappedChart({ frames, frameIndex, params, onSelect, phaseView = "latent" }: UnwrappedProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const externalPhase = (frame: SimulationFrame) => phaseView === "estimated" ? frame.estimatedPhi : frame.phi;
  const currentFrame = frames[Math.min(frameIndex, frames.length - 1)];
  const currentExternalPhase = currentFrame ? externalPhase(currentFrame) : undefined;
  useChart(ref, (ctx, width, height) => {
    const pad = { l: 34, r: 12, t: 14, b: 27 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    const gradient = ctx.createLinearGradient(pad.l, pad.t, pad.l + w, pad.t + h);
    gradient.addColorStop(0, "rgba(34,113,255,.22)");
    gradient.addColorStop(.5, "rgba(105,54,200,.18)");
    gradient.addColorStop(1, "rgba(255,85,45,.22)");
    ctx.fillStyle = gradient; ctx.fillRect(pad.l, pad.t, w, h);
    drawGrid(ctx, pad.l, pad.t, w, h);
    const end = Math.min(frameIndex, frames.length - 1);
    let prev: { x: number; y: number } | null = null;
    for (let index = 0; index <= end; index += Math.max(1, Math.floor(frames.length / 420))) {
      const frame = frames[index];
      const phi = externalPhase(frame);
      if (phi === undefined) continue;
      const point = { x: pad.l + (frame.theta / (Math.PI * 2)) * w, y: pad.t + h - (phi / (Math.PI * 2)) * h };
      if (prev && Math.abs(point.x - prev.x) < w * .55 && Math.abs(point.y - prev.y) < h * .55) {
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = frame.rho > params.rhoCrit * .7 ? "#ff6a45" : "rgba(211,237,255,.86)";
        ctx.lineWidth = 1.45; ctx.stroke();
      }
      prev = point;
    }
    const currentPhi = frames[end] ? externalPhase(frames[end]) : undefined;
    if (frames[end] && currentPhi !== undefined) {
      const current = { x: pad.l + (frames[end].theta / (Math.PI * 2)) * w, y: pad.t + h - (currentPhi / (Math.PI * 2)) * h };
      ctx.fillStyle = "#fff2a8"; ctx.shadowColor = "#ff9f4a"; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.arc(current.x, current.y, 3.3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.fillStyle = "rgba(181,204,235,.72)"; ctx.font = "10px ui-monospace";
    ctx.fillText("0", pad.l, height - 8); ctx.fillText("2π", width - 27, height - 8);
    ctx.fillText(phaseView === "estimated" ? "estimated φ" : "latent φ", 3, 20);
    ctx.fillText("θ · local correction phase", Math.max(pad.l, width / 2 - 70), height - 8);
    ctx.fillStyle = "rgba(181,204,235,.5)";
    ctx.fillText("opposite edges identified", Math.max(pad.l + 50, pad.l + w - 123), pad.t + 11);
  });
  return <canvas ref={ref} className="chart-canvas" role="img" data-chart-kind="unwrapped" data-axis-order="theta-x-phi-y" data-phase-view={phaseView} data-current-theta={currentFrame?.theta.toFixed(6)} data-current-phi={currentExternalPhase?.toFixed(6)} aria-label={`Unwrapped torus plot with local correction phase theta on the horizontal axis and ${phaseView === "estimated" ? "offline estimated" : "simulated latent"} external phase phi on the vertical axis. Opposite edges are identified. Radial warning points are highlighted.`} onPointerDown={(event) => {
    if (!onSelect || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left - 34) / Math.max(1, rect.width - 46)));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top - 14) / Math.max(1, rect.height - 41)));
    const targetTheta = x * Math.PI * 2;
    const targetPhi = (1 - y) * Math.PI * 2;
    onSelect(nearestFrameForUnwrappedPoint(frames, targetTheta, targetPhi, frameIndex, externalPhase));
  }} />;
}

export function RadialStabilityChart({ frames, frameIndex, params }: BaseProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const display = displayExcursion(frame?.rho ?? 0, params.rhoCrit, 1.45);
  const debtPressure = params.chi * (frame?.debt ?? 0);
  useChart(ref, (ctx, width, height) => {
    const pad = { l: 38, r: 12, t: 28, b: 27 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    drawGrid(ctx, pad.l, pad.t, w, h);
    const rhoMax = params.rhoCrit * 1.45;
    const curveVelocities = [-0.25, 0, 0.25].flatMap((margin) => [
      -params.kappa * (0 - params.rho0) - margin + debtPressure,
      -params.kappa * (rhoMax - params.rho0) - margin + debtPressure,
    ]);
    const velocityScale = Math.max(
      0.35,
      Math.abs(frame?.radialVelocity ?? 0),
      ...curveVelocities.map(Math.abs),
    );
    const velocityY = (value: number) => pad.t + h / 2 - (value / velocityScale) * h * .44;
    const zeroY = velocityY(0);
    ctx.fillStyle = "rgba(255, 99, 78, .035)";
    ctx.fillRect(pad.l, pad.t, w, Math.max(0, zeroY - pad.t));
    ctx.fillStyle = "rgba(73, 191, 255, .035)";
    ctx.fillRect(pad.l, zeroY, w, Math.max(0, pad.t + h - zeroY));
    const values = [-0.25, 0, 0.25];
    values.forEach((margin, line) => {
      ctx.beginPath();
      for (let i = 0; i <= 60; i += 1) {
        const rho = (i / 60) * rhoMax;
        const velocity = -params.kappa * (rho - params.rho0) - margin + debtPressure;
        const x = pad.l + (rho / rhoMax) * w;
        const y = velocityY(velocity);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = ["#ff5d62", "rgba(194,213,239,.58)", "#48bfff"][line];
      ctx.setLineDash(line === 1 ? [4, 3] : []);
      ctx.lineWidth = 1.4; ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,.58)";
    ctx.lineWidth = 1.15;
    ctx.beginPath(); ctx.moveTo(pad.l, zeroY); ctx.lineTo(pad.l + w, zeroY); ctx.stroke();
    const criticalX = pad.l + (params.rhoCrit / (params.rhoCrit * 1.45)) * w;
    ctx.strokeStyle = "rgba(255,177,66,.7)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(criticalX, pad.t); ctx.lineTo(criticalX, pad.t + h); ctx.stroke(); ctx.setLineDash([]);
    if (frame) {
      const rawX = pad.l + (frame.rho / rhoMax) * w;
      const x = Math.max(pad.l + 4, Math.min(pad.l + w - 4, rawX));
      const y = Math.max(pad.t + 4, Math.min(pad.t + h - 4, velocityY(frame.radialVelocity)));
      ctx.fillStyle = "#fff2a8"; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      if (display.offScale) {
        ctx.fillStyle = "#ff765f";
        ctx.beginPath(); ctx.moveTo(pad.l + w - 1, y); ctx.lineTo(pad.l + w - 10, y - 6); ctx.lineTo(pad.l + w - 10, y + 6); ctx.closePath(); ctx.fill();
        ctx.font = "10px ui-monospace";
        ctx.fillText(`off-scale ${display.ratio.toFixed(1)}×`, Math.max(pad.l, width - 100), pad.t + 11);
      }
    }
    ctx.fillStyle = "rgba(181,204,235,.72)"; ctx.font = "10px ui-monospace";
    ctx.fillText("expansion · dρ/dt > 0", Math.max(pad.l + 4, width - 144), pad.t + 13);
    ctx.fillText("contraction · dρ/dt < 0", pad.l + 4, pad.t + h - 6);
    ctx.fillStyle = "rgba(255,177,66,.78)";
    ctx.fillText("ρcrit", criticalX + 4, pad.t + h - 17);
    ctx.fillStyle = "rgba(181,204,235,.72)";
    ctx.fillText("ρ · misalignment excursion", Math.max(pad.l, width / 2 - 70), height - 8);
    ctx.fillText("dρ/dt", 4, 14);
    ctx.fillStyle = "rgba(181,204,235,.58)";
    ctx.fillText(`reference curves include χΔ=${debtPressure.toFixed(2)} · C−D −.25 / 0 / +.25`, pad.l, 11);
  });
  return <canvas ref={ref} className="chart-canvas" role="img" data-chart-kind="radial-stability" data-offscale={display.offScale ? "true" : "false"} aria-label={`Radial stability plot showing d rho over dt against rho. Positive d rho over dt means expansion; negative means contraction. This Equation 11 slice holds current debt pressure chi Delta ${debtPressure.toFixed(3)} fixed while reference curves use correction margins C minus D of minus 0.25, zero, and plus 0.25. Current excursion ${(frame?.rho ?? 0).toFixed(2)}, or ${display.ratio.toFixed(2)} times the critical radius${display.offScale ? "; the marker is clamped to the chart boundary as an off-scale value" : ""}.`} />;
}

export function DifferenceChart({ frames, frameIndex, label = "Difference between baseline and comparison run" }: BaseProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scales = useMemo(() => signedDifferenceMetricScales(frames), [frames]);
  const current = frames[Math.min(frameIndex, frames.length - 1)];
  useChart(ref, (ctx, width, height) => {
    const pad = { l: 76, r: 48, t: 20, b: 18 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    const series = [
      { key: "alignment" as const, label: "Toy A", color: "#71e17d", value: (frame: SimulationFrame) => frame.alignment },
      { key: "debt" as const, label: "Debt Δ", color: "#ff5b62", value: (frame: SimulationFrame) => frame.debt },
      { key: "rho" as const, label: "Excursion ρ", color: "#49bfff", value: (frame: SimulationFrame) => frame.rho },
    ];
    const laneHeight = h / series.length;
    series.forEach((item, lane) => {
      const laneTop = pad.t + lane * laneHeight;
      const zeroY = laneTop + laneHeight / 2;
      ctx.fillStyle = lane % 2 ? "rgba(14,34,58,.22)" : "rgba(8,24,43,.16)";
      ctx.fillRect(pad.l, laneTop, w, laneHeight);
      ctx.strokeStyle = "rgba(255,255,255,.32)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, zeroY); ctx.lineTo(pad.l + w, zeroY); ctx.stroke();
      ctx.beginPath();
      frames.forEach((frame, index) => {
        const x = pad.l + (index / Math.max(1, frames.length - 1)) * w;
        const y = zeroY - (item.value(frame) / scales[item.key]) * laneHeight * .38;
        if (index) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.fillStyle = item.color;
      ctx.font = "10px ui-monospace";
      ctx.fillText(item.label, 8, zeroY + 3);
      ctx.fillStyle = "rgba(181,204,235,.68)";
      ctx.fillText(`±${scales[item.key].toFixed(3)}`, width - 44, zeroY + 3);
    });
    const cursorX = pad.l + (frameIndex / Math.max(1, frames.length - 1)) * w;
    ctx.strokeStyle = "rgba(255,255,255,.45)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cursorX, pad.t); ctx.lineTo(cursorX, pad.t + h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(181,204,235,.78)";
    ctx.font = "10px ui-monospace";
    ctx.fillText("Signed A − B · independent symmetric scales", pad.l, 12);
  });
  return <canvas ref={ref} className="chart-canvas" role="img" data-chart-kind="difference" aria-label={`${label}. Signed configuration A minus configuration B values use independent symmetric scales: toy proxy plus or minus ${scales.alignment.toFixed(3)}, debt plus or minus ${scales.debt.toFixed(3)}, and radial excursion plus or minus ${scales.rho.toFixed(3)}. Current raw differences: toy proxy ${formatSigned(current?.alignment ?? 0)}, debt ${formatSigned(current?.debt ?? 0)}, radial excursion ${formatSigned(current?.rho ?? 0)}.`} />;
}

function useChart(ref: React.RefObject<HTMLCanvasElement | null>, draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void) {
  const drawRef = useRef(draw);
  const renderRef = useRef<(() => void) | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const visibleRef = useRef(true);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const render = () => {
      if (!visibleRef.current) return;
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.floor(width * dpr));
      const pixelHeight = Math.max(1, Math.floor(height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawRef.current(ctx, width, height);
    };
    renderRef.current = render;
    const updateSize = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      sizeRef.current = { width, height };
      render();
    };
    const rect = canvas.getBoundingClientRect();
    updateSize(rect.width, rect.height);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(canvas);
    const visibilityObserver = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      visibleRef.current = entries[0]?.isIntersecting ?? true;
      if (visibleRef.current) render();
    }, { rootMargin: "120px" });
    visibilityObserver?.observe(canvas);
    return () => {
      observer.disconnect();
      visibilityObserver?.disconnect();
      renderRef.current = null;
    };
  }, [ref]);

  useEffect(() => {
    drawRef.current = draw;
    renderRef.current?.();
  }, [draw]);
}

function drawGrid(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.strokeStyle = "rgba(107,151,207,.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i += 1) {
    const px = x + (width * i) / 6;
    const py = y + (height * i) / 6;
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + width, py); ctx.stroke();
  }
}

function drawScaleLegend(ctx: CanvasRenderingContext2D, maxDebt: number, maxRho: number) {
  ctx.font = "10px ui-monospace";
  ctx.fillStyle = "#71e17d";
  ctx.fillText("A 0–1", 36, 12);
  ctx.fillStyle = "#ff5b62";
  ctx.fillText(`Δ 0–${maxDebt.toFixed(2)}`, 86, 12);
  ctx.fillStyle = "#49bfff";
  ctx.fillText(`ρ 0–${maxRho.toFixed(2)}`, 162, 12);
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}
