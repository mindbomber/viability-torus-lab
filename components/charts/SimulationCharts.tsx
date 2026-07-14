"use client";

import { useEffect, useMemo, useRef } from "react";
import type { SimulationFrame, SimulationParameters } from "@/engine/simulator";
import {
  displayExcursion,
  nearestFrameForUnwrappedPoint,
  signedDifferenceScale,
  timeSeriesScales,
} from "./visualizationMath";

type BaseProps = {
  frames: SimulationFrame[];
  frameIndex: number;
  params: SimulationParameters;
  onSelect?: (index: number) => void;
  label?: string;
};

export function TimeSeriesChart({ frames, frameIndex, params, onSelect, label = "Alignment, debt, and radial excursion over time" }: BaseProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scales = useMemo(() => timeSeriesScales(frames, params), [frames, params]);
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
      frames.forEach((frame, index) => {
        const x = pad.l + (index / Math.max(1, frames.length - 1)) * w;
        const y = pad.t + h - item.value(frame) * h;
        if (index) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.7;
      ctx.stroke();
    }
    ctx.setLineDash([]);
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
  return <canvas ref={ref} className="chart-canvas" role="img" data-chart-kind="timeseries" aria-label={`${label}. Independent scales: alignment 0 to 1, debt 0 to ${scales.debt.toFixed(2)}, radial excursion 0 to ${scales.rho.toFixed(2)}.`} onPointerDown={(event) => {
    if (!onSelect || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - 35) / Math.max(1, rect.width - 47)));
    onSelect(Math.round(ratio * (frames.length - 1)));
  }} />;
}

export function UnwrappedChart({ frames, frameIndex, params, onSelect }: BaseProps) {
  const ref = useRef<HTMLCanvasElement>(null);
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
      const point = { x: pad.l + (frame.phi / (Math.PI * 2)) * w, y: pad.t + h - (frame.theta / (Math.PI * 2)) * h };
      if (prev && Math.abs(point.x - prev.x) < w * .55 && Math.abs(point.y - prev.y) < h * .55) {
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = frame.rho > params.rhoCrit * .7 ? "#ff6a45" : "rgba(211,237,255,.86)";
        ctx.lineWidth = 1.45; ctx.stroke();
      }
      prev = point;
    }
    if (frames[end]) {
      const current = { x: pad.l + (frames[end].phi / (Math.PI * 2)) * w, y: pad.t + h - (frames[end].theta / (Math.PI * 2)) * h };
      ctx.fillStyle = "#fff2a8"; ctx.shadowColor = "#ff9f4a"; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.arc(current.x, current.y, 3.3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.fillStyle = "rgba(181,204,235,.72)"; ctx.font = "10px ui-monospace";
    ctx.fillText("0", pad.l, height - 8); ctx.fillText("2π", width - 27, height - 8); ctx.fillText("θ", 11, 20); ctx.fillText("φ", width / 2, height - 8);
  });
  return <canvas ref={ref} className="chart-canvas" role="img" data-chart-kind="unwrapped" aria-label="Unwrapped torus plot of simulated local phase theta versus simulated latent external phase phi, with radial warning points." onPointerDown={(event) => {
    if (!onSelect || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left - 34) / Math.max(1, rect.width - 46)));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top - 14) / Math.max(1, rect.height - 41)));
    const targetPhi = x * Math.PI * 2;
    const targetTheta = (1 - y) * Math.PI * 2;
    onSelect(nearestFrameForUnwrappedPoint(frames, targetTheta, targetPhi, frameIndex));
  }} />;
}

