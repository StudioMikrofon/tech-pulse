"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  speed: number;
  twinkleSpeed: number;
  twinklePhase: number;
  tint: [number, number, number];
  drift: number;
}

interface ShootingStar {
  x: number;
  y: number;
  angle: number;
  speed: number;
  length: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface CodeColumn {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  trailLength: number;
  changeTimer: number;
}

interface DataParticle {
  x: number;
  y: number;
  alpha: number;
  speed: number;
  drift: number;
  radius: number;
}

interface Satellite {
  x: number;
  y: number;
  angle: number;
  speed: number;
  alpha: number;
  size: number;
  panelAngle: number;
}

interface Spacecraft {
  x: number;
  y: number;
  angle: number;
  speed: number;
  alpha: number;
  size: number;
}

interface Supernova {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxRadius: number;
}

interface Asteroid {
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

interface Comet {
  x: number;
  y: number;
  angle: number;
  speed: number;
  life: number;
  maxLife: number;
  tailLength: number;
  headRadius: number;
}

interface NebulaPulse {
  x: number;
  y: number;
  radius: number;
  phase: number;
  phaseSpeed: number;
  color: [number, number, number];
  cachedGrad: CanvasGradient | null;
  lastAlpha: number;
}

// Overlay objects (z-20 canvas)
interface OverlayObject {
  type: "satellite" | "asteroid" | "comet";
  x: number;
  y: number;
  angle: number;
  speed: number;
  alpha: number;
  size: number;
  rotation?: number;
  rotSpeed?: number;
  vertices?: number[];
  life?: number;
  maxLife?: number;
  tailLength?: number;
  headRadius?: number;
}

// Star Catcher game types
interface FallingStar {
  x: number;
  y: number;
  speed: number;
  size: number;
  active: boolean;
  type: "gold" | "blue" | "blackhole";
  pulse: number;
  pulseSpeed: number;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  active: boolean;
  color: string;
  size: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CODE_CHARS: string[] = [
  ..."0123456789ABCDEF".split(""),
  "\u2318", "\u2325", "\u21E7", "\u2303", "\u2630", "\u25C6", "\u25CF",
  "\u2587", "\u2591", "\u2593", "\u00AB", "\u00BB", "\u03BB", "\u03A3",
  "\u0394", "\u03C0", "\u221E", "\u2248", "\u2260", "\u2264", "\u2265",
];

function randomCodeChar(): string {
  return CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SpaceStage() {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const gameActiveRef = useRef(false);
  const [gameActive, setGameActive] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const scoreRef = useRef(0);
  const comboRef = useRef(1);
  const missedRef = useRef(0);
  const gameOverRef = useRef(false);

  const setup = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!bgCanvas || !overlayCanvas) return;
    const bgCtx = bgCanvas.getContext("2d", { alpha: true });
    const olCtx = overlayCanvas.getContext("2d", { alpha: true });
    if (!bgCtx || !olCtx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const isMobile = () => width < 768;

    // DPR cap per spec
    function getDpr() {
      const raw = window.devicePixelRatio || 1;
      return isMobile() ? Math.min(raw, 1.25) : Math.min(raw, 2);
    }

    let dpr = getDpr();

    function resizeCanvases() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = getDpr();

      bgCanvas!.width = width * dpr;
      bgCanvas!.height = height * dpr;
      bgCanvas!.style.width = width + "px";
      bgCanvas!.style.height = height + "px";
      bgCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      overlayCanvas!.width = width * dpr;
      overlayCanvas!.height = height * dpr;
      overlayCanvas!.style.width = width + "px";
      overlayCanvas!.style.height = height + "px";
      olCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeCanvases();

    // -----------------------------------------------------------------------
    // Adaptive quality
    // -----------------------------------------------------------------------
    const fpsSamples: number[] = [];
    const FPS_SAMPLE_COUNT = 60;
    let qualityScale = 1;

    function updateAdaptiveQuality(dt: number) {
      if (dt > 0) {
        fpsSamples.push(1000 / dt);
        if (fpsSamples.length > FPS_SAMPLE_COUNT) fpsSamples.shift();
      }
      if (fpsSamples.length === FPS_SAMPLE_COUNT) {
        const avg = fpsSamples.reduce((a, b) => a + b, 0) / FPS_SAMPLE_COUNT;
        if (avg < 35) qualityScale = Math.max(0.3, qualityScale - 0.06);
        else if (avg < 45) qualityScale = Math.max(0.5, qualityScale - 0.03);
        else if (avg > 55) qualityScale = Math.min(1, qualityScale + 0.01);
      }
    }

    // -----------------------------------------------------------------------
    // Star layers — OPTIMIZED: reduced counts
    // -----------------------------------------------------------------------
    const mobileFactor = () => (isMobile() ? 0.5 : 1);

    const layerConfigs = [
      { count: 140, minR: 0.3, maxR: 0.8, speed: 0.02 },
      { count: 80, minR: 0.6, maxR: 1.2, speed: 0.05 },
      { count: 35, minR: 1.0, maxR: 1.8, speed: 0.1 },
    ];

    function createStars(): Star[][] {
      const factor = mobileFactor() * qualityScale;
      return layerConfigs.map((cfg) => {
        const count = Math.round(cfg.count * factor);
        const stars: Star[] = [];
        for (let i = 0; i < count; i++) {
          let tint: [number, number, number] = [234, 240, 255];
          const r = Math.random();
          if (r < 0.08) tint = [180, 210, 255];
          else if (r < 0.15) tint = [190, 240, 255];

          stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: cfg.minR + Math.random() * (cfg.maxR - cfg.minR),
            baseAlpha: 0.3 + Math.random() * 0.7,
            speed: cfg.speed,
            twinkleSpeed: 0.005 + Math.random() * 0.02,
            twinklePhase: Math.random() * Math.PI * 2,
            tint,
            drift: (Math.random() - 0.5) * 0.4,
          });
        }
        return stars;
      });
    }

    let layers = createStars();

