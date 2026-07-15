"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SimulationFrame, SimulationParameters } from "@/engine/simulator";
import { evaluateAix } from "@/engine/simulator";
import type { RecurrentPhaseDefinition } from "@/contracts/types";
import {
  deriveTorusGeometry,
  displayExcursion,
  phaseAnalysisAvailable,
  phaseStageFor,
  radialDirectionFor,
  type TorusGeometryState,
} from "@/components/charts/visualizationMath";

type TorusCycles = {
  minor: RecurrentPhaseDefinition;
  major: RecurrentPhaseDefinition;
};

type Props = {
  frames: SimulationFrame[];
  frameIndex: number;
  params: SimulationParameters;
  playing: boolean;
  onSelectFrame: (index: number) => void;
  cycles?: TorusCycles;
  compact?: boolean;
};

type Point3 = { x: number; y: number; z: number };
type Point2 = { x: number; y: number; z: number };

const TAU = Math.PI * 2;
const fallbackCycles: TorusCycles = {
  minor: { label: "Local correction cycle", stages: ["Operate", "Check", "Correct"], description: "Local correction cycle", defaultFrequency: 0.09, phaseSource: "synthetic" },
  major: { label: "External adaptation cycle", stages: ["Observe", "Adapt", "Review"], description: "External adaptation cycle", defaultFrequency: 0.055, phaseSource: "synthetic" },
};

export function TorusCanvas({
  frames,
  frameIndex,
  params,
  playing,
  onSelectFrame,
  cycles = fallbackCycles,
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
  const phaseReady = phaseAnalysisAvailable(frameIndex, frames.length);
  const geometry = useMemo(
    () => deriveTorusGeometry(frames, frameIndex, params),
    [frameIndex, frames, params],
  );
  const minorStage = phaseStageFor(frame?.theta ?? 0, cycles.minor.stages);
  const majorStage = phaseStageFor(frame?.phi ?? 0, cycles.major.stages);
  const radialDirection = radialDirectionFor(frame?.radialVelocity ?? 0);
  const aix = useMemo(
    () => frame ? evaluateAix(frame, params) : undefined,
    [frame, params],
  );

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
        const centerY = height * (compact ? 0.5 : 0.34) + pan.y;
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

        drawTorus(ctx, project, frame, params, geometry, wireframe, showTube, compact, now, reducedMotion);
        trajectoryPoints.current = showTrajectory && frame.viabilityState !== "Irreversible rupture"
          ? drawTrajectory(ctx, project, frames, frameIndex, params, geometry, compact)
          : [];
        if (frame.viabilityState !== "Irreversible rupture") drawCurrentMarker(ctx, project, frame, params, geometry, compact);
      }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [compact, frame, frameIndex, frames, geometry, motionPaused, pan, params, pitch, playing, reducedMotion, showTrajectory, showTube, view2d, wireframe, yaw, zoom]);

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
        data-geometry-regime={geometry.regime}
        data-debt-warp={geometry.debtWarp.toFixed(3)}
        data-loss-scar={geometry.lossScar.toFixed(3)}
        data-recurrence-integrity={geometry.recurrenceIntegrity.toFixed(3)}
        aria-label={`Interactive synthetic torus embedding, geometry regime ${geometry.regimeLabel}. Selected state: theta ${(frame?.theta ?? 0).toFixed(2)} radians in ${minorStage.label}; simulated phi ${(frame?.phi ?? 0).toFixed(2)} radians in ${majorStage.label}; rho ${(frame?.rho ?? 0).toFixed(2)} with radial ${radialDirection.toLowerCase()}; debt ${(frame?.debt ?? 0).toFixed(2)}; cumulative irreversible loss ${geometry.cumulativeLoss.toFixed(3)}; viability ${frame?.viabilityState ?? "unknown"}; and illustrative AIx ${aix?.score.toFixed(1) ?? "unavailable"}, ${aix?.decision ?? "unavailable"}. Current toy alignment proxy A equals e to the minus rho is ${Math.round((frame?.alignment ?? 0) * 100)} percent, debt pressure chi delta ${geometry.debtPressure.toFixed(3)}, and recurrence ${geometry.recurrenceLabel.toLowerCase()}${excursion.offScale ? `; excursion is off the display scale at ${excursion.ratio.toFixed(1)} times the critical radius` : ""}. Excursion offsets the trajectory; debt produces a potentially repayable asymmetric warp; accumulated loss produces a persistent visual scar; terminal rupture removes the coherent torus. This is a model-linked visual encoding, not a uniquely derived Equation 34 deformation field. ${phaseReady ? `Offline full-run phase regime ${frame?.phaseRegime ?? "not available"}; external phase ${frame?.phaseIdentifiable ? "identifiable" : "not identifiable"}` : "Offline phase analysis is available after the full run"}.`}
      />
      {!compact && (
        <>
          <div className="torus-legend legend-minor"><strong>θ · {minorStage.label}</strong><span title={cycles.minor.label}>{cycles.minor.stages.join(" → ")}</span></div>
          <div className="torus-legend legend-major"><strong>simulated φ · {majorStage.label}</strong><span title={cycles.major.label}>{cycles.major.stages.join(" → ")}</span></div>
          {showLabels && <div className="axis-labels" aria-hidden="true"><span className="axis-x">x</span><span className="axis-y">y</span><span className="axis-z">z</span></div>}
          {frame?.viabilityState === "Irreversible rupture" && <div className="terminal-rupture-label"><strong>Terminal rupture</strong><span>Modeled recurrence has been lost</span></div>}
          <div className={`torus-mode-badge geometry-${geometry.regime}`}><span className="live-dot" />{geometry.regimeLabel}</div>
          <div className={`torus-state-inspector geometry-${geometry.regime} direction-${radialDirection.toLowerCase()}`} aria-label="Selected-point state inspector">
            <header><strong>Selected point · step {frame?.step ?? 0}</strong><span>{geometry.regimeLabel}</span></header>
            <dl>
              <div><dt>θ · local phase</dt><dd>{(frame?.theta ?? 0).toFixed(2)} rad</dd><small>{minorStage.label}</small></div>
              <div><dt>φ · simulated phase</dt><dd>{(frame?.phi ?? 0).toFixed(2)} rad</dd><small>{majorStage.label}</small></div>
              <div><dt>ρ · radial motion</dt><dd>{(frame?.rho ?? 0).toFixed(3)}</dd><small>{radialDirection} · dρ/dt={(frame?.radialVelocity ?? 0).toFixed(3)}</small></div>
              <div><dt>Memory</dt><dd>Δ {(frame?.debt ?? 0).toFixed(3)}</dd><small>ΣΛ {geometry.cumulativeLoss.toFixed(3)}</small></div>
              <div><dt>Viability</dt><dd>{frame?.viabilityState ?? "Unknown"}</dd><small>{geometry.recurrenceLabel} recurrence</small></div>
              <div><dt>AIx · illustrative</dt><dd>{aix?.score.toFixed(1) ?? "—"} · {aix?.decision ?? "—"}</dd><small>{aix?.riskTier ?? "unavailable"} risk tier</small></div>
            </dl>
          </div>
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
      {!compact && <div className="torus-help">Arrow shows live radial contraction / neutral balance / expansion · ρ offsets the path · Δ creates repayable warp · cumulative Λ leaves a persistent scar · collapse removes recurrence</div>}
    </div>
  );
}

