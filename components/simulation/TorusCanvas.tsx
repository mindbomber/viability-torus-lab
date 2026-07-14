"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SimulationFrame, SimulationParameters } from "@/engine/simulator";
import {
  displayDebt,
  displayExcursion,
  phaseAnalysisAvailable,
} from "@/components/charts/visualizationMath";

type Props = {
  frames: SimulationFrame[];
  frameIndex: number;
  params: SimulationParameters;
  playing: boolean;
  onSelectFrame: (index: number) => void;
  compact?: boolean;
};

type Point3 = { x: number; y: number; z: number };
type Point2 = { x: number; y: number; z: number };

const TAU = Math.PI * 2;

export function TorusCanvas({
  frames,
  frameIndex,
  params,
  playing,
  onSelectFrame,
  compact = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [yaw, setYaw] = useState(-0.58);
  const [pitch, setPitch] = useState(0.93);
  const [zoom, setZoom] = useState(compact ? 0.78 : 1);
  const [pan, setPan] = useState({ x: 0, y: compact ? 4 : 12 });
  const [wireframe, setWireframe] = useState(false);
  const [showLabels, setShowLabels] = useState(!compact);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showTube, setShowTube] = useState(true);
  const [view2d, setView2d] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const drag = useRef<{ x: number; y: number; pan: boolean } | null>(null);
  const spinRef = useRef(0);
  const trajectoryPoints = useRef<{ index: number; x: number; y: number }[]>([]);

  const frame = frames[Math.min(frameIndex, frames.length - 1)] ?? frames[0];
  const excursion = displayExcursion(frame?.rho ?? 0, params.rhoCrit);
  const severity = Math.min(1, excursion.ratio);
  const phaseReady = phaseAnalysisAvailable(frameIndex, frames.length);
  const geometryState = useMemo(() => {
    if (!frame) return "calibrating";
    if (frame.viabilityState === "Irreversible rupture") return "irreversible rupture · recurrence lost";
    if (frame.viabilityState === "Viability-boundary crossing") return "viability-boundary crossing";
    if (frame.viabilityState === "Recoverable excursion") return "recoverable excursion";
    if (severity > 0.78) return "expanding excursion";
    if (frame.status === "Recovering") return "partial recovery";
    if (phaseReady && frame.phaseRegime === "Phase locked") return "phase-locked trajectory";
    if (frame.debt > 0.7) return "illustrative debt deformation";
    if (severity > 0.45) return "illustrative locally warped view";
    return "synthetic viable torus";
  }, [frame, phaseReady, severity]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !frame) return;
    let animation = 0;
    let previous = performance.now();

    const draw = (now: number) => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);

      const dt = Math.min(40, now - previous);
      previous = now;
      if (playing && !motionPaused && !view2d) spinRef.current += dt * 0.000045;

      const bg = ctx.createRadialGradient(width * 0.53, height * 0.48, 10, width * 0.5, height * 0.5, width * 0.6);
      bg.addColorStop(0, "rgba(27, 43, 92, .28)");
      bg.addColorStop(0.45, "rgba(8, 20, 46, .1)");
      bg.addColorStop(1, "rgba(1, 7, 18, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      drawStarfield(ctx, width, height);

      if (view2d) {
        drawUnwrapped(ctx, width, height, frames, frameIndex, params);
      } else {
        const scale = Math.min(width / 7.9, height / 5.2) * zoom;
        const centerX = width / 2 + pan.x;
        const centerY = height / 2 + pan.y;
        const localYaw = yaw + spinRef.current;
        const project = (point: Point3): Point2 => {
          const cy = Math.cos(localYaw);
          const sy = Math.sin(localYaw);
          const cp = Math.cos(pitch);
          const sp = Math.sin(pitch);
          const x1 = point.x * cy - point.z * sy;
          const z1 = point.x * sy + point.z * cy;
          const y2 = point.y * cp - z1 * sp;
          const z2 = point.y * sp + z1 * cp;
          const perspective = 1 + z2 * 0.045;
          return { x: centerX + x1 * scale * perspective, y: centerY + y2 * scale * perspective, z: z2 };
        };

        drawTorus(ctx, project, frame, params, wireframe, showTube, compact, now, reducedMotion);
        trajectoryPoints.current = showTrajectory && frame.viabilityState !== "Irreversible rupture"
          ? drawTrajectory(ctx, project, frames, frameIndex, params, compact)
          : [];
        if (frame.viabilityState !== "Irreversible rupture") drawCurrentMarker(ctx, project, frame, params, compact);
      }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [compact, frame, frameIndex, frames, motionPaused, pan, params, pitch, playing, reducedMotion, showTrajectory, showTube, view2d, wireframe, yaw, zoom]);

  const resetView = () => {
    setYaw(-0.58);
    setPitch(0.93);
    setZoom(compact ? 0.78 : 1);
    setPan({ x: 0, y: compact ? 4 : 12 });
    spinRef.current = 0;
  };

  return (
    <div
      className={`torus-wrap ${compact ? "compact-torus" : ""}`}
      ref={wrapRef}
      onPointerDown={(event) => {
        if (view2d) return;
        drag.current = { x: event.clientX, y: event.clientY, pan: event.shiftKey || event.button === 1 };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current || view2d) return;
        const dx = event.clientX - drag.current.x;
        const dy = event.clientY - drag.current.y;
        if (drag.current.pan) setPan((value) => ({ x: value.x + dx, y: value.y + dy }));
        else {
          setYaw((value) => value + dx * 0.008);
          setPitch((value) => Math.max(0.18, Math.min(1.48, value + dy * 0.006)));
        }
        drag.current = { ...drag.current, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const canvas = canvasRef.current;
        if (canvas && drag.current && Math.abs(event.movementX) < 4 && Math.abs(event.movementY) < 4) {
          const rect = canvas.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const closest = trajectoryPoints.current.reduce<{ index: number; distance: number } | null>((best, point) => {
            const distance = Math.hypot(point.x - x, point.y - y);
            return !best || distance < best.distance ? { index: point.index, distance } : best;
          }, null);
          if (closest && closest.distance < 18) onSelectFrame(closest.index);
        }
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onWheel={(event) => {
        event.preventDefault();
        setZoom((value) => Math.max(0.55, Math.min(1.8, value - event.deltaY * 0.001)));
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        data-chart-kind="torus"
        data-offscale={excursion.offScale ? "true" : "false"}
        aria-label={`Interactive synthetic torus embedding, currently ${geometryState}. Current toy alignment proxy A equals e to the minus rho is ${Math.round((frame?.alignment ?? 0) * 100)} percent, radial excursion ${(frame?.rho ?? 0).toFixed(2)}, debt ${(frame?.debt ?? 0).toFixed(2)}${excursion.offScale ? `; excursion is off the display scale at ${excursion.ratio.toFixed(1)} times the critical radius` : ""}. Shape deformation is an illustrative view of phase-local imbalance, not a directly simulated Equation 34 field. ${phaseReady ? `Offline full-run phase regime ${frame?.phaseRegime ?? "not available"}; external phase ${frame?.phaseIdentifiable ? "identifiable" : "not identifiable"}` : "Offline phase analysis is available after the full run"}.`}
      />
      {!compact && (
        <>
          <div className="torus-legend legend-minor"><strong>Minor cycle (θ)</strong><span>{"Propose → verify → correct"}</span></div>
          <div className="torus-legend legend-major"><strong>Major cycle (simulated φ)</strong><span>{"Observe → adapt → govern"}</span></div>
          <div className="torus-legend legend-tube"><strong>Viable tube</strong><span>illustrative ρ &lt; ρcrit band</span></div>
          <div className="torus-legend legend-warning"><strong>Warning zone</strong><span>high radial excursion</span></div>
          {showLabels && <div className="axis-labels" aria-hidden="true"><span className="axis-x">x</span><span className="axis-y">y</span><span className="axis-z">z</span></div>}
          {frame?.viabilityState === "Irreversible rupture" && <div className="terminal-rupture-label"><strong>Terminal rupture</strong><span>Modeled recurrence has been lost</span></div>}
          <div className="torus-mode-badge"><span className="live-dot" />{geometryState}</div>
        </>
      )}
      <div className="torus-toolbar" role="toolbar" aria-label="Torus view controls">
        {!compact && <button onClick={() => setMotionPaused((v) => !v)} aria-pressed={motionPaused}>{motionPaused ? "Animate" : "Pause motion"}</button>}
        <button onClick={() => setView2d((v) => !v)} aria-pressed={view2d}>{view2d ? "3D" : "2D"}</button>
        {!compact && <button onClick={() => setShowLabels((v) => !v)} aria-pressed={showLabels}>Labels</button>}
        {!compact && <button onClick={() => setShowTrajectory((v) => !v)} aria-pressed={showTrajectory}>Path</button>}
        {!compact && <button onClick={() => setShowTube((v) => !v)} aria-pressed={showTube}>Tube</button>}
        <button onClick={() => setWireframe((v) => !v)} aria-pressed={wireframe}>Wire</button>
        <button onClick={resetView}>Reset</button>
        {!compact && <button onClick={() => wrapRef.current?.requestFullscreen?.()}>Full</button>}
      </div>
      {!compact && <div className="torus-help">Drag to rotate · Shift-drag to pan · Select the trajectory · Shape warp illustrates Eq. 34; phase-local D, C, and Δ fields are not simulated</div>}
    </div>
  );
}

function rotatePoint(theta: number, phi: number, radial = 0, debt = 0): Point3 {
  const major = 2.18;
  const minor = 0.72 + radial * 0.16;
  const localWarp = debt * 0.06 * Math.max(0, Math.sin(phi * 2.5 + 0.5));
  const r = minor + localWarp;
  return {
    x: (major + r * Math.cos(theta)) * Math.cos(phi),
    y: r * Math.sin(theta),
    z: (major + r * Math.cos(theta)) * Math.sin(phi),
  };
}

function drawTorus(
  ctx: CanvasRenderingContext2D,
  project: (point: Point3) => Point2,
  frame: SimulationFrame,
  params: SimulationParameters,
  wireframe: boolean,
  showTube: boolean,
  compact: boolean,
  now: number,
  reducedMotion: boolean,
) {
  const uCount = compact ? 28 : 42;
  const vCount = compact ? 13 : 19;
  const severity = Math.min(1.25, frame.rho / params.rhoCrit);
  const visualDebt = displayDebt(frame.debt);
  const terminal = frame.viabilityState === "Irreversible rupture";
  const ruptureProgress = terminal ? Math.max(0.32, frame.ruptureProgress) : 0;
  const quads: { points: Point2[]; depth: number; u: number; v: number }[] = [];
  for (let u = 0; u < uCount; u += 1) {
    for (let v = 0; v < vCount; v += 1) {
      const u0 = (u / uCount) * TAU;
      const u1 = ((u + 1) / uCount) * TAU;
      const v0 = (v / vCount) * TAU;
      const v1 = ((v + 1) / vCount) * TAU;
      const deform = severity * (0.15 + Math.max(0, Math.cos(u0 - 0.1)) * 0.35);
      const p = [
        project(rotatePoint(v0, u0, deform, visualDebt)),
        project(rotatePoint(v0, u1, deform, visualDebt)),
        project(rotatePoint(v1, u1, deform, visualDebt)),
        project(rotatePoint(v1, u0, deform, visualDebt)),
      ];
      quads.push({ points: p, depth: p.reduce((sum, point) => sum + point.z, 0) / 4, u, v });
    }
  }
  quads.sort((a, b) => a.depth - b.depth);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const quad of quads) {
    const fragmentNoise = ruptureHash(quad.u * 101 + quad.v * 313);
    if (terminal && fragmentNoise < 0.12 + ruptureProgress * 0.7) continue;
    const phase = quad.u / uCount;
    const tube = quad.v / vCount;
    const red = Math.round(36 + phase * 215 + severity * 26);
    const green = Math.round(98 + Math.sin(tube * Math.PI) * 28 - phase * 32);
    const blue = Math.round(244 - phase * 104);
    ctx.beginPath();
    quad.points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
    ctx.closePath();
    if (!wireframe) {
      const alpha = (0.09 + (quad.depth + 3.2) * 0.026) * (terminal ? 0.56 : 1);
      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${Math.max(0.07, Math.min(0.32, alpha))})`;
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(${red}, ${green + 28}, 255, ${wireframe ? 0.48 : 0.25})`;
    ctx.lineWidth = wireframe ? 0.85 : 0.45;
    ctx.stroke();
  }
  if (showTube && !terminal) {
    ctx.strokeStyle = "rgba(117, 110, 255, .42)";
    ctx.lineWidth = compact ? 7 : 12;
    ctx.shadowColor = "rgba(102, 76, 255, .45)";
    ctx.shadowBlur = 16;
    for (let band = -1; band <= 1; band += 2) {
      ctx.beginPath();
      for (let i = 0; i <= 100; i += 1) {
        const phi = (i / 100) * TAU;
        const point = project(rotatePoint(Math.PI / 2 + band * 0.42, phi, 0.08, visualDebt));
        if (i) ctx.lineTo(point.x, point.y);
        else ctx.moveTo(point.x, point.y);
      }
      ctx.stroke();
    }
  }
  if (terminal) {
    drawRuptureParticles(ctx, project, frame, params, compact, now, reducedMotion);
  } else {
    ctx.strokeStyle = "rgba(255, 77, 62, .72)";
    ctx.lineWidth = compact ? 3 : 5;
    ctx.shadowColor = "#ff3f36";
    ctx.shadowBlur = 13;
    ctx.beginPath();
    for (let i = 0; i <= 22; i += 1) {
      const phi = -0.42 + (i / 22) * 0.7;
      const point = project(rotatePoint(Math.PI * 0.16, phi, severity * 0.5 + 0.14, visualDebt));
      if (i) ctx.lineTo(point.x, point.y);
      else ctx.moveTo(point.x, point.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRuptureParticles(
  ctx: CanvasRenderingContext2D,
  project: (point: Point3) => Point2,
  frame: SimulationFrame,
  params: SimulationParameters,
  compact: boolean,
  now: number,
  reducedMotion: boolean,
) {
  const particleCount = compact ? 280 : 620;
  const progress = Math.max(0.32, frame.ruptureProgress);
  const time = reducedMotion ? 0 : now * 0.00016;
  const visualDebt = displayDebt(frame.debt);
  const severity = Math.min(1.4, frame.rho / Math.max(params.rhoCrit, Number.EPSILON));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let index = 0; index < particleCount; index += 1) {
    const phi = ruptureHash(index * 17 + 5) * TAU;
    const theta = ruptureHash(index * 29 + 11) * TAU;
    const base = rotatePoint(theta, phi, severity * 0.22, visualDebt);
    const radialLength = Math.max(0.001, Math.hypot(base.x, base.y, base.z));
    const speed = 0.28 + ruptureHash(index * 47 + 19) * 1.42;
    const drift = (0.18 + progress * 1.15) * speed;
    const flutter = Math.sin(time * (0.7 + speed) + index) * (reducedMotion ? 0 : 0.035);
    const point = project({
      x: base.x + (base.x / radialLength) * drift + flutter,
      y: base.y + (base.y / radialLength) * drift + (ruptureHash(index * 71) - 0.5) * progress * 0.7,
      z: base.z + (base.z / radialLength) * drift - flutter,
    });
    const phase = phi / TAU;
    const hot = ruptureHash(index * 89 + 7) > 0.64;
    const color = hot
      ? [255, 73 + Math.round(phase * 82), 55]
      : phase < 0.48
        ? [48, 178, 255]
        : [155, 82, 255];
    const alpha = 0.24 + ruptureHash(index * 97 + 23) * 0.68;
    const radius = (compact ? 0.7 : 0.9) + ruptureHash(index * 53 + 31) * (compact ? 1.35 : 2.15);
    ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
    ctx.shadowColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.shadowBlur = hot ? 7 : 4;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function ruptureHash(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  project: (point: Point3) => Point2,
  frames: SimulationFrame[],
  frameIndex: number,
  params: SimulationParameters,
  compact: boolean,
) {
  const points: { index: number; x: number; y: number }[] = [];
  const end = Math.min(frameIndex, frames.length - 1);
  const start = Math.max(0, end - (compact ? 180 : 420));
  const stride = Math.max(1, Math.floor((end - start) / (compact ? 120 : 260)));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  let previous: Point2 | null = null;
  for (let index = start; index <= end; index += stride) {
    const frame = frames[index];
    const point = project(rotatePoint(frame.theta, frame.phi, displayExcursion(frame.rho, params.rhoCrit).plottedRatio, displayDebt(frame.debt)));
    points.push({ index, x: point.x, y: point.y });
    if (previous) {
      const age = (index - start) / Math.max(1, end - start);
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = age > 0.72 ? "rgba(255, 219, 83, .96)" : `rgba(70, ${170 + Math.round(age * 70)}, 255, ${0.35 + age * 0.6})`;
      ctx.lineWidth = compact ? 1.3 : 2.2;
      ctx.shadowColor = age > 0.72 ? "#ff8b4a" : "#38c8ff";
      ctx.shadowBlur = compact ? 4 : 8;
      ctx.stroke();
    }
    previous = point;
  }
  ctx.restore();
  return points;
}

function drawCurrentMarker(ctx: CanvasRenderingContext2D, project: (point: Point3) => Point2, frame: SimulationFrame, params: SimulationParameters, compact: boolean) {
  const excursion = displayExcursion(frame.rho, params.rhoCrit);
  const point = project(rotatePoint(frame.theta, frame.phi, excursion.plottedRatio, displayDebt(frame.debt)));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = frame.status === "Ruptured" ? "#ff443c" : "#fff7b0";
  ctx.shadowColor = frame.status === "Ruptured" ? "#ff443c" : "#ffcc4d";
  ctx.shadowBlur = compact ? 10 : 20;
  ctx.beginPath();
  ctx.arc(point.x, point.y, compact ? 3.5 : 5.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(point.x, point.y, compact ? 7 : 11, 0, TAU);
  ctx.stroke();
  if (excursion.offScale) {
    ctx.font = `${compact ? 9 : 11}px ui-monospace`;
    ctx.fillStyle = "#ff8268";
    ctx.shadowBlur = 5;
    ctx.fillText(`OFF-SCALE ρ ${excursion.ratio.toFixed(1)}×ρcrit`, point.x + 12, point.y - 10);
  }
  ctx.restore();
}

function drawUnwrapped(ctx: CanvasRenderingContext2D, width: number, height: number, frames: SimulationFrame[], frameIndex: number, params: SimulationParameters) {
  const margin = { x: width * 0.1, y: height * 0.14 };
  const chartW = width - margin.x * 2;
  const chartH = height - margin.y * 2;
  const gradient = ctx.createLinearGradient(margin.x, 0, margin.x + chartW, chartH);
  gradient.addColorStop(0, "rgba(16, 88, 202, .24)");
  gradient.addColorStop(0.5, "rgba(94, 47, 191, .2)");
  gradient.addColorStop(1, "rgba(255, 78, 47, .25)");
  ctx.fillStyle = gradient;
  ctx.fillRect(margin.x, margin.y, chartW, chartH);
  ctx.strokeStyle = "rgba(124, 166, 222, .16)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    const x = margin.x + (chartW * i) / 8;
    const y = margin.y + (chartH * i) / 8;
    ctx.beginPath(); ctx.moveTo(x, margin.y); ctx.lineTo(x, margin.y + chartH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(margin.x, y); ctx.lineTo(margin.x + chartW, y); ctx.stroke();
  }
  const end = Math.min(frameIndex, frames.length - 1);
  const start = Math.max(0, end - 500);
  let previous: { x: number; y: number } | null = null;
  for (let index = start; index <= end; index += 2) {
    const frame = frames[index];
    const point = { x: margin.x + (frame.theta / TAU) * chartW, y: margin.y + chartH - (frame.phi / TAU) * chartH };
    if (previous && Math.abs(point.x - previous.x) < chartW * 0.6 && Math.abs(point.y - previous.y) < chartH * 0.6) {
      ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = frame.rho > params.rhoCrit * 0.7 ? "rgba(255,85,61,.9)" : "rgba(185,228,255,.88)";
      ctx.lineWidth = 1.7; ctx.stroke();
    }
    previous = point;
  }
  const current = frames[end];
  if (current) {
    const x = margin.x + (current.theta / TAU) * chartW;
    const y = margin.y + chartH - (current.phi / TAU) * chartH;
    ctx.fillStyle = "#fff2a8";
    ctx.shadowColor = "#ff9f4a";
    ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = "rgba(196,215,240,.8)";
  ctx.font = "11px ui-monospace";
  ctx.fillText("θ · local correction phase", margin.x, height - 12);
  ctx.save(); ctx.translate(14, margin.y + chartH); ctx.rotate(-Math.PI / 2); ctx.fillText("φ · simulated latent external phase", 0, 0); ctx.restore();
  ctx.fillStyle = "rgba(196,215,240,.52)";
  ctx.fillText("opposite edges identified", margin.x + 7, margin.y + 14);
}

function drawStarfield(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  for (let i = 0; i < 48; i += 1) {
    const x = ((i * 83.17) % 997) / 997 * width;
    const y = ((i * 51.73) % 811) / 811 * height;
    ctx.fillStyle = i % 9 === 0 ? "rgba(255,110,55,.35)" : "rgba(102,170,255,.25)";
    ctx.fillRect(x, y, i % 7 === 0 ? 1.5 : 0.8, i % 7 === 0 ? 1.5 : 0.8);
  }
  ctx.restore();
}