    // -----------------------------------------------------------------------
    // Shooting stars
    // -----------------------------------------------------------------------
    let shootingStars: ShootingStar[] = [];
    let nextShootingStarTime = 5000 + Math.random() * 10000;
    let elapsedMs = 0;

    function spawnShootingStar() {
      const fromTop = Math.random() > 0.5;
      const x = fromTop ? Math.random() * width : width + 10;
      const y = fromTop ? -10 : Math.random() * height * 0.5;
      const angle = fromTop
        ? Math.PI / 4 + (Math.random() - 0.5) * 0.4
        : Math.PI * 0.7 + (Math.random() - 0.5) * 0.3;

      shootingStars.push({
        x, y, angle,
        speed: 12 + Math.random() * 8,
        length: 80 + Math.random() * 60,
        alpha: 1,
        life: 0,
        maxLife: 60,
      });
    }

    // -----------------------------------------------------------------------
    // Code rain columns — OPTIMIZED: reduced count
    // -----------------------------------------------------------------------
    function createCodeColumns(): CodeColumn[] {
      if (isMobile() || prefersReducedMotion) return [];
      const colCount = Math.round((10 + Math.floor(Math.random() * 5)) * qualityScale);
      const cols: CodeColumn[] = [];
      for (let i = 0; i < colCount; i++) {
        const trailLength = 8 + Math.floor(Math.random() * 14);
        const chars: string[] = [];
        for (let j = 0; j < trailLength; j++) chars.push(randomCodeChar());
        cols.push({
          x: Math.random() * width,
          y: Math.random() * height,
          speed: 0.6 + Math.random() * 1.4,
          chars,
          trailLength,
          changeTimer: 0,
        });
      }
      return cols;
    }

    let codeColumns = createCodeColumns();