export function RadialStabilityChart({ frames, frameIndex, params }: BaseProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const display = displayExcursion(frame?.rho ?? 0, params.rhoCrit, 1.45);
  useChart(ref, (ctx, width, height) => {
    const pad = { l: 38, r: 12, t: 15, b: 27 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    drawGrid(ctx, pad.l, pad.t, w, h);
    const rhoMax = params.rhoCrit * 1.45;
    const curveVelocities = [-0.25, 0, 0.25].flatMap((margin) => [
      -params.kappa * (0 - params.rho0) + margin,
      -params.kappa * (rhoMax - params.rho0) + margin,
    ]);
    const velocityScale = Math.max(
      0.35,
      Math.abs(frame?.radialVelocity ?? 0),
      ...curveVelocities.map(Math.abs),
    );
    const velocityY = (value: number) => pad.t + h / 2 - (value / velocityScale) * h * .44;
    const values = [-0.25, 0, 0.25];
    values.forEach((margin, line) => {
      ctx.beginPath();
      for (let i = 0; i <= 60; i += 1) {
        const rho = (i / 60) * rhoMax;
        const velocity = -params.kappa * (rho - params.rho0) + margin;
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
    ctx.fillText("contraction", pad.l, height - 8); ctx.fillText("ρ critical", criticalX - 20, height - 8); ctx.fillText("dρ/dt", 4, 14);
  });
  return <canvas ref={ref} className="chart-canvas" role="img" data-chart-kind="radial-stability" data-offscale={display.offScale ? "true" : "false"} aria-label={`Radial stability plot showing contraction, neutral, and expansion regimes with current state and critical radius. Current excursion ${(frame?.rho ?? 0).toFixed(2)}, or ${display.ratio.toFixed(2)} times the critical radius${display.offScale ? "; the marker is clamped to the chart boundary as an off-scale value" : ""}.`} />;
}

export function DifferenceChart({ frames, frameIndex, label = "Difference between baseline and comparison run" }: BaseProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = useMemo(() => signedDifferenceScale(frames), [frames]);
  const current = frames[Math.min(frameIndex, frames.length - 1)];
  useChart(ref, (ctx, width, height) => {
    const pad = { l: 45, r: 14, t: 30, b: 27 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    drawGrid(ctx, pad.l, pad.t, w, h);
    const zeroY = pad.t + h / 2;
    ctx.strokeStyle = "rgba(255,255,255,.72)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pad.l, zeroY); ctx.lineTo(pad.l + w, zeroY); ctx.stroke();
    const series = [
      { color: "#71e17d", value: (frame: SimulationFrame) => frame.alignment },
      { color: "#ff5b62", value: (frame: SimulationFrame) => frame.debt },
      { color: "#49bfff", value: (frame: SimulationFrame) => frame.rho, dash: [5, 4] },
    ];
    for (const item of series) {
      ctx.beginPath();
      ctx.setLineDash(item.dash ?? []);
      frames.forEach((frame, index) => {
        const x = pad.l + (index / Math.max(1, frames.length - 1)) * w;
        const y = zeroY - (item.value(frame) / scale) * h * .44;
        if (index) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.7;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const cursorX = pad.l + (frameIndex / Math.max(1, frames.length - 1)) * w;
    ctx.strokeStyle = "rgba(255,255,255,.45)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cursorX, pad.t); ctx.lineTo(cursorX, pad.t + h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(181,204,235,.78)";
    ctx.font = "10px ui-monospace";
    ctx.fillText(`+${scale.toFixed(3)}`, 5, pad.t + 4);
    ctx.fillText("0", 26, zeroY + 4);
    ctx.fillText(`−${scale.toFixed(3)}`, 5, pad.t + h);
    ctx.fillText("Signed A − B · shared scale", pad.l, 12);
  });
  return <canvas ref={ref} className="chart-canvas" role="img" data-chart-kind="difference" aria-label={`${label}. Signed A minus B values on a shared symmetric scale from minus ${scale.toFixed(3)} to plus ${scale.toFixed(3)}, with zero at the center. Current differences: alignment ${formatSigned(current?.alignment ?? 0)}, debt ${formatSigned(current?.debt ?? 0)}, radial excursion ${formatSigned(current?.rho ?? 0)}.`} />;
}

function useChart(ref: React.RefObject<HTMLCanvasElement | null>, draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      draw(ctx, rect.width, rect.height);
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw, ref]);
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
