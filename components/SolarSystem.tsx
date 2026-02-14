"use client";

import { useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanetConfig {
  name: string;
  color: string;
  radius: number;
  orbitRadius: number;
  speed: number; // radians per frame at 60fps
  startAngle: number;
  hasMoon?: boolean;
  hasRings?: boolean;
}

interface SolarSystemProps {
  highlightPlanet?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Planet configurations
// ---------------------------------------------------------------------------

const PLANETS: PlanetConfig[] = [
  {
    name: "mercury",
    color: "#B5B5B5",
    radius: 2,
    orbitRadius: 45,
    speed: 0.025,
    startAngle: Math.random() * Math.PI * 2,
  },
  {
    name: "venus",
    color: "#E8CDA0",
    radius: 2.5,
    orbitRadius: 70,
    speed: 0.018,
    startAngle: Math.random() * Math.PI * 2,
  },
  {
    name: "earth",
    color: "#4A90D9",
    radius: 3,
    orbitRadius: 100,
    speed: 0.012,
    startAngle: Math.random() * Math.PI * 2,
    hasMoon: true,
  },
  {
    name: "mars",
    color: "#C1440E",
    radius: 2.5,
    orbitRadius: 135,
    speed: 0.009,
    startAngle: Math.random() * Math.PI * 2,
  },
  {
    name: "jupiter",
    color: "#C88B3A",
    radius: 5,
    orbitRadius: 185,
    speed: 0.005,
    startAngle: Math.random() * Math.PI * 2,
  },
  {
    name: "saturn",
    color: "#E8D191",
    radius: 4.5,
    orbitRadius: 230,
    speed: 0.003,
    startAngle: Math.random() * Math.PI * 2,
    hasRings: true,
  },
];

const MOON_COLOR = "#CCCCCC";
const SUN_COLOR = "#FFD700";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SolarSystem({
  highlightPlanet,
  className,
}: SolarSystemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // -----------------------------------------------------------------------
    // Preferences & sizing
    // -----------------------------------------------------------------------
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

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

    // On mobile, only show inner 4 planets for performance
    function getActivePlanets(): PlanetConfig[] {
      if (isMobile()) return PLANETS.slice(0, 4);
      return PLANETS;
    }

    // Mutable angle state per planet
    const angles = PLANETS.map((p) => p.startAngle);

    // -----------------------------------------------------------------------
    // Resize handler
    // -----------------------------------------------------------------------
    window.addEventListener("resize", resize);

    // -----------------------------------------------------------------------
    // Draw helpers
    // -----------------------------------------------------------------------

    function drawSun(cx: number, cy: number, time: number) {
      const sunRadius = isMobile() ? 6 : 8;
      const isHighlighted =
        highlightPlanet?.toLowerCase() === "sun";

      // Outer glow
      const glowRadius = sunRadius * (isHighlighted ? 5 : 3);
      const glow = ctx!.createRadialGradient(
        cx, cy, sunRadius * 0.5,
        cx, cy, glowRadius
      );
      const pulseAlpha = isHighlighted
        ? 0.15 + 0.08 * Math.sin(time * 0.003)
        : 0.08;
      glow.addColorStop(0, `rgba(255, 215, 0, ${pulseAlpha})`);
      glow.addColorStop(0.5, `rgba(255, 180, 0, ${pulseAlpha * 0.4})`);
      glow.addColorStop(1, "rgba(255, 150, 0, 0)");

      ctx!.beginPath();
      ctx!.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx!.fillStyle = glow;
      ctx!.fill();

      // Sun body
      const bodyGrad = ctx!.createRadialGradient(
        cx - sunRadius * 0.3, cy - sunRadius * 0.3, 0,
        cx, cy, sunRadius
      );
      const bodyAlpha = isHighlighted ? 0.9 : 0.6;
      bodyGrad.addColorStop(0, `rgba(255, 240, 180, ${bodyAlpha})`);
      bodyGrad.addColorStop(0.7, `rgba(255, 215, 0, ${bodyAlpha * 0.8})`);
      bodyGrad.addColorStop(1, `rgba(255, 160, 0, ${bodyAlpha * 0.5})`);

      ctx!.beginPath();
      ctx!.arc(cx, cy, sunRadius, 0, Math.PI * 2);
      ctx!.fillStyle = bodyGrad;
      ctx!.fill();
    }

    function drawOrbitPath(cx: number, cy: number, orbitR: number) {
      ctx!.beginPath();
      ctx!.arc(cx, cy, orbitR, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx!.lineWidth = 0.5;
      ctx!.stroke();
    }

    function drawPlanet(
      x: number,
      y: number,
      planet: PlanetConfig,
      time: number
    ) {
      const isHighlighted =
        highlightPlanet?.toLowerCase() === planet.name;

      let alpha = isHighlighted ? 0.8 : 0.25;
      let r = planet.radius;

      // Pulse effect for highlighted planet
      if (isHighlighted) {
        const pulse = 0.15 * Math.sin(time * 0.004);
        alpha += pulse;
        r += pulse * 2;

        // Highlight glow
        const hlGlow = ctx!.createRadialGradient(
          x, y, r * 0.5,
          x, y, r * 4
        );
        hlGlow.addColorStop(0, planet.color + "40");
        hlGlow.addColorStop(1, planet.color + "00");
        ctx!.beginPath();
        ctx!.arc(x, y, r * 4, 0, Math.PI * 2);
        ctx!.fillStyle = hlGlow;
        ctx!.fill();
      }

      // Planet body
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fillStyle = planet.color;
      ctx!.globalAlpha = alpha;
      ctx!.fill();
      ctx!.globalAlpha = 1;
    }

    function drawMoon(
      earthX: number,
      earthY: number,
      time: number
    ) {
      const isHighlighted =
        highlightPlanet?.toLowerCase() === "moon";

      const moonOrbitR = isMobile() ? 8 : 12;
      const moonSpeed = 0.04;
      const moonAngle = time * moonSpeed * 0.06;
      const mx = earthX + Math.cos(moonAngle) * moonOrbitR;
      const my = earthY + Math.sin(moonAngle) * moonOrbitR;
      const moonR = 1.2;

      let alpha = isHighlighted ? 0.8 : 0.2;
      if (isHighlighted) {
        const pulse = 0.12 * Math.sin(time * 0.004);
        alpha += pulse;

        // Moon highlight glow
        const hlGlow = ctx!.createRadialGradient(
          mx, my, moonR,
          mx, my, moonR * 5
        );
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

    function drawSaturnRings(
      x: number,
      y: number,
      planet: PlanetConfig,
      angle: number
    ) {
      const isHighlighted =
        highlightPlanet?.toLowerCase() === "saturn";
      const alpha = isHighlighted ? 0.5 : 0.15;

      ctx!.save();
      ctx!.translate(x, y);
      // Tilt the rings slightly based on orbital position
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

    // -----------------------------------------------------------------------
    // Main draw loop
    // -----------------------------------------------------------------------
    let lastTimestamp = 0;

    function draw(timestamp: number) {
      const dt = lastTimestamp ? timestamp - lastTimestamp : 16.67;
      lastTimestamp = timestamp;

      ctx!.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Scale orbit radii based on available space
      const minDim = Math.min(width, height);
      const scale = minDim / (isMobile() ? 350 : 550);

      // Draw orbit paths
      const activePlanets = getActivePlanets();
      for (const planet of activePlanets) {
        drawOrbitPath(cx, cy, planet.orbitRadius * scale);
      }

      // Draw sun
      drawSun(cx, cy, timestamp);

      // Update angles and draw planets
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

        // Draw Saturn rings behind the planet body
        if (planet.hasRings) {
          drawSaturnRings(px, py, planet, angle);
        }

        drawPlanet(px, py, planet, timestamp);

        // Draw Moon orbiting Earth
        if (planet.hasMoon) {
          drawMoon(px, py, timestamp);
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    }

    animationRef.current = requestAnimationFrame(draw);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [highlightPlanet]);

  useEffect(() => {
    const cleanup = setup();
    return () => {
      if (cleanup) cleanup();
    };
  }, [setup]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? ""}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}
