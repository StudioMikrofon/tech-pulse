"use client";

import { useEffect, useRef, useCallback } from "react";

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
}

// ---------------------------------------------------------------------------
// Character pool for the code rain
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Starfield() {
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

    let width = window.innerWidth;
    let height = window.innerHeight;
    const isMobile = () => width < 768;
    canvas.width = width;
    canvas.height = height;

    // -----------------------------------------------------------------------
    // Star layers
    // -----------------------------------------------------------------------
    const mobileFactor = () => (isMobile() ? 0.5 : 1);

    const layerConfigs = [
      { count: 200, minR: 0.3, maxR: 0.8, speed: 0.02 },
      { count: 120, minR: 0.6, maxR: 1.2, speed: 0.05 },
      { count: 60, minR: 1.0, maxR: 1.8, speed: 0.1 },
    ];

    function createStars(): Star[][] {
      const factor = mobileFactor();
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
    // Code rain columns
    // -----------------------------------------------------------------------
    function createCodeColumns(): CodeColumn[] {
      if (isMobile() || prefersReducedMotion) return [];
      const colCount = 15 + Math.floor(Math.random() * 6);
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
      const count = 20 + Math.floor(Math.random() * 11);
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
    // NEW: Nebula pulses (always present, 2-3)
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
        });
      }
      return pulses;
    }

    let nebulaPulses = createNebulaPulses();

    // -----------------------------------------------------------------------
    // NEW: Satellites
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
    // NEW: Spacecraft
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
    // NEW: Supernovas
    // -----------------------------------------------------------------------
    let supernovas: Supernova[] = [];
    let nextSupernovaTime = elapsedMs + randRange(30000, 60000) * (isMobile() ? 2 : 1);

    function spawnSupernova() {
      supernovas.push({
        x: randRange(50, width - 50),
        y: randRange(50, height - 50),
        life: 0,
        maxLife: randRange(120, 180), // 2-3s at 60fps
        maxRadius: randRange(40, 80),
      });
    }

    // -----------------------------------------------------------------------
    // NEW: Asteroids
    // -----------------------------------------------------------------------
    let asteroids: Asteroid[] = [];
    let nextAsteroidTime = elapsedMs + randRange(20000, 45000) * (isMobile() ? 2 : 1);

    function spawnAsteroid() {
      const fromLeft = Math.random() > 0.5;
      const vertCount = 5 + Math.floor(Math.random() * 3);
      const vertices: number[] = [];
      for (let i = 0; i < vertCount; i++) {
        vertices.push(0.6 + Math.random() * 0.4); // distance multiplier
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
    // NEW: Comets
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
        maxLife: randRange(240, 360), // 4-6s
        tailLength: randRange(100, 200),
        headRadius: randRange(2.5, 4),
      });
    }

    // -----------------------------------------------------------------------
    // Resize handler
    // -----------------------------------------------------------------------
    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width;
      canvas!.height = height;
      layers = createStars();
      codeColumns = createCodeColumns();
      dataParticles = createDataParticles();
      nebulaPulses = createNebulaPulses();
    }

    window.addEventListener("resize", handleResize);

    // -----------------------------------------------------------------------
    // Draw loop
    // -----------------------------------------------------------------------
    const CHAR_SIZE = 14;
    let lastTimestamp = 0;

    function draw(timestamp: number) {
      const dt = lastTimestamp ? timestamp - lastTimestamp : 16.67;
      lastTimestamp = timestamp;
      elapsedMs += dt;

      ctx!.clearRect(0, 0, width, height);

      // === Stars ==========================================================
      for (const stars of layers) {
        for (const star of stars) {
          if (!prefersReducedMotion) {
            star.x += star.speed * 0.3 + star.drift * 0.05;
            star.y -= star.speed * 0.1;
            star.twinklePhase += star.twinkleSpeed;
            if (star.x > width) star.x = 0;
            if (star.x < 0) star.x = width;
            if (star.y < 0) star.y = height;
          }
          const twinkle = prefersReducedMotion
            ? star.baseAlpha
            : star.baseAlpha * (0.6 + 0.4 * Math.sin(star.twinklePhase));
          const [r, g, b] = star.tint;
          ctx!.beginPath();
          ctx!.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${r},${g},${b},${twinkle})`;
          ctx!.fill();
        }
      }

      // === Nebula pulses ==================================================
      if (!prefersReducedMotion) {
        for (const np of nebulaPulses) {
          np.phase += np.phaseSpeed * dt;
          const alpha = 0.02 + 0.02 * Math.sin(np.phase);
          const [r, g, b] = np.color;
          const grad = ctx!.createRadialGradient(
            np.x, np.y, 0,
            np.x, np.y, np.radius
          );
          grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx!.beginPath();
          ctx!.arc(np.x, np.y, np.radius, 0, Math.PI * 2);
          ctx!.fillStyle = grad;
          ctx!.fill();
        }
      }

      // === Shooting stars =================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextShootingStarTime) {
          spawnShootingStar();
          nextShootingStarTime = elapsedMs + 5000 + Math.random() * 10000;
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const s = shootingStars[i];
          s.life++;
          s.x += Math.cos(s.angle) * s.speed;
          s.y += Math.sin(s.angle) * s.speed;
          const progress = s.life / s.maxLife;
          s.alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;

          const tailX = s.x - Math.cos(s.angle) * s.length;
          const tailY = s.y - Math.sin(s.angle) * s.length;
          const grad = ctx!.createLinearGradient(tailX, tailY, s.x, s.y);
          grad.addColorStop(0, `rgba(255,255,255,0)`);
          grad.addColorStop(1, `rgba(255,255,255,${s.alpha})`);
          ctx!.beginPath();
          ctx!.moveTo(tailX, tailY);
          ctx!.lineTo(s.x, s.y);
          ctx!.strokeStyle = grad;
          ctx!.lineWidth = 1.5;
          ctx!.stroke();

          ctx!.beginPath();
          ctx!.arc(s.x, s.y, 2, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(200,230,255,${s.alpha * 0.8})`;
          ctx!.fill();

          if (s.life >= s.maxLife || s.x < -200 || s.x > width + 200 || s.y > height + 200) {
            shootingStars.splice(i, 1);
          }
        }
      }

      // === Supernovas =====================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextSupernovaTime) {
          spawnSupernova();
          nextSupernovaTime = elapsedMs + randRange(30000, 60000) * (isMobile() ? 2 : 1);
        }

        for (let i = supernovas.length - 1; i >= 0; i--) {
          const sn = supernovas[i];
          sn.life++;
          const progress = sn.life / sn.maxLife;
          const currentR = sn.maxRadius * Math.min(progress * 2, 1);
          // Peaks at 30% life then fades
          const alpha = progress < 0.3
            ? (progress / 0.3) * 0.15
            : 0.15 * (1 - (progress - 0.3) / 0.7);

          const grad = ctx!.createRadialGradient(
            sn.x, sn.y, 0,
            sn.x, sn.y, currentR
          );
          grad.addColorStop(0, `rgba(255,255,240,${alpha})`);
          grad.addColorStop(0.4, `rgba(200,220,255,${alpha * 0.5})`);
          grad.addColorStop(1, `rgba(150,180,255,0)`);
          ctx!.beginPath();
          ctx!.arc(sn.x, sn.y, currentR, 0, Math.PI * 2);
          ctx!.fillStyle = grad;
          ctx!.fill();

          if (sn.life >= sn.maxLife) supernovas.splice(i, 1);
        }
      }

      // === Asteroids ======================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextAsteroidTime) {
          spawnAsteroid();
          nextAsteroidTime = elapsedMs + randRange(20000, 45000) * (isMobile() ? 2 : 1);
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
          const vCount = a.vertices.length;
          for (let v = 0; v < vCount; v++) {
            const ang = (v / vCount) * Math.PI * 2;
            const r = a.size * a.vertices[v];
            const vx = Math.cos(ang) * r;
            const vy = Math.sin(ang) * r;
            if (v === 0) ctx!.moveTo(vx, vy);
            else ctx!.lineTo(vx, vy);
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
      }

      // === Satellites =====================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextSatelliteTime) {
          spawnSatellite();
          nextSatelliteTime = elapsedMs + randRange(15000, 30000) * (isMobile() ? 2 : 1);
        }

        for (let i = satellites.length - 1; i >= 0; i--) {
          const sat = satellites[i];
          sat.x += Math.cos(sat.angle) * sat.speed;
          sat.y += Math.sin(sat.angle) * sat.speed;
          sat.panelAngle += 0.01;

          ctx!.save();
          ctx!.translate(sat.x, sat.y);
          ctx!.globalAlpha = sat.alpha;

          // Body
          ctx!.fillStyle = "#C0C0C0";
          ctx!.fillRect(-sat.size / 2, -sat.size / 2, sat.size, sat.size);

          // Solar panels
          const panelW = sat.size * 1.8;
          const panelH = sat.size * 0.5;
          ctx!.fillStyle = "#3B6BA5";
          ctx!.fillRect(-sat.size / 2 - panelW, -panelH / 2, panelW, panelH);
          ctx!.fillRect(sat.size / 2, -panelH / 2, panelW, panelH);

          ctx!.globalAlpha = 1;
          ctx!.restore();

          if (sat.x < -60 || sat.x > width + 60 || sat.y < -60 || sat.y > height + 60) {
            satellites.splice(i, 1);
          }
        }
      }

      // === Spacecraft =====================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextSpacecraftTime) {
          spawnSpacecraft();
          nextSpacecraftTime = elapsedMs + randRange(40000, 90000) * (isMobile() ? 2 : 1);
        }

        for (let i = spacecraft.length - 1; i >= 0; i--) {
          const sc = spacecraft[i];
          sc.x += Math.cos(sc.angle) * sc.speed;
          sc.y += Math.sin(sc.angle) * sc.speed;

          ctx!.save();
          ctx!.translate(sc.x, sc.y);
          ctx!.rotate(sc.angle);
          ctx!.globalAlpha = sc.alpha;

          // Triangular silhouette
          ctx!.beginPath();
          ctx!.moveTo(sc.size, 0);
          ctx!.lineTo(-sc.size * 0.6, -sc.size * 0.4);
          ctx!.lineTo(-sc.size * 0.6, sc.size * 0.4);
          ctx!.closePath();
          ctx!.fillStyle = "#A0A8B0";
          ctx!.fill();

          ctx!.globalAlpha = 1;
          ctx!.restore();

          if (sc.x < -50 || sc.x > width + 50 || sc.y < -50 || sc.y > height + 50) {
            spacecraft.splice(i, 1);
          }
        }
      }

      // === Comets =========================================================
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextCometTime) {
          spawnComet();
          nextCometTime = elapsedMs + randRange(120000, 180000) * (isMobile() ? 1.5 : 1);
        }

        for (let i = comets.length - 1; i >= 0; i--) {
          const c = comets[i];
          c.x += Math.cos(c.angle) * c.speed;
          c.y += Math.sin(c.angle) * c.speed;
          c.life++;

          const progress = c.life / c.maxLife;
          const alpha = progress < 0.1
            ? progress / 0.1
            : progress > 0.8
              ? (1 - progress) / 0.2
              : 1;
          const cometAlpha = alpha * 0.7;

          // Tail
          const tailX = c.x - Math.cos(c.angle) * c.tailLength;
          const tailY = c.y - Math.sin(c.angle) * c.tailLength;
          const grad = ctx!.createLinearGradient(tailX, tailY, c.x, c.y);
          grad.addColorStop(0, `rgba(180,220,255,0)`);
          grad.addColorStop(0.7, `rgba(200,235,255,${cometAlpha * 0.3})`);
          grad.addColorStop(1, `rgba(230,245,255,${cometAlpha})`);

          ctx!.beginPath();
          ctx!.moveTo(tailX, tailY);
          ctx!.lineTo(c.x, c.y);
          ctx!.strokeStyle = grad;
          ctx!.lineWidth = 3;
          ctx!.stroke();

          // Head glow
          const headGrad = ctx!.createRadialGradient(
            c.x, c.y, 0,
            c.x, c.y, c.headRadius * 4
          );
          headGrad.addColorStop(0, `rgba(255,255,255,${cometAlpha})`);
          headGrad.addColorStop(0.5, `rgba(200,230,255,${cometAlpha * 0.3})`);
          headGrad.addColorStop(1, `rgba(150,200,255,0)`);
          ctx!.beginPath();
          ctx!.arc(c.x, c.y, c.headRadius * 4, 0, Math.PI * 2);
          ctx!.fillStyle = headGrad;
          ctx!.fill();

          // Bright head
          ctx!.beginPath();
          ctx!.arc(c.x, c.y, c.headRadius, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(255,255,255,${cometAlpha})`;
          ctx!.fill();

          if (c.life >= c.maxLife || c.x < -250 || c.x > width + 250 || c.y > height + 250) {
            comets.splice(i, 1);
          }
        }
      }

      // === Code rain ======================================================
      if (!prefersReducedMotion && !isMobile()) {
        ctx!.font = `${CHAR_SIZE}px "Courier New", monospace`;
        ctx!.textAlign = "center";

        for (const col of codeColumns) {
          col.y += col.speed;
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
            ctx!.fillStyle = `rgba(0,255,65,${alpha})`;
            ctx!.fillText(col.chars[j], col.x, drawY);
          }

          if (col.y - col.trailLength * CHAR_SIZE > height) {
            col.y = -CHAR_SIZE;
            col.x = Math.random() * width;
          }
        }
      }

      // === Data particles =================================================
      if (!prefersReducedMotion) {
        for (const p of dataParticles) {
          p.y -= p.speed;
          p.x += p.drift;
          if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(0,210,255,${p.alpha})`;
          ctx!.fill();
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
    return () => {
      if (cleanup) cleanup();
    };
  }, [setup]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
