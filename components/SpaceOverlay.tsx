"use client";

import { useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Space objects that fly OVER article text (very rare, pointer-events: none)
// Fixed canvas at z-20 (above content z-10, below header z-50)
// ---------------------------------------------------------------------------

interface OverlaySatellite {
  x: number;
  y: number;
  angle: number;
  speed: number;
  alpha: number;
  size: number;
}

interface OverlayAsteroid {
  x: number;
  y: number;
  angle: number;
  speed: number;
  alpha: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  vertices: number[];
}

interface OverlayComet {
  x: number;
  y: number;
  angle: number;
  speed: number;
  life: number;
  maxLife: number;
  tailLength: number;
  headRadius: number;
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function SpaceOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    let elapsedMs = 0;
    const isMobile = () => width < 768;

    // Very rare spawns
    let satellites: OverlaySatellite[] = [];
    let nextSatTime = randRange(45000, 90000) * (isMobile() ? 2 : 1);

    let asteroids: OverlayAsteroid[] = [];
    let nextAstTime = randRange(60000, 120000) * (isMobile() ? 2 : 1);

    let comets: OverlayComet[] = [];
    let nextCometTime = randRange(240000, 360000) * (isMobile() ? 1.5 : 1);

    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width;
      canvas!.height = height;
    }

    window.addEventListener("resize", handleResize);

    let lastTimestamp = 0;

    function draw(timestamp: number) {
      const dt = lastTimestamp ? timestamp - lastTimestamp : 16.67;
      lastTimestamp = timestamp;
      elapsedMs += dt;

      ctx!.clearRect(0, 0, width, height);

      // Satellites
      if (elapsedMs >= nextSatTime) {
        const fromLeft = Math.random() > 0.5;
        satellites.push({
          x: fromLeft ? -20 : width + 20,
          y: randRange(height * 0.1, height * 0.6),
          angle: fromLeft ? randRange(-0.1, 0.1) : randRange(Math.PI - 0.1, Math.PI + 0.1),
          speed: randRange(0.6, 1.2),
          alpha: randRange(0.4, 0.6),
          size: randRange(3, 5),
        });
        nextSatTime = elapsedMs + randRange(45000, 90000) * (isMobile() ? 2 : 1);
      }

      for (let i = satellites.length - 1; i >= 0; i--) {
        const sat = satellites[i];
        sat.x += Math.cos(sat.angle) * sat.speed;
        sat.y += Math.sin(sat.angle) * sat.speed;

        ctx!.save();
        ctx!.translate(sat.x, sat.y);
        ctx!.globalAlpha = sat.alpha;
        ctx!.fillStyle = "#C0C0C0";
        ctx!.fillRect(-sat.size / 2, -sat.size / 2, sat.size, sat.size);
        const pw = sat.size * 1.8;
        const ph = sat.size * 0.5;
        ctx!.fillStyle = "#3B6BA5";
        ctx!.fillRect(-sat.size / 2 - pw, -ph / 2, pw, ph);
        ctx!.fillRect(sat.size / 2, -ph / 2, pw, ph);
        ctx!.globalAlpha = 1;
        ctx!.restore();

        if (sat.x < -60 || sat.x > width + 60 || sat.y < -60 || sat.y > height + 60) {
          satellites.splice(i, 1);
        }
      }

      // Asteroids
      if (elapsedMs >= nextAstTime) {
        const fromLeft = Math.random() > 0.5;
        const vCount = 5 + Math.floor(Math.random() * 3);
        const verts: number[] = [];
        for (let v = 0; v < vCount; v++) verts.push(0.6 + Math.random() * 0.4);
        asteroids.push({
          x: fromLeft ? -20 : width + 20,
          y: randRange(height * 0.15, height * 0.7),
          angle: fromLeft ? randRange(-0.2, 0.2) : randRange(Math.PI - 0.2, Math.PI + 0.2),
          speed: randRange(0.4, 1.0),
          alpha: randRange(0.4, 0.6),
          size: randRange(6, 14),
          rotation: 0,
          rotSpeed: randRange(-0.015, 0.015),
          vertices: verts,
        });
        nextAstTime = elapsedMs + randRange(60000, 120000) * (isMobile() ? 2 : 1);
      }

      for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        a.x += Math.cos(a.angle) * a.speed;
        a.y += Math.sin(a.angle) * a.speed;
        a.rotation += a.rotSpeed;

        ctx!.save();
        ctx!.translate(a.x, a.y);
        ctx!.rotate(a.rotation);
        ctx!.globalAlpha = a.alpha;
        ctx!.beginPath();
        for (let v = 0; v < a.vertices.length; v++) {
          const ang = (v / a.vertices.length) * Math.PI * 2;
          const r = a.size * a.vertices[v];
          if (v === 0) ctx!.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
          else ctx!.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx!.closePath();
        ctx!.fillStyle = "#8B8680";
        ctx!.fill();
        ctx!.globalAlpha = 1;
        ctx!.restore();

        if (a.x < -50 || a.x > width + 50 || a.y < -50 || a.y > height + 50) {
          asteroids.splice(i, 1);
        }
      }

      // Comets
      if (elapsedMs >= nextCometTime) {
        comets.push({
          x: width + 30,
          y: randRange(-30, height * 0.3),
          angle: randRange(Math.PI * 0.6, Math.PI * 0.8),
          speed: randRange(2.5, 4),
          life: 0,
          maxLife: randRange(240, 360),
          tailLength: randRange(120, 220),
          headRadius: randRange(2.5, 4),
        });
        nextCometTime = elapsedMs + randRange(240000, 360000) * (isMobile() ? 1.5 : 1);
      }

      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.x += Math.cos(c.angle) * c.speed;
        c.y += Math.sin(c.angle) * c.speed;
        c.life++;

        const progress = c.life / c.maxLife;
        const alpha = progress < 0.1 ? progress / 0.1 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
        const ca = alpha * 0.6;

        const tailX = c.x - Math.cos(c.angle) * c.tailLength;
        const tailY = c.y - Math.sin(c.angle) * c.tailLength;
        const grad = ctx!.createLinearGradient(tailX, tailY, c.x, c.y);
        grad.addColorStop(0, `rgba(180,220,255,0)`);
        grad.addColorStop(1, `rgba(230,245,255,${ca})`);
        ctx!.beginPath();
        ctx!.moveTo(tailX, tailY);
        ctx!.lineTo(c.x, c.y);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 3;
        ctx!.stroke();

        ctx!.beginPath();
        ctx!.arc(c.x, c.y, c.headRadius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,255,255,${ca})`;
        ctx!.fill();

        if (c.life >= c.maxLife || c.x < -250 || c.x > width + 250 || c.y > height + 250) {
          comets.splice(i, 1);
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    }

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const cleanup = setup();
    return () => { if (cleanup) cleanup(); };
  }, [setup]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 20 }}
      aria-hidden="true"
    />
  );
}