    // -----------------------------------------------------------------------
    // Data particles
    // -----------------------------------------------------------------------
    function createDataParticles(): DataParticle[] {
      if (prefersReducedMotion) return [];
      const count = Math.round((20 + Math.floor(Math.random() * 11)) * qualityScale);
      const particles: DataParticle[] = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          alpha: 0.08 + Math.random() * 0.15,
          speed: 0.2 + Math.random() * 0.5,
          drift: (Math.random() - 0.5) * 0.3,
          radius: 1 + Math.random() * 1.5,
        });
      }
      return particles;
    }

    let dataParticles = createDataParticles();

    // -----------------------------------------------------------------------
    // Nebula pulses — OPTIMIZED: cached gradients
    // -----------------------------------------------------------------------
    function createNebulaPulses(): NebulaPulse[] {
      if (prefersReducedMotion) return [];
      const count = 2 + Math.floor(Math.random() * 2);
      const pulses: NebulaPulse[] = [];
      const colors: [number, number, number][] = [
        [100, 80, 200], [60, 130, 200], [140, 60, 180],
      ];
      for (let i = 0; i < count; i++) {
        pulses.push({
          x: randRange(width * 0.1, width * 0.9),
          y: randRange(height * 0.1, height * 0.9),
          radius: randRange(150, 350),
          phase: Math.random() * Math.PI * 2,
          phaseSpeed: randRange(0.0003, 0.0008),
          color: colors[i % colors.length],
          cachedGrad: null,
          lastAlpha: -1,
        });
      }
      return pulses;
    }

    let nebulaPulses = createNebulaPulses();

    // -----------------------------------------------------------------------
    // Satellites
    // -----------------------------------------------------------------------
    let satellites: Satellite[] = [];
    let nextSatelliteTime = elapsedMs + randRange(15000, 30000) * (isMobile() ? 2 : 1);

    function spawnSatellite() {
      const fromLeft = Math.random() > 0.5;
      satellites.push({
        x: fromLeft ? -20 : width + 20,
        y: randRange(height * 0.05, height * 0.6),
        angle: fromLeft ? randRange(-0.15, 0.15) : randRange(Math.PI - 0.15, Math.PI + 0.15),
        speed: randRange(0.8, 1.5),
        alpha: randRange(0.3, 0.5),
        size: randRange(3, 5),
        panelAngle: 0,
      });
    }

    // -----------------------------------------------------------------------
    // Spacecraft
    // -----------------------------------------------------------------------
    let spacecraft: Spacecraft[] = [];
    let nextSpacecraftTime = elapsedMs + randRange(40000, 90000) * (isMobile() ? 2 : 1);

    function spawnSpacecraft() {
      const fromLeft = Math.random() > 0.5;
      spacecraft.push({
        x: fromLeft ? -15 : width + 15,
        y: randRange(height * 0.1, height * 0.5),
        angle: fromLeft ? randRange(-0.1, 0.2) : randRange(Math.PI - 0.2, Math.PI + 0.1),
        speed: randRange(1.2, 2.0),
        alpha: randRange(0.3, 0.5),
        size: randRange(4, 7),
      });
    }

    // -----------------------------------------------------------------------
    // Supernovas
    // -----------------------------------------------------------------------
    let supernovas: Supernova[] = [];
    let nextSupernovaTime = elapsedMs + randRange(30000, 60000) * (isMobile() ? 2 : 1);

    function spawnSupernova() {
      supernovas.push({
        x: randRange(50, width - 50),
        y: randRange(50, height - 50),
        life: 0,
        maxLife: randRange(120, 180),
        maxRadius: randRange(40, 80),
      });
    }

    // -----------------------------------------------------------------------
    // Asteroids
    // -----------------------------------------------------------------------
    let asteroids: Asteroid[] = [];
    let nextAsteroidTime = elapsedMs + randRange(20000, 45000) * (isMobile() ? 2 : 1);

    function spawnAsteroid() {
      const fromLeft = Math.random() > 0.5;
      const vertCount = 5 + Math.floor(Math.random() * 3);
      const vertices: number[] = [];
      for (let i = 0; i < vertCount; i++) {
        vertices.push(0.6 + Math.random() * 0.4);
      }
      asteroids.push({
        x: fromLeft ? -20 : width + 20,
        y: randRange(height * 0.1, height * 0.7),
        angle: fromLeft ? randRange(-0.3, 0.3) : randRange(Math.PI - 0.3, Math.PI + 0.3),
        speed: randRange(0.5, 1.2),
        alpha: randRange(0.3, 0.5),
        size: randRange(5, 12),
        rotation: 0,
        rotSpeed: randRange(-0.02, 0.02),
        vertices,
      });
    }

    // -----------------------------------------------------------------------
    // Comets
    // -----------------------------------------------------------------------
    let comets: Comet[] = [];
    let nextCometTime = elapsedMs + randRange(120000, 180000) * (isMobile() ? 1.5 : 1);

    function spawnComet() {
      comets.push({
        x: width + 30,
        y: randRange(-30, height * 0.3),
        angle: randRange(Math.PI * 0.6, Math.PI * 0.8),
        speed: randRange(3, 5),
        life: 0,
        maxLife: randRange(240, 360),
        tailLength: randRange(100, 200),
        headRadius: randRange(2.5, 4),
      });
    }

    // -----------------------------------------------------------------------
    // Overlay objects (z-20 canvas — rare, flies over content)
    // -----------------------------------------------------------------------
    let overlayObjects: OverlayObject[] = [];
    let nextOverlaySatTime = randRange(20000, 35000) * (isMobile() ? 2 : 1);
    let nextOverlayAstTime = randRange(50000, 90000) * (isMobile() ? 2 : 1);
    let nextOverlayCometTime = randRange(30000, 45000) * (isMobile() ? 1.5 : 1);

    function spawnOverlayObject(type: OverlayObject["type"]) {
      const fromLeft = Math.random() > 0.5;
      const base: OverlayObject = {
        type,
        x: fromLeft ? -20 : width + 20,
        y: randRange(height * 0.1, height * 0.6),
        angle: fromLeft ? randRange(-0.1, 0.1) : randRange(Math.PI - 0.1, Math.PI + 0.1),
        speed: randRange(0.6, 1.2),
        alpha: randRange(0.4, 0.6),
        size: randRange(3, 5),
      };

      if (type === "asteroid") {
        const vCount = 5 + Math.floor(Math.random() * 3);
        const verts: number[] = [];
        for (let v = 0; v < vCount; v++) verts.push(0.6 + Math.random() * 0.4);
        base.size = randRange(6, 14);
        base.speed = randRange(0.4, 1.0);
        base.rotation = 0;
        base.rotSpeed = randRange(-0.015, 0.015);
        base.vertices = verts;
        base.y = randRange(height * 0.15, height * 0.7);
      } else if (type === "comet") {
        base.x = width + 30;
        base.y = randRange(-30, height * 0.3);
        base.angle = randRange(Math.PI * 0.6, Math.PI * 0.8);
        base.speed = randRange(2.5, 4);
        base.life = 0;
        base.maxLife = randRange(240, 360);
        base.tailLength = randRange(120, 220);
        base.headRadius = randRange(2.5, 4);
      }

      overlayObjects.push(base);
    }

    // -----------------------------------------------------------------------
    // Star Catcher game: Object pools
    // -----------------------------------------------------------------------
    const starPool: FallingStar[] = [];
    for (let i = 0; i < 15; i++) starPool.push({ x: 0, y: -50, speed: 0, size: 0, active: false, type: "gold", pulse: 0, pulseSpeed: 0 });

    const sparklePool: SparkleParticle[] = [];
    for (let i = 0; i < 60; i++) sparklePool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, active: false, color: "#fff", size: 0 });

    let nextStarTime = 0;
    let gameElapsedMs = 0;
    let shakeTimer = 0;
    let shakeIntensity = 0;

    function spawnFallingStar() {
      const s = starPool.find((s) => !s.active);
      if (!s) return;

      const difficultyFactor = Math.min(scoreRef.current / 200, 3);

      s.x = randRange(40, width - 40);
      s.y = -30;
      s.speed = randRange(1.2, 2.0) + difficultyFactor * 0.3;
      s.size = randRange(14, 22);
      s.active = true;
      s.pulse = 0;
      s.pulseSpeed = randRange(0.05, 0.1);

      // Determine type
      const roll = Math.random();
      if (roll < 0.15) {
        s.type = "blackhole";
        s.size = randRange(18, 28);
        s.speed *= 0.8;
      } else if (roll < 0.22) {
        s.type = "blue";
        s.size = randRange(12, 18);
      } else {
        s.type = "gold";
      }
    }

    function spawnSparkles(x: number, y: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        const p = sparklePool.find((p) => !p.active);
        if (!p) break;
        const ang = Math.random() * Math.PI * 2;
        const spd = randRange(1.5, 5);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        p.life = randRange(25, 45);
        p.active = true;
        p.color = color;
        p.size = randRange(1.5, 3.5);
      }
    }

    // Pointer handler for Star Catcher
    function handlePointerUp(e: PointerEvent) {
      if (!gameActiveRef.current || gameOverRef.current) return;
      const rect = bgCanvas!.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      for (const s of starPool) {
        if (!s.active) continue;
        const dx = s.x - px;
        const dy = s.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < s.size + 15) {
          s.active = false;

          if (s.type === "blackhole") {
            // Penalty
            scoreRef.current = Math.max(0, scoreRef.current - 20);
            comboRef.current = 1;
            shakeTimer = 15;
            shakeIntensity = 6;
            spawnSparkles(s.x, s.y, "#6B21A8", 10);
          } else if (s.type === "blue") {
            // Power-up
            scoreRef.current += 50 * comboRef.current;
            comboRef.current = Math.min(comboRef.current + 1, 8);
            spawnSparkles(s.x, s.y, "#60A5FA", 15);
          } else {
            // Gold star
            scoreRef.current += 10 * comboRef.current;
            comboRef.current = Math.min(comboRef.current + 1, 8);
            spawnSparkles(s.x, s.y, "#FFD700", 12);
          }

          setScore(scoreRef.current);
          return; // Only catch one per click
        }
      }
    }

    bgCanvas!.addEventListener("pointerup", handlePointerUp);

    // -----------------------------------------------------------------------
    // Resize handler
    // -----------------------------------------------------------------------
    function handleResize() {
      resizeCanvases();
      layers = createStars();
      codeColumns = createCodeColumns();
      dataParticles = createDataParticles();
      nebulaPulses = createNebulaPulses();
    }

    window.addEventListener("resize", handleResize);

    // -----------------------------------------------------------------------
    // Page visibility
    // -----------------------------------------------------------------------
    function handleVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(animationRef.current);
      } else {
        lastTimestamp = 0;
        animationRef.current = requestAnimationFrame(draw);
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    // -----------------------------------------------------------------------
    // Draw helpers
    // -----------------------------------------------------------------------

    function drawSatelliteShape(ctx: CanvasRenderingContext2D, sat: { x: number; y: number; alpha: number; size: number }) {
      ctx.save();
      ctx.translate(sat.x, sat.y);
      ctx.globalAlpha = sat.alpha;
      ctx.fillStyle = "#C0C0C0";
      ctx.fillRect(-sat.size / 2, -sat.size / 2, sat.size, sat.size);
      const pw = sat.size * 1.8;
      const ph = sat.size * 0.5;
      ctx.fillStyle = "#3B6BA5";
      ctx.fillRect(-sat.size / 2 - pw, -ph / 2, pw, ph);
      ctx.fillRect(sat.size / 2, -ph / 2, pw, ph);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawAsteroidShape(ctx: CanvasRenderingContext2D, a: { x: number; y: number; alpha: number; size: number; rotation?: number; vertices?: number[] }) {
      ctx.save();
      ctx.translate(a.x, a.y);
      if (a.rotation !== undefined) ctx.rotate(a.rotation);
      ctx.globalAlpha = a.alpha;
      ctx.beginPath();
      const verts = a.vertices || [];
      for (let v = 0; v < verts.length; v++) {
        const ang = (v / verts.length) * Math.PI * 2;
        const r = a.size * verts[v];
        if (v === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
        else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fillStyle = "#8B8680";
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawCometShape(ctx: CanvasRenderingContext2D, c: { x: number; y: number; angle: number; life?: number; maxLife?: number; tailLength?: number; headRadius?: number }) {
      const progress = (c.life || 0) / (c.maxLife || 1);
      const alpha = progress < 0.1 ? progress / 0.1 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
      const ca = alpha * 0.6;
      const tLen = c.tailLength || 150;
      const hR = c.headRadius || 3;

      const tailX = c.x - Math.cos(c.angle) * tLen;
      const tailY = c.y - Math.sin(c.angle) * tLen;
      const grad = ctx.createLinearGradient(tailX, tailY, c.x, c.y);
      grad.addColorStop(0, `rgba(180,220,255,0)`);
      grad.addColorStop(1, `rgba(230,245,255,${ca})`);
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(c.x, c.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(c.x, c.y, hR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${ca})`;
      ctx.fill();
    }

    // -----------------------------------------------------------------------
    // Main draw loop
    // -----------------------------------------------------------------------
    const CHAR_SIZE = 14;
    let lastTimestamp = 0;

    function draw(timestamp: number) {
      const rawDt = lastTimestamp ? timestamp - lastTimestamp : 16.67;
      lastTimestamp = timestamp;

      const dtSec = clamp(rawDt / 1000, 0, 0.033);
      const factor = dtSec * 60;
      const dt = rawDt;

      elapsedMs += dt;

      // Adaptive quality update
      updateAdaptiveQuality(rawDt);

      // === BACKGROUND CANVAS =================================================
      // Screen shake for game
      if (shakeTimer > 0) {
        shakeTimer -= factor;
        const sx = (Math.random() - 0.5) * shakeIntensity;
        const sy = (Math.random() - 0.5) * shakeIntensity;
        bgCtx!.save();
        bgCtx!.translate(sx, sy);
      }

      bgCtx!.clearRect(-10, -10, width + 20, height + 20);

      // === Stars — OPTIMIZED: skip dim stars ================================
      for (const stars of layers) {
        for (const star of stars) {
          if (!prefersReducedMotion) {
            star.x += (star.speed * 0.3 + star.drift * 0.05) * factor;
            star.y -= star.speed * 0.1 * factor;
            star.twinklePhase += star.twinkleSpeed * factor;
            if (star.x > width) star.x = 0;
            if (star.x < 0) star.x = width;
            if (star.y < 0) star.y = height;
          }
          const twinkle = prefersReducedMotion
            ? star.baseAlpha
            : star.baseAlpha * (0.6 + 0.4 * Math.sin(star.twinklePhase));

          // Skip near-invisible stars
          if (twinkle < 0.08) continue;

          const [r, g, b] = star.tint;
          bgCtx!.beginPath();
          bgCtx!.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          bgCtx!.fillStyle = `rgba(${r},${g},${b},${twinkle})`;
          bgCtx!.fill();
        }
      }

      // === Nebula pulses — OPTIMIZED: cached gradients when alpha stable ====
      if (!prefersReducedMotion) {
        for (const np of nebulaPulses) {
          np.phase += np.phaseSpeed * dt;
          const alpha = 0.02 + 0.02 * Math.sin(np.phase);
          const alphaRounded = Math.round(alpha * 1000) / 1000;

          // Only recreate gradient if alpha changed
          if (np.cachedGrad === null || alphaRounded !== np.lastAlpha) {
            const [r, g, b] = np.color;
            const grad = bgCtx!.createRadialGradient(np.x, np.y, 0, np.x, np.y, np.radius);
            grad.addColorStop(0, `rgba(${r},${g},${b},${alphaRounded})`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            np.cachedGrad = grad;
            np.lastAlpha = alphaRounded;
          }

          bgCtx!.beginPath();
          bgCtx!.arc(np.x, np.y, np.radius, 0, Math.PI * 2);
          bgCtx!.fillStyle = np.cachedGrad;
          bgCtx!.fill();
        }
      }

      // === Shooting stars ====================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextShootingStarTime) {
          spawnShootingStar();
          nextShootingStarTime = elapsedMs + 5000 + Math.random() * 10000;
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const s = shootingStars[i];
          s.life += factor;
          s.x += Math.cos(s.angle) * s.speed * factor;
          s.y += Math.sin(s.angle) * s.speed * factor;
          const progress = s.life / s.maxLife;
          s.alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;

          const tailX = s.x - Math.cos(s.angle) * s.length;
          const tailY = s.y - Math.sin(s.angle) * s.length;
          const grad = bgCtx!.createLinearGradient(tailX, tailY, s.x, s.y);
          grad.addColorStop(0, `rgba(255,255,255,0)`);
          grad.addColorStop(1, `rgba(255,255,255,${s.alpha})`);
          bgCtx!.beginPath();
          bgCtx!.moveTo(tailX, tailY);
          bgCtx!.lineTo(s.x, s.y);
          bgCtx!.strokeStyle = grad;
          bgCtx!.lineWidth = 1.5;
          bgCtx!.stroke();

          bgCtx!.beginPath();
          bgCtx!.arc(s.x, s.y, 2, 0, Math.PI * 2);
          bgCtx!.fillStyle = `rgba(200,230,255,${s.alpha * 0.8})`;
          bgCtx!.fill();

          if (s.life >= s.maxLife || s.x < -200 || s.x > width + 200 || s.y > height + 200) {
            shootingStars.splice(i, 1);
          }
        }
      }

      // === Supernovas ========================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextSupernovaTime) {
          spawnSupernova();
          nextSupernovaTime = elapsedMs + randRange(30000, 60000) * (isMobile() ? 2 : 1);
        }

        for (let i = supernovas.length - 1; i >= 0; i--) {
          const sn = supernovas[i];
          sn.life += factor;
          const progress = sn.life / sn.maxLife;
          const currentR = sn.maxRadius * Math.min(progress * 2, 1);
          const alpha = progress < 0.3
            ? (progress / 0.3) * 0.15
            : 0.15 * (1 - (progress - 0.3) / 0.7);

          const grad = bgCtx!.createRadialGradient(sn.x, sn.y, 0, sn.x, sn.y, currentR);
          grad.addColorStop(0, `rgba(255,255,240,${alpha})`);
          grad.addColorStop(0.4, `rgba(200,220,255,${alpha * 0.5})`);
          grad.addColorStop(1, `rgba(150,180,255,0)`);
          bgCtx!.beginPath();
          bgCtx!.arc(sn.x, sn.y, currentR, 0, Math.PI * 2);
          bgCtx!.fillStyle = grad;
          bgCtx!.fill();

          if (sn.life >= sn.maxLife) supernovas.splice(i, 1);
        }
      }

      // === Asteroids =========================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextAsteroidTime) {
          spawnAsteroid();
          nextAsteroidTime = elapsedMs + randRange(20000, 45000) * (isMobile() ? 2 : 1);
        }

        for (let i = asteroids.length - 1; i >= 0; i--) {
          const a = asteroids[i];
          a.x += Math.cos(a.angle) * a.speed * factor;
          a.y += Math.sin(a.angle) * a.speed * factor;
          a.rotation += a.rotSpeed * factor;

          drawAsteroidShape(bgCtx!, a);

          if (a.x < -50 || a.x > width + 50 || a.y < -50 || a.y > height + 50) {
            asteroids.splice(i, 1);
          }
        }
      }

      // === Satellites ========================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextSatelliteTime) {
          spawnSatellite();
          nextSatelliteTime = elapsedMs + randRange(15000, 30000) * (isMobile() ? 2 : 1);
        }

        for (let i = satellites.length - 1; i >= 0; i--) {
          const sat = satellites[i];
          sat.x += Math.cos(sat.angle) * sat.speed * factor;
          sat.y += Math.sin(sat.angle) * sat.speed * factor;
          sat.panelAngle += 0.01 * factor;

          drawSatelliteShape(bgCtx!, sat);

          if (sat.x < -60 || sat.x > width + 60 || sat.y < -60 || sat.y > height + 60) {
            satellites.splice(i, 1);
          }
        }
      }

      // === Spacecraft ========================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextSpacecraftTime) {
          spawnSpacecraft();
          nextSpacecraftTime = elapsedMs + randRange(40000, 90000) * (isMobile() ? 2 : 1);
        }

        for (let i = spacecraft.length - 1; i >= 0; i--) {
          const sc = spacecraft[i];
          sc.x += Math.cos(sc.angle) * sc.speed * factor;
          sc.y += Math.sin(sc.angle) * sc.speed * factor;

          bgCtx!.save();
          bgCtx!.translate(sc.x, sc.y);
          bgCtx!.rotate(sc.angle);
          bgCtx!.globalAlpha = sc.alpha;
          bgCtx!.beginPath();
          bgCtx!.moveTo(sc.size, 0);
          bgCtx!.lineTo(-sc.size * 0.6, -sc.size * 0.4);
          bgCtx!.lineTo(-sc.size * 0.6, sc.size * 0.4);
          bgCtx!.closePath();
          bgCtx!.fillStyle = "#A0A8B0";
          bgCtx!.fill();
          bgCtx!.globalAlpha = 1;
          bgCtx!.restore();

          if (sc.x < -50 || sc.x > width + 50 || sc.y < -50 || sc.y > height + 50) {
            spacecraft.splice(i, 1);
          }
        }
      }

      // === Comets ============================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextCometTime) {
          spawnComet();
          nextCometTime = elapsedMs + randRange(120000, 180000) * (isMobile() ? 1.5 : 1);
        }

        for (let i = comets.length - 1; i >= 0; i--) {
          const c = comets[i];
          c.x += Math.cos(c.angle) * c.speed * factor;
          c.y += Math.sin(c.angle) * c.speed * factor;
          c.life += factor;

          const progress = c.life / c.maxLife;
          const alpha = progress < 0.1
            ? progress / 0.1
            : progress > 0.8
              ? (1 - progress) / 0.2
              : 1;
          const cometAlpha = alpha * 0.7;

          const tailX = c.x - Math.cos(c.angle) * c.tailLength;
          const tailY = c.y - Math.sin(c.angle) * c.tailLength;
          const grad = bgCtx!.createLinearGradient(tailX, tailY, c.x, c.y);
          grad.addColorStop(0, `rgba(180,220,255,0)`);
          grad.addColorStop(0.7, `rgba(200,235,255,${cometAlpha * 0.3})`);
          grad.addColorStop(1, `rgba(230,245,255,${cometAlpha})`);

          bgCtx!.beginPath();
          bgCtx!.moveTo(tailX, tailY);
          bgCtx!.lineTo(c.x, c.y);
          bgCtx!.strokeStyle = grad;
          bgCtx!.lineWidth = 3;
          bgCtx!.stroke();

          const headGrad = bgCtx!.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.headRadius * 4);
          headGrad.addColorStop(0, `rgba(255,255,255,${cometAlpha})`);
          headGrad.addColorStop(0.5, `rgba(200,230,255,${cometAlpha * 0.3})`);
          headGrad.addColorStop(1, `rgba(150,200,255,0)`);
          bgCtx!.beginPath();
          bgCtx!.arc(c.x, c.y, c.headRadius * 4, 0, Math.PI * 2);
          bgCtx!.fillStyle = headGrad;
          bgCtx!.fill();

          bgCtx!.beginPath();
          bgCtx!.arc(c.x, c.y, c.headRadius, 0, Math.PI * 2);
          bgCtx!.fillStyle = `rgba(255,255,255,${cometAlpha})`;
          bgCtx!.fill();

          if (c.life >= c.maxLife || c.x < -250 || c.x > width + 250 || c.y > height + 250) {
            comets.splice(i, 1);
          }
        }
      }

      // === Code rain =========================================================
      if (!prefersReducedMotion && !isMobile()) {
        bgCtx!.font = `${CHAR_SIZE}px "Courier New", monospace`;
        bgCtx!.textAlign = "center";

        for (const col of codeColumns) {
          col.y += col.speed * factor;
          col.changeTimer += dt;
          if (col.changeTimer > 200) {
            col.changeTimer = 0;
            const idx = Math.floor(Math.random() * col.chars.length);
            col.chars[idx] = randomCodeChar();
          }

          for (let j = 0; j < col.trailLength; j++) {
            const charY = col.y - j * CHAR_SIZE;
            const drawY =
              ((charY % (height + col.trailLength * CHAR_SIZE)) +
                height +
                col.trailLength * CHAR_SIZE) %
              (height + col.trailLength * CHAR_SIZE) -
              col.trailLength * CHAR_SIZE;
            if (drawY < -CHAR_SIZE || drawY > height + CHAR_SIZE) continue;
            const fadeRatio = 1 - j / col.trailLength;
            const alpha = (0.03 + fadeRatio * 0.03).toFixed(3);
            bgCtx!.fillStyle = `rgba(0,255,65,${alpha})`;
            bgCtx!.fillText(col.chars[j], col.x, drawY);
          }

          if (col.y - col.trailLength * CHAR_SIZE > height) {
            col.y = -CHAR_SIZE;
            col.x = Math.random() * width;
          }
        }
      }

      // === Hex grid (faint, behind everything) ===============================
      if (!prefersReducedMotion && !isMobile()) {
        bgCtx!.save();
        bgCtx!.globalAlpha = 0.015;
        bgCtx!.strokeStyle = "#00D4FF";
        bgCtx!.lineWidth = 0.5;
        const hexSize = 40;
        const hexH = hexSize * Math.sqrt(3);
        for (let row = -1; row < height / hexH + 1; row++) {
          for (let col = -1; col < width / (hexSize * 1.5) + 1; col++) {
            const cx = col * hexSize * 1.5;
            const cy = row * hexH + (col % 2 === 1 ? hexH / 2 : 0);
            bgCtx!.beginPath();
            for (let s = 0; s < 6; s++) {
              const a = (Math.PI / 3) * s;
              const hx = cx + hexSize * 0.5 * Math.cos(a);
              const hy = cy + hexSize * 0.5 * Math.sin(a);
              if (s === 0) bgCtx!.moveTo(hx, hy);
              else bgCtx!.lineTo(hx, hy);
            }
            bgCtx!.closePath();
            bgCtx!.stroke();
          }
        }
        bgCtx!.restore();
      }

      // === Binary rain (occasional "01" strings) ============================
      if (!prefersReducedMotion && !isMobile()) {
        bgCtx!.save();
        bgCtx!.font = "10px monospace";
        bgCtx!.fillStyle = "rgba(0,212,255,0.04)";
        // Use deterministic positions based on elapsed time
        const binaryCount = 8;
        for (let bi = 0; bi < binaryCount; bi++) {
          const bx = ((bi * 137 + Math.floor(elapsedMs / 8000) * 53) % width);
          const by = ((elapsedMs * 0.02 * (0.5 + bi * 0.1)) % (height + 100)) - 50;
          const bits = ((bi * 7 + Math.floor(elapsedMs / 200)) % 256).toString(2).padStart(8, '0');
          bgCtx!.fillText(bits, bx, by);
        }
        bgCtx!.restore();
      }

      // === Corner radar sweep (bottom-left, green, subtle) ==================
      if (!prefersReducedMotion && !isMobile()) {
        bgCtx!.save();
        const radarR = 60;
        const radarX = 50;
        const radarY = height - 50;
        const sweepAngle = (elapsedMs * 0.001) % (Math.PI * 2);

        // Radar circle
        bgCtx!.globalAlpha = 0.03;
        bgCtx!.strokeStyle = "#34D399";
        bgCtx!.lineWidth = 1;
        bgCtx!.beginPath();
        bgCtx!.arc(radarX, radarY, radarR, 0, Math.PI * 2);
        bgCtx!.stroke();
        bgCtx!.beginPath();
        bgCtx!.arc(radarX, radarY, radarR * 0.5, 0, Math.PI * 2);
        bgCtx!.stroke();

        // Sweep line
        bgCtx!.globalAlpha = 0.08;
        bgCtx!.beginPath();
        bgCtx!.moveTo(radarX, radarY);
        bgCtx!.lineTo(radarX + Math.cos(sweepAngle) * radarR, radarY + Math.sin(sweepAngle) * radarR);
        bgCtx!.stroke();

        // Fade trail
        const trailGrad = bgCtx!.createConicGradient(sweepAngle - 0.5, radarX, radarY);
        trailGrad.addColorStop(0, "rgba(52,211,153,0)");
        trailGrad.addColorStop(0.08, "rgba(52,211,153,0.04)");
        trailGrad.addColorStop(0.1, "rgba(52,211,153,0)");
        bgCtx!.fillStyle = trailGrad;
        bgCtx!.beginPath();
        bgCtx!.arc(radarX, radarY, radarR, 0, Math.PI * 2);
        bgCtx!.fill();

        bgCtx!.restore();
      }

      // === Data particles ====================================================
      if (!prefersReducedMotion) {
        for (const p of dataParticles) {
          p.y -= p.speed * factor;
          p.x += p.drift * factor;
          if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          bgCtx!.beginPath();
          bgCtx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          bgCtx!.fillStyle = `rgba(0,210,255,${p.alpha})`;
          bgCtx!.fill();
        }
      }

      // === Star Catcher Game =================================================
      if (gameActiveRef.current && !gameOverRef.current && !prefersReducedMotion) {
        gameElapsedMs += dt;

        // Spawn falling stars
        if (gameElapsedMs >= nextStarTime) {
          spawnFallingStar();
          const difficultyFactor = Math.min(scoreRef.current / 200, 3);
          nextStarTime = gameElapsedMs + randRange(1200, 2500) - difficultyFactor * 200;
        }

        // Update & draw falling stars
        for (const s of starPool) {
          if (!s.active) continue;
          s.y += s.speed * factor;
          s.pulse += s.pulseSpeed * factor;

          if (s.type === "gold") {
            // Pulsing golden star
            const glow = 0.7 + 0.3 * Math.sin(s.pulse);
            const starGrad = bgCtx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 1.5);
            starGrad.addColorStop(0, `rgba(255,215,0,${glow})`);
            starGrad.addColorStop(0.5, `rgba(255,180,0,${glow * 0.4})`);
            starGrad.addColorStop(1, `rgba(255,150,0,0)`);
            bgCtx!.beginPath();
            bgCtx!.arc(s.x, s.y, s.size * 1.5, 0, Math.PI * 2);
            bgCtx!.fillStyle = starGrad;
            bgCtx!.fill();

            // Star shape
            drawStarShape(bgCtx!, s.x, s.y, s.size * 0.5, s.size, 5, `rgba(255,223,0,${glow})`);
          } else if (s.type === "blue") {
            // Blue power-up star
            const glow = 0.8 + 0.2 * Math.sin(s.pulse * 1.5);
            const starGrad = bgCtx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 1.8);
            starGrad.addColorStop(0, `rgba(96,165,250,${glow})`);
            starGrad.addColorStop(0.4, `rgba(59,130,246,${glow * 0.5})`);
            starGrad.addColorStop(1, `rgba(30,64,175,0)`);
            bgCtx!.beginPath();
            bgCtx!.arc(s.x, s.y, s.size * 1.8, 0, Math.PI * 2);
            bgCtx!.fillStyle = starGrad;
            bgCtx!.fill();

            drawStarShape(bgCtx!, s.x, s.y, s.size * 0.4, s.size * 0.9, 5, `rgba(147,197,253,${glow})`);
          } else {
            // Black hole — dark circle with distortion
            const bhGrad = bgCtx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 1.5);
            bhGrad.addColorStop(0, `rgba(0,0,0,0.9)`);
            bhGrad.addColorStop(0.5, `rgba(30,0,60,0.6)`);
            bhGrad.addColorStop(0.8, `rgba(80,0,120,0.2)`);
            bhGrad.addColorStop(1, `rgba(120,0,180,0)`);
            bgCtx!.beginPath();
            bgCtx!.arc(s.x, s.y, s.size * 1.5, 0, Math.PI * 2);
            bgCtx!.fillStyle = bhGrad;
            bgCtx!.fill();

            // Spinning ring
            bgCtx!.save();
            bgCtx!.translate(s.x, s.y);
            bgCtx!.rotate(s.pulse);
            bgCtx!.beginPath();
            bgCtx!.ellipse(0, 0, s.size * 1.2, s.size * 0.4, 0, 0, Math.PI * 2);
            bgCtx!.strokeStyle = `rgba(160,80,255,0.4)`;
            bgCtx!.lineWidth = 1.5;
            bgCtx!.stroke();
            bgCtx!.restore();
          }

          // Star missed — passed bottom
          if (s.y > height + 50) {
            s.active = false;
            if (s.type !== "blackhole") {
              missedRef.current += 1;
              comboRef.current = 1;
              if (missedRef.current >= 5) {
                gameOverRef.current = true;
                setGameOver(true);
              }
            }
          }
        }

        // Update & draw sparkle particles
        for (const p of sparklePool) {
          if (!p.active) continue;
          p.x += p.vx * factor;
          p.y += p.vy * factor;
          p.vy += 0.05 * factor; // gravity
          p.life -= factor;
          if (p.life <= 0) { p.active = false; continue; }

          const pa = Math.min(p.life / 15, 1);
          bgCtx!.beginPath();
          bgCtx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          bgCtx!.fillStyle = p.color;
          bgCtx!.globalAlpha = pa;
          bgCtx!.fill();
          bgCtx!.globalAlpha = 1;
        }

        // Draw HUD on canvas
        bgCtx!.save();
        bgCtx!.font = "bold 22px 'Orbitron', sans-serif";
        bgCtx!.textAlign = "right";
        bgCtx!.fillStyle = "rgba(255,215,0,0.9)";
        bgCtx!.fillText(`SCORE: ${scoreRef.current}`, width - 20, 80);

        if (comboRef.current > 1) {
          bgCtx!.font = "bold 16px 'Orbitron', sans-serif";
          bgCtx!.fillStyle = "rgba(96,165,250,0.9)";
          bgCtx!.fillText(`x${comboRef.current} COMBO`, width - 20, 106);
        }

        // Missed indicator
        bgCtx!.textAlign = "left";
        bgCtx!.font = "bold 14px 'Orbitron', sans-serif";
        bgCtx!.fillStyle = "rgba(255,100,100,0.8)";
        const hearts = "★".repeat(5 - missedRef.current) + "☆".repeat(missedRef.current);
        bgCtx!.fillText(hearts, 20, 80);

        bgCtx!.restore();
      }

      // Game over overlay
      if (gameActiveRef.current && gameOverRef.current) {
        bgCtx!.save();
        bgCtx!.fillStyle = "rgba(5,7,13,0.7)";
        bgCtx!.fillRect(0, 0, width, height);

        bgCtx!.textAlign = "center";
        bgCtx!.font = "bold 36px 'Orbitron', sans-serif";
        bgCtx!.fillStyle = "#FFD700";
        bgCtx!.fillText("GAME OVER", width / 2, height / 2 - 30);

        bgCtx!.font = "bold 24px 'Orbitron', sans-serif";
        bgCtx!.fillStyle = "#EAF0FF";
        bgCtx!.fillText(`Final Score: ${scoreRef.current}`, width / 2, height / 2 + 20);

        bgCtx!.font = "14px sans-serif";
        bgCtx!.fillStyle = "rgba(143,211,255,0.7)";
        bgCtx!.fillText("Tap 🎮 to play again", width / 2, height / 2 + 60);

        bgCtx!.restore();
      }

      // Restore shake transform
      if (shakeTimer > 0) {
        bgCtx!.restore();
      }

      // === OVERLAY CANVAS (z-20) ============================================
      olCtx!.clearRect(0, 0, width, height);

      if (!prefersReducedMotion) {
        // Spawn overlay objects
        if (elapsedMs >= nextOverlaySatTime) {
          spawnOverlayObject("satellite");
          nextOverlaySatTime = elapsedMs + randRange(20000, 35000) * (isMobile() ? 2 : 1);
        }
        if (elapsedMs >= nextOverlayAstTime) {
          spawnOverlayObject("asteroid");
          nextOverlayAstTime = elapsedMs + randRange(50000, 90000) * (isMobile() ? 2 : 1);
        }
        if (elapsedMs >= nextOverlayCometTime) {
          spawnOverlayObject("comet");
          nextOverlayCometTime = elapsedMs + randRange(30000, 45000) * (isMobile() ? 1.5 : 1);
        }

        // Cap at 5 overlay objects
        while (overlayObjects.length > 5) overlayObjects.shift();

        for (let i = overlayObjects.length - 1; i >= 0; i--) {
          const obj = overlayObjects[i];
          obj.x += Math.cos(obj.angle) * obj.speed * factor;
          obj.y += Math.sin(obj.angle) * obj.speed * factor;

          if (obj.type === "satellite") {
            drawSatelliteShape(olCtx!, obj);
          } else if (obj.type === "asteroid") {
            if (obj.rotation !== undefined && obj.rotSpeed !== undefined) {
              obj.rotation += obj.rotSpeed * factor;
            }
            drawAsteroidShape(olCtx!, obj);
          } else if (obj.type === "comet") {
            if (obj.life !== undefined) obj.life += factor;
            drawCometShape(olCtx!, obj);
          }

          // Remove if out of bounds
          const margin = obj.type === "comet" ? 250 : 60;
          if (obj.x < -margin || obj.x > width + margin || obj.y < -margin || obj.y > height + margin) {
            overlayObjects.splice(i, 1);
          }
          // Remove comet if expired
          if (obj.type === "comet" && obj.life !== undefined && obj.maxLife !== undefined && obj.life >= obj.maxLife) {
            overlayObjects.splice(i, 1);
          }
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    }

    // Helper: draw a 5-pointed star shape
    function drawStarShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, innerR: number, outerR: number, points: number, color: string) {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        if (i === 0) ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        else ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      bgCanvas!.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const cleanup = setup();
    return () => { if (cleanup) cleanup(); };
  }, [setup]);

  // Sync refs with state
  useEffect(() => { gameActiveRef.current = gameActive; }, [gameActive]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);

  const toggleGame = () => {
    if (gameActive) {
      setGameActive(false);
      setGameOver(false);
      scoreRef.current = 0;
      comboRef.current = 1;
      missedRef.current = 0;
      gameOverRef.current = false;
      setScore(0);
    } else {
      scoreRef.current = 0;
      comboRef.current = 1;
      missedRef.current = 0;
      gameOverRef.current = false;
      setGameOver(false);
      setScore(0);
      setGameActive(true);
    }
  };

  return (
    <>
      {/* Background canvas (z-0) */}
      <canvas
        ref={bgCanvasRef}
        id="space-stage-canvas"
        className="fixed inset-0"
        style={{
          zIndex: gameActive ? 5 : 0,
          pointerEvents: gameActive ? "auto" : "none",
          touchAction: gameActive ? "none" : "pan-y",
        }}
        aria-hidden="true"
      />

      {/* Overlay canvas (z-20) — rare objects over content */}
      <canvas
        ref={overlayCanvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 20 }}
        aria-hidden="true"
      />

      {/* Game toggle button */}
      <button
        onClick={toggleGame}
        className="fixed bottom-6 right-6 z-[55] w-12 h-12 rounded-full glass-card flex items-center justify-center text-xl hover:scale-110 transition-transform !hover:transform-none cursor-pointer hidden"
        style={{ pointerEvents: "auto" }}
        aria-label={gameActive ? "Stop game" : "Start Star Catcher"}
        title={gameActive ? "Stop game" : "Star Catcher mini-game"}
      >
        {gameActive ? "⏹" : "🎮"}
      </button>

      {/* Game active indicator */}
      {gameActive && !gameOver && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[55] pointer-events-none">
          <div className="glass-card px-4 py-2 text-sm text-accent-amber font-mono">
            TAP STARS TO CATCH — AVOID BLACK HOLES
          </div>
        </div>
      )}
    </>
  );
}