function scarField(theta: number, phi: number) {
  const firstScar = Math.max(0, Math.cos(phi * 2.1 - 0.8)) ** 4
    * (0.35 + 0.65 * Math.max(0, Math.cos(theta + 0.9)));
  const secondScar = Math.max(0, Math.sin(phi * 3.2 + 1.1)) ** 5
    * (0.25 + 0.75 * Math.max(0, Math.sin(theta * 1.4 - 0.2)));
  return Math.min(1, firstScar + secondScar * 0.72);
}

function rotatePoint(theta: number, phi: number, radial: number, geometry: TorusGeometryState): Point3 {
  const scar = scarField(theta, phi) * geometry.lossScar;
  const debtLobe = geometry.debtWarp
    * (0.18 + 0.82 * Math.max(0, Math.sin(phi * 3 + 0.5)))
    * (0.42 + 0.58 * Math.max(0, Math.cos(theta - 0.15)));
  const historyRipple = geometry.regime === "hysteretic"
    ? geometry.lossScar * 0.055 * Math.sin(phi * 5 + theta * 1.7)
    : 0;
  const major = 2.18 + geometry.debtWarp * 0.08 * Math.sin(phi - 0.25) - scar * 0.045;
  const minor = 0.72 * geometry.tubeScale + radial * 0.16;
  const r = Math.max(0.24, minor + debtLobe + historyRipple - scar * 0.17);
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
  geometry: TorusGeometryState,
  wireframe: boolean,
  showTube: boolean,
  compact: boolean,
  now: number,
  reducedMotion: boolean,
) {
  const uCount = compact ? 28 : 42;
  const vCount = compact ? 13 : 19;
  const severity = Math.min(1.25, frame.rho / params.rhoCrit);
  const terminal = frame.viabilityState === "Irreversible rupture";
  const ruptureProgress = terminal ? Math.max(0.32, frame.ruptureProgress) : 0;
  const quads: { points: Point2[]; depth: number; u: number; v: number }[] = [];
  for (let u = 0; u < uCount; u += 1) {
    for (let v = 0; v < vCount; v += 1) {
      const u0 = (u / uCount) * TAU;
      const u1 = ((u + 1) / uCount) * TAU;
      const v0 = (v / vCount) * TAU;
      const v1 = ((v + 1) / vCount) * TAU;
      const p = [
        project(rotatePoint(v0, u0, 0, geometry)),
        project(rotatePoint(v0, u1, 0, geometry)),
        project(rotatePoint(v1, u1, 0, geometry)),
        project(rotatePoint(v1, u0, 0, geometry)),
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
    const localScar = scarField(tube * TAU, phase * TAU) * geometry.lossScar;
    const red = Math.max(0, Math.min(255, Math.round(36 + phase * 190 + geometry.debtSeverity * 48 + localScar * 86)));
    const green = Math.max(0, Math.min(255, Math.round(104 + Math.sin(tube * Math.PI) * 28 - phase * 24 - localScar * 72)));
    const blue = Math.max(0, Math.min(255, Math.round(244 - phase * 86 - geometry.lossScar * 52 - localScar * 90)));
    ctx.beginPath();
    quad.points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
    ctx.closePath();
    if (!wireframe) {
      const alpha = (0.09 + (quad.depth + 3.2) * 0.026) * (terminal ? 0.56 : 1) * (1 - localScar * 0.24);
      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${Math.max(0.07, Math.min(0.32, alpha))})`;
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(${red}, ${Math.min(255, green + 28)}, ${blue}, ${wireframe ? 0.48 : 0.25})`;
    ctx.lineWidth = wireframe ? 0.85 : 0.45;
    ctx.stroke();
  }
  if (showTube && !terminal) {
    ctx.strokeStyle = "rgba(117, 110, 255, .42)";
    ctx.lineWidth = (compact ? 7 : 12) * geometry.tubeScale;
    ctx.shadowColor = "rgba(102, 76, 255, .45)";
    ctx.shadowBlur = 16;
    for (let band = -1; band <= 1; band += 2) {
      ctx.beginPath();
      for (let i = 0; i <= 100; i += 1) {
        const phi = (i / 100) * TAU;
        const point = project(rotatePoint(Math.PI / 2 + band * 0.42, phi, 0.08, geometry));
        if (i) ctx.lineTo(point.x, point.y);
        else ctx.moveTo(point.x, point.y);
      }
      ctx.stroke();
    }
  }
  if (!terminal) drawIrreversibleScars(ctx, project, geometry, compact);
  if (terminal) {
    drawRuptureParticles(ctx, project, frame, params, geometry, compact, now, reducedMotion);
  } else {
    ctx.strokeStyle = "rgba(255, 77, 62, .72)";
    ctx.lineWidth = compact ? 3 : 5;
    ctx.shadowColor = "#ff3f36";
    ctx.shadowBlur = 13;
    ctx.beginPath();
    for (let i = 0; i <= 22; i += 1) {
      const phi = -0.42 + (i / 22) * 0.7;
      const point = project(rotatePoint(Math.PI * 0.16, phi, severity * 0.5 + 0.14, geometry));
      if (i) ctx.lineTo(point.x, point.y);
      else ctx.moveTo(point.x, point.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawIrreversibleScars(
  ctx: CanvasRenderingContext2D,
  project: (point: Point3) => Point2,
  geometry: TorusGeometryState,
  compact: boolean,
) {
  if (geometry.lossScar < 0.035) return;
  const scarCount = Math.max(1, Math.ceil(geometry.lossScar * (compact ? 2 : 4)));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";
  ctx.setLineDash(compact ? [2, 3] : [3, 4]);
  for (let scar = 0; scar < scarCount; scar += 1) {
    const centerPhi = 0.55 + scar * 1.47;
    ctx.beginPath();
    for (let pointIndex = 0; pointIndex <= 18; pointIndex += 1) {
      const offset = (pointIndex / 18 - 0.5) * (0.46 + geometry.lossScar * 0.32);
      const phi = centerPhi + offset;
      const theta = 0.45 + scar * 0.82 + Math.sin(pointIndex * 1.9 + scar) * 0.18;
      const point = project(rotatePoint(theta, phi, 0.035, geometry));
      if (pointIndex) ctx.lineTo(point.x, point.y);
      else ctx.moveTo(point.x, point.y);
    }
    const alpha = 0.24 + geometry.lossScar * 0.5;
    ctx.strokeStyle = scar % 2 ? `rgba(255, 82, 54, ${alpha})` : `rgba(255, 166, 53, ${alpha})`;
    ctx.lineWidth = (compact ? 0.8 : 1.2) + geometry.lossScar * 1.4;
    ctx.shadowColor = scar % 2 ? "#ff4d35" : "#ff9b35";
    ctx.shadowBlur = compact ? 3 : 6;
    ctx.stroke();
  }
  ctx.restore();
}

function drawRuptureParticles(
  ctx: CanvasRenderingContext2D,
  project: (point: Point3) => Point2,
  frame: SimulationFrame,
  params: SimulationParameters,
  geometry: TorusGeometryState,
  compact: boolean,
  now: number,
  reducedMotion: boolean,
) {
  const particleCount = compact ? 280 : 620;
  const progress = Math.max(0.32, frame.ruptureProgress);
  const time = reducedMotion ? 0 : now * 0.00016;
  const severity = Math.min(1.4, frame.rho / Math.max(params.rhoCrit, Number.EPSILON));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let index = 0; index < particleCount; index += 1) {
    const phi = ruptureHash(index * 17 + 5) * TAU;
    const theta = ruptureHash(index * 29 + 11) * TAU;
    const base = rotatePoint(theta, phi, severity * 0.22, geometry);
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
  geometry: TorusGeometryState,
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
    const point = project(rotatePoint(frame.theta, frame.phi, displayExcursion(frame.rho, params.rhoCrit).plottedRatio, geometry));
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

function drawCurrentMarker(ctx: CanvasRenderingContext2D, project: (point: Point3) => Point2, frame: SimulationFrame, params: SimulationParameters, geometry: TorusGeometryState, compact: boolean) {
  const excursion = displayExcursion(frame.rho, params.rhoCrit);
  const point = project(rotatePoint(frame.theta, frame.phi, excursion.plottedRatio, geometry));
  drawRadialDirectionArrow(ctx, project, point, frame, excursion.plottedRatio, geometry, compact);
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

function drawRadialDirectionArrow(
  ctx: CanvasRenderingContext2D,
  project: (point: Point3) => Point2,
  point: Point2,
  frame: SimulationFrame,
  plottedRatio: number,
  geometry: TorusGeometryState,
  compact: boolean,
) {
  const direction = radialDirectionFor(frame.radialVelocity);
  const color = direction === "Expansion" ? "#ff675d" : direction === "Contraction" ? "#6fe47b" : "#ffd268";
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = compact ? 5 : 9;
  ctx.lineWidth = compact ? 1.4 : 2;
  ctx.lineCap = "round";

  if (direction === "Neutral") {
    const inward = project(rotatePoint(frame.theta, frame.phi, Math.max(0, plottedRatio - 0.13), geometry));
    const outward = project(rotatePoint(frame.theta, frame.phi, plottedRatio + 0.13, geometry));
    ctx.beginPath();
    ctx.moveTo(inward.x, inward.y);
    ctx.lineTo(outward.x, outward.y);
    ctx.stroke();
    for (const cap of [inward, outward]) {
      ctx.beginPath();
      ctx.arc(cap.x, cap.y, compact ? 1.7 : 2.2, 0, TAU);
      ctx.fill();
    }
  } else {
    const radialStep = direction === "Expansion" ? 0.34 : -0.34;
    const end = project(rotatePoint(frame.theta, frame.phi, Math.max(0, plottedRatio + radialStep), geometry));
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    const angle = Math.atan2(end.y - point.y, end.x - point.x);
    const head = compact ? 5 : 7;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - Math.cos(angle - 0.55) * head, end.y - Math.sin(angle - 0.55) * head);
    ctx.lineTo(end.x - Math.cos(angle + 0.55) * head, end.y - Math.sin(angle + 0.55) * head);
    ctx.closePath();
    ctx.fill();
  }

  if (!compact) {
    ctx.shadowBlur = 4;
    ctx.font = "8px ui-monospace";
    ctx.fillText(direction.toUpperCase(), point.x + 12, point.y + 18);
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
