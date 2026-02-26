"use client";

import { useEffect, useRef, useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanetConfig {
  name: string;
  color: string;
  radius: number;
  orbitRadius: number;
  speed: number;
  startAngle: number;
  hasMoon?: boolean;
  hasRings?: boolean;
}

interface SolarSystemProps {
  highlightPlanet?: string;
  className?: string;
  interactive?: boolean;
}

interface TooltipData {
  name: string;
  fact: string;
  distance: string;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Planet configurations
// ---------------------------------------------------------------------------

const PLANETS: PlanetConfig[] = [
  { name: "mercury", color: "#B5B5B5", radius: 2.8, orbitRadius: 45, speed: 0.025, startAngle: Math.random() * Math.PI * 2 },
  { name: "venus", color: "#E8CDA0", radius: 3.5, orbitRadius: 70, speed: 0.018, startAngle: Math.random() * Math.PI * 2 },
  { name: "earth", color: "#4A90D9", radius: 4.2, orbitRadius: 100, speed: 0.012, startAngle: Math.random() * Math.PI * 2, hasMoon: true },
  { name: "mars", color: "#C1440E", radius: 3.5, orbitRadius: 135, speed: 0.009, startAngle: Math.random() * Math.PI * 2 },
  { name: "jupiter", color: "#C88B3A", radius: 7, orbitRadius: 185, speed: 0.005, startAngle: Math.random() * Math.PI * 2 },
  { name: "saturn", color: "#E8D191", radius: 6.3, orbitRadius: 230, speed: 0.003, startAngle: Math.random() * Math.PI * 2, hasRings: true },
  { name: "uranus", color: "#7DD3D1", radius: 5, orbitRadius: 280, speed: 0.002, startAngle: Math.random() * Math.PI * 2, hasRings: true },
  { name: "neptune", color: "#5B7FFF", radius: 4.8, orbitRadius: 330, speed: 0.0015, startAngle: Math.random() * Math.PI * 2 },
];

const PLANET_INFO: Record<string, { distance: string; fact: string }> = {
  mercury: { distance: "57.9M km", fact: "A day is longer than its year!" },
  venus: { distance: "108.2M km", fact: "Hottest planet — 465°C surface!" },
  earth: { distance: "149.6M km", fact: "Only known planet with life." },
  mars: { distance: "227.9M km", fact: "Has the tallest volcano — Olympus Mons." },
  jupiter: { distance: "778.5M km", fact: "Could fit 1,300 Earths inside!" },
  saturn: { distance: "1.43B km", fact: "Its rings are mostly ice particles." },
  uranus: { distance: "2.87B km", fact: "Rotates on its side — 98° tilt!" },
  neptune: { distance: "4.50B km", fact: "Winds reach 2,100 km/h!" },
  sun: { distance: "0 km", fact: "99.86% of the solar system's mass." },
};

const MOON_COLOR = "#CCCCCC";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SolarSystem({
  highlightPlanet,
  className,
  interactive = false,
}: SolarSystemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const planetPositionsRef = useRef<Map<string, { x: number; y: number; r: number }>>(new Map());
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = canvas.parentElement?.clientWidth ?? window.innerWidth;
    let height = canvas.parentElement?.clientHeight ?? window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = canvas!.parentElement?.clientWidth ?? window.innerWidth;
      height = canvas!.parentElement?.clientHeight ?? window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    const isMobile = () => width < 768;

    function getActivePlanets(): PlanetConfig[] {
      if (isMobile()) return PLANETS.slice(0, 5);
      return PLANETS;
    }

    const angles = PLANETS.map((p) => p.startAngle);

    window.addEventListener("resize", resize);

    function drawSun(cx: number, cy: number, time: number) {
      const sunRadius = isMobile() ? 6 : 8;
      const isHighlighted = highlightPlanet?.toLowerCase() === "sun";
      const glowRadius = sunRadius * (isHighlighted ? 5 : 3);
      const glow = ctx!.createRadialGradient(cx, cy, sunRadius * 0.5, cx, cy, glowRadius);
      const pulseAlpha = isHighlighted ? 0.15 + 0.08 * Math.sin(time * 0.003) : 0.08;
      glow.addColorStop(0, `rgba(255, 215, 0, ${pulseAlpha})`);
      glow.addColorStop(0.5, `rgba(255, 180, 0, ${pulseAlpha * 0.4})`);
      glow.addColorStop(1, "rgba(255, 150, 0, 0)");
      ctx!.beginPath();
      ctx!.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx!.fillStyle = glow;
      ctx!.fill();

      const bodyGrad = ctx!.createRadialGradient(cx - sunRadius * 0.3, cy - sunRadius * 0.3, 0, cx, cy, sunRadius);
      const bodyAlpha = isHighlighted ? 0.9 : 0.6;
      bodyGrad.addColorStop(0, `rgba(255, 240, 180, ${bodyAlpha})`);
      bodyGrad.addColorStop(0.7, `rgba(255, 215, 0, ${bodyAlpha * 0.8})`);
      bodyGrad.addColorStop(1, `rgba(255, 160, 0, ${bodyAlpha * 0.5})`);
      ctx!.beginPath();
      ctx!.arc(cx, cy, sunRadius, 0, Math.PI * 2);
      ctx!.fillStyle = bodyGrad;
      ctx!.fill();

      // Track sun position for tooltips
      planetPositionsRef.current.set("sun", { x: cx, y: cy, r: sunRadius * 2 });
    }

    function drawOrbitPath(cx: number, cy: number, orbitR: number) {
      ctx!.beginPath();
      ctx!.arc(cx, cy, orbitR, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx!.lineWidth = 0.5;
      ctx!.stroke();
    }

    function drawPlanet(x: number, y: number, planet: PlanetConfig, time: number) {
      const isHighlighted = highlightPlanet?.toLowerCase() === planet.name;
      let alpha = isHighlighted ? 0.8 : 0.25;
      let r = planet.radius;

      if (isHighlighted) {
        const pulse = 0.15 * Math.sin(time * 0.004);
        alpha += pulse;
        r += pulse * 2;
        const hlGlow = ctx!.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
        hlGlow.addColorStop(0, planet.color + "40");
        hlGlow.addColorStop(1, planet.color + "00");
        ctx!.beginPath();
        ctx!.arc(x, y, r * 4, 0, Math.PI * 2);
        ctx!.fillStyle = hlGlow;
        ctx!.fill();
      }

      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fillStyle = planet.color;
      ctx!.globalAlpha = alpha;
      ctx!.fill();
      ctx!.globalAlpha = 1;

      // Track for tooltips
      planetPositionsRef.current.set(planet.name, { x, y, r: Math.max(r * 2, 15) });
    }

    function drawMoon(earthX: number, earthY: number, time: number) {
      const isHighlighted = highlightPlanet?.toLowerCase() === "moon";
      const moonOrbitR = isMobile() ? 8 : 12;
      const moonAngle = time * 0.04 * 0.06;
      const mx = earthX + Math.cos(moonAngle) * moonOrbitR;
      const my = earthY + Math.sin(moonAngle) * moonOrbitR;
      const moonR = 1.2;

      let alpha = isHighlighted ? 0.8 : 0.2;
      if (isHighlighted) {
        const pulse = 0.12 * Math.sin(time * 0.004);
        alpha += pulse;
        const hlGlow = ctx!.createRadialGradient(mx, my, moonR, mx, my, moonR * 5);
        hlGlow.addColorStop(0, MOON_COLOR + "40");
        hlGlow.addColorStop(1, MOON_COLOR + "00");
        ctx!.beginPath();
        ctx!.arc(mx, my, moonR * 5, 0, Math.PI * 2);
        ctx!.fillStyle = hlGlow;
        ctx!.fill();
      }

      ctx!.beginPath();
      ctx!.arc(mx, my, moonR, 0, Math.PI * 2);
      ctx!.fillStyle = MOON_COLOR;
      ctx!.globalAlpha = alpha;
      ctx!.fill();
      ctx!.globalAlpha = 1;
    }

    function drawSaturnRings(x: number, y: number, planet: PlanetConfig, angle: number) {
      const isHighlighted = highlightPlanet?.toLowerCase() === planet.name;
      const alpha = isHighlighted ? 0.5 : 0.15;
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(angle * 0.1 + 0.3);
      ctx!.scale(1, 0.35);
      ctx!.beginPath();
      ctx!.arc(0, 0, planet.radius + 3, 0, Math.PI * 2);
      ctx!.strokeStyle = planet.color;
      ctx!.globalAlpha = alpha;
      ctx!.lineWidth = 1.2;
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(0, 0, planet.radius + 5, 0, Math.PI * 2);
      ctx!.strokeStyle = planet.color;
      ctx!.globalAlpha = alpha * 0.6;
      ctx!.lineWidth = 0.8;
      ctx!.stroke();
      ctx!.globalAlpha = 1;
      ctx!.restore();
    }

    let lastTimestamp = 0;

    function draw(timestamp: number) {
      const dt = lastTimestamp ? timestamp - lastTimestamp : 16.67;
      lastTimestamp = timestamp;
      ctx!.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const minDim = Math.min(width, height);
      const scale = minDim / (isMobile() ? 350 : 700);

      const activePlanets = getActivePlanets();
      for (const planet of activePlanets) {
        drawOrbitPath(cx, cy, planet.orbitRadius * scale);
      }

      drawSun(cx, cy, timestamp);

      for (let i = 0; i < activePlanets.length; i++) {
        const planet = activePlanets[i];
        const globalIdx = PLANETS.indexOf(planet);
        if (!prefersReducedMotion) {
          angles[globalIdx] += planet.speed * (dt / 16.67);
        }
        const angle = angles[globalIdx];
        const orbitR = planet.orbitRadius * scale;
        const px = cx + Math.cos(angle) * orbitR;
        const py = cy + Math.sin(angle) * orbitR;

        if (planet.hasRings) drawSaturnRings(px, py, planet, angle);
        drawPlanet(px, py, planet, timestamp);
        if (planet.hasMoon) drawMoon(px, py, timestamp);
      }

      animationRef.current = requestAnimationFrame(draw);
    }

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [highlightPlanet]);

  useEffect(() => {
    const cleanup = setup();
    return () => { if (cleanup) cleanup(); };
  }, [setup]);

  // Click handler for interactive tooltips
  useEffect(() => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handleClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const clickX = (e.clientX - rect.left);
      const clickY = (e.clientY - rect.top);

      const result = { name: "", dist: Infinity, x: 0, y: 0 };

      planetPositionsRef.current.forEach((pos, name) => {
        const dx = clickX - pos.x;
        const dy = clickY - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < pos.r + 10 && dist < result.dist) {
          result.name = name;
          result.dist = dist;
          result.x = pos.x;
          result.y = pos.y;
        }
      });

      if (result.name) {
        const info = PLANET_INFO[result.name];
        if (info) {
          setTooltip({
            name: result.name.charAt(0).toUpperCase() + result.name.slice(1),
            fact: info.fact,
            distance: info.distance,
            x: result.x,
            y: result.y,
          });
          setTimeout(() => setTooltip(null), 4000);
        }
      } else {
        setTooltip(null);
      }
    }

    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [interactive]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className={className ?? ""}
        style={{ width: "100%", height: "100%", cursor: interactive ? "pointer" : "default" }}
        aria-hidden="true"
      />
      {interactive && tooltip && (
        <div
          className="absolute z-30 glass-card !rounded-lg p-3 pointer-events-none animate-[article-enter_0.3s_ease-out] max-w-[200px]"
          style={{
            left: Math.min(tooltip.x, (containerRef.current?.clientWidth ?? 300) - 220),
            top: tooltip.y + 20,
          }}
        >
          <p className="text-sm font-heading font-bold text-text-primary">{tooltip.name}</p>
          <p className="text-xs text-accent-cyan font-mono">{tooltip.distance} from Sun</p>
          <p className="text-xs text-text-secondary mt-1">{tooltip.fact}</p>
        </div>
      )}
    </div>
  );
}
