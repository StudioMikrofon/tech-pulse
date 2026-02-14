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
  /** RGB tint – most stars are white, a few have a blue/cyan hue */
  tint: [number, number, number];
  /** Horizontal drift factor (-1..1) */
  drift: number;
}

interface ShootingStar {
  x: number;
  y: number;
  /** Angle in radians */
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
  /** How many visible characters in the trail */
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

// ---------------------------------------------------------------------------
// Character pool for the code rain
// ---------------------------------------------------------------------------

const CODE_CHARS: string[] = [
  ..."0123456789ABCDEF".split(""),
  // Tech / unicode symbols
  "\u2318", "\u2325", "\u21E7", "\u2303", "\u2630", "\u25C6", "\u25CF",
  "\u2587", "\u2591", "\u2593", "\u00AB", "\u00BB", "\u03BB", "\u03A3",
  "\u0394", "\u03C0", "\u221E", "\u2248", "\u2260", "\u2264", "\u2265",
];

function randomCodeChar(): string {
  return CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Stable draw-setup wrapped in useCallback so the effect has a clean ref
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
          // ~15 % of stars get a subtle colour tint
          let tint: [number, number, number] = [234, 240, 255]; // default warm-white
          const r = Math.random();
          if (r < 0.08) {
            tint = [180, 210, 255]; // light blue
          } else if (r < 0.15) {
            tint = [190, 240, 255]; // cyan-ish
          }

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
    let nextShootingStarTime = 5000 + Math.random() * 10000; // 5-15 s in ms
    let elapsedMs = 0;

    function spawnShootingStar() {
      // Start from a random edge (top or right side)
      const fromTop = Math.random() > 0.5;
      const x = fromTop ? Math.random() * width : width + 10;
      const y = fromTop ? -10 : Math.random() * height * 0.5;
      const angle = fromTop
        ? Math.PI / 4 + (Math.random() - 0.5) * 0.4 // roughly diagonal down-right
        : Math.PI * 0.7 + (Math.random() - 0.5) * 0.3; // roughly diagonal down-left

      shootingStars.push({
        x,
        y,
        angle,
        speed: 12 + Math.random() * 8, // pixels per frame @ 60fps
        length: 80 + Math.random() * 60,
        alpha: 1,
        life: 0,
        maxLife: 60, // ~1 second at 60fps
      });
    }

    // -----------------------------------------------------------------------
    // Code rain columns
    // -----------------------------------------------------------------------
    function createCodeColumns(): CodeColumn[] {
      if (isMobile() || prefersReducedMotion) return [];
      const colCount = 15 + Math.floor(Math.random() * 6); // 15-20
      const cols: CodeColumn[] = [];
      for (let i = 0; i < colCount; i++) {
        const trailLength = 8 + Math.floor(Math.random() * 14);
        const chars: string[] = [];
        for (let j = 0; j < trailLength; j++) {
          chars.push(randomCodeChar());
        }
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
      const count = 20 + Math.floor(Math.random() * 11); // 20-30
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
    // Resize handler
    // -----------------------------------------------------------------------
    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width;
      canvas!.height = height;
      // Rebuild populations to match new size / mobile state
      layers = createStars();
      codeColumns = createCodeColumns();
      dataParticles = createDataParticles();
    }

    window.addEventListener("resize", handleResize);

    // -----------------------------------------------------------------------
    // Draw loop
    // -----------------------------------------------------------------------
    const CHAR_SIZE = 14; // font size for code rain
    let lastTimestamp = 0;

    function draw(timestamp: number) {
      const dt = lastTimestamp ? timestamp - lastTimestamp : 16.67;
      lastTimestamp = timestamp;
      elapsedMs += dt;

      ctx!.clearRect(0, 0, width, height);

      // --- Stars -----------------------------------------------------------
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

      // --- Shooting stars ---------------------------------------------------
      if (!prefersReducedMotion) {
        // Schedule new shooting star
        if (elapsedMs >= nextShootingStarTime) {
          spawnShootingStar();
          nextShootingStarTime =
            elapsedMs + 5000 + Math.random() * 10000;
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const s = shootingStars[i];
          s.life++;
          s.x += Math.cos(s.angle) * s.speed;
          s.y += Math.sin(s.angle) * s.speed;

          // Fade out in the last third of life
          const progress = s.life / s.maxLife;
          s.alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;

          // Draw streak
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

          // Bright head glow
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, 2, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(200,230,255,${s.alpha * 0.8})`;
          ctx!.fill();

          if (
            s.life >= s.maxLife ||
            s.x < -200 ||
            s.x > width + 200 ||
            s.y > height + 200
          ) {
            shootingStars.splice(i, 1);
          }
        }
      }

      // --- Code rain -------------------------------------------------------
      if (!prefersReducedMotion && !isMobile()) {
        ctx!.font = `${CHAR_SIZE}px "Courier New", monospace`;
        ctx!.textAlign = "center";

        for (const col of codeColumns) {
          col.y += col.speed;
          col.changeTimer += dt;

          // Randomly mutate a character every ~200ms
          if (col.changeTimer > 200) {
            col.changeTimer = 0;
            const idx = Math.floor(Math.random() * col.chars.length);
            col.chars[idx] = randomCodeChar();
          }

          // Draw each character in the trail
          for (let j = 0; j < col.trailLength; j++) {
            const charY = col.y - j * CHAR_SIZE;
            // Wrap vertically
            const drawY =
              ((charY % (height + col.trailLength * CHAR_SIZE)) +
                height +
                col.trailLength * CHAR_SIZE) %
              (height + col.trailLength * CHAR_SIZE) -
              col.trailLength * CHAR_SIZE;

            if (drawY < -CHAR_SIZE || drawY > height + CHAR_SIZE) continue;

            // Alpha: head char is brightest, fades towards tail
            const fadeRatio = 1 - j / col.trailLength;
            // Base alpha extremely low (0.03 - 0.06)
            const alpha = (0.03 + fadeRatio * 0.03).toFixed(3);

            ctx!.fillStyle = `rgba(0,255,65,${alpha})`;
            ctx!.fillText(col.chars[j], col.x, drawY);
          }

          // Reset column when it scrolls well past the screen
          if (col.y - col.trailLength * CHAR_SIZE > height) {
            col.y = -CHAR_SIZE;
            col.x = Math.random() * width;
          }
        }
      }

      // --- Data particles ---------------------------------------------------
      if (!prefersReducedMotion) {
        for (const p of dataParticles) {
          p.y -= p.speed;
          p.x += p.drift;

          // Wrap
          if (p.y < -10) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
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

    // Cleanup
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
