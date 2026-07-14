"use client";

import { useEffect, useRef } from "react";
import type { SimulationFrame, SimulationParameters } from "@/engine/simulator";

type BaseProps = {
  frames: SimulationFrame[];
  frameIndex: number;
  params: SimulationParameters;
  onSelect?: (index: number) => void;
  label?: string;
};

export function TimeSeriesChart({ frames, frameIndex, params, onSelect, label = "Alignment, debt, and radial excursion over time" }: BaseProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useChart(ref, (ctx, width, height) => {
    const pad = { l: 35, r: 12, t: 18, b: 27 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    drawGrid(ctx, pad.l, pad.t, w, h);
    const maxDebt = Math.max(1, ...frames.map((f) => f.debt));
    const maxRho = Math.max(params.rhoCrit, ...frames.map((f) => f.rho));
    const series = [
      { color: "#71e17d", value: (f: SimulationFrame) => f.alignment },
      { color: "#ff5b62", value: (f: SimulationFrame) => f.debt / maxDebt },
      { color: "#49bfff", value: (f: SimulationFrame) => f.rho / maxRho, dash: [5, 4] },
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
  });
  return <canvas ref={ref} className="chart-canvas" role="img" aria-label={label} onPointerDown={(event) => {
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
  return <canvas ref={ref} className="chart-canvas" role="img" aria-label="Unwrapped torus plot of local phase theta versus external phase phi, with radial warning points." onPointerDown={(event) => {
    if (!onSelect || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left - 34) / Math.max(1, rect.width - 46)));
    const targetPhi = x * Math.PI * 2;
    let best = 0;
    let distance = Infinity;
    frames.forEach((frame, index) => {
      const d = Math.abs(frame.phi - targetPhi);
      if (d < distance) { best = index; distance = d; }
    });
    onSelect(best);
  }} />;
}

export function RadialStabilityChart({ frames, frameIndex, params }: BaseProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useChart(ref, (ctx, width, height) => {
    const pad = { l: 38, r: 12, t: 15, b: 27 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    drawGrid(ctx, pad.l, pad.t, w, h);
    const values = [-0.25, 0, 0.25];
    values.forEach((margin, line) => {
      ctx.beginPath();
      for (let i = 0; i <= 60; i += 1) {
        const rho = (i / 60) * params.rhoCrit * 1.45;
        const velocity = -params.kappa * (rho - params.rho0) + margin;
        const x = pad.l + (rho / (params.rhoCrit * 1.45)) * w;
        const y = pad.t + h / 2 - velocity * h * .85;
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
    const frame = frames[Math.min(frameIndex, frames.length - 1)];
    if (frame) {
      const x = pad.l + (frame.rho / (params.rhoCrit * 1.45)) * w;
      const y = pad.t + h / 2 - frame.radialVelocity * h * .85;
      ctx.fillStyle = "#fff2a8"; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "rgba(181,204,235,.72)"; ctx.font = "10px ui-monospace";
    ctx.fillText("contraction", pad.l, height - 8); ctx.fillText("ρ critical", criticalX - 20, height - 8); ctx.fillText("dρ/dt", 4, 14);
  });
  return <canvas ref={ref} className="chart-canvas" role="img" aria-label="Radial stability plot showing contraction, neutral, and expansion regimes with current state and critical radius." />;
}

export function DifferenceChart({ frames, frameIndex, params, label = "Difference between baseline and comparison run" }: BaseProps) {
  return <TimeSeriesChart frames={frames} frameIndex={frameIndex} params={params} label={label} />;
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
