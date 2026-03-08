"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { playSound } from "@/lib/sounds";

// ---------------------------------------------------------------------------
// Glitch-terminal page transition
// Phases:
//   0–120ms  horizontal scanline wipe + RGB aberration noise
//   120–300ms digital rain columns (sparse falling chars)
//   250–400ms CRT bloom flash + fade to black
//   400ms     clear → content visible
// ---------------------------------------------------------------------------

const CHARS = "01アイウエオカキクケコサシスセソタチツテトABCDEFGHIJKLM░▒▓█▀▄";

function rndChar() { return CHARS[Math.floor(Math.random() * CHARS.length)]; }

export default function PageTransition() {
  const pathname  = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isFirst   = useRef(true);
  const rafRef    = useRef<number>(0);
  const activeRef = useRef(false);

  const run = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx = ctxOrNull;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
    canvas.style.display = "block";
    activeRef.current = true;

    const DURATION = 420;
    const COL_W    = 18;
    const COLS     = Math.ceil(W / COL_W);
    const COL_H    = Math.floor(H / COL_W);
    const t0       = performance.now();

    // Per-column rain state
    const colHead   = Array.from({ length: COLS }, () => -Math.floor(Math.random() * COL_H * 0.6));
    const colChar   = Array.from({ length: COLS }, rndChar);
    const colSpeed  = Array.from({ length: COLS }, () => 0.4 + Math.random() * 0.8);
    const colActive = Array.from({ length: COLS }, () => Math.random() < 0.55);

    function draw(now: number) {
      if (!activeRef.current) return;
      const t = Math.min((now - t0) / DURATION, 1);

      ctx.clearRect(0, 0, W, H);

      // Background overlay: fade in then out
      const bgAlpha = t < 0.5 ? t * 2 * 0.88 : (1 - t) * 2 * 0.88;
      ctx.fillStyle = `rgba(2,4,14,${bgAlpha})`;
      ctx.fillRect(0, 0, W, H);

      // Phase 1 (0–0.4): horizontal scanline noise + RGB aberration
      if (t < 0.45) {
        const p = t / 0.4;
        const n = Math.floor(4 + p * 12);
        for (let i = 0; i < n; i++) {
          const y = Math.random() * H;
          const lw = 40 + Math.random() * W * 0.7;
          const lx = Math.random() * (W - lw);
          ctx.fillStyle = `rgba(0,212,255,${0.08 + Math.random() * 0.12 * p})`;
          ctx.fillRect(lx - 2, y, lw + 4, 1 + Math.random() * 2);
          ctx.fillStyle = `rgba(255,80,80,${0.05 + Math.random() * 0.08 * p})`;
          ctx.fillRect(lx + 2, y + 0.5, lw - 4, 1);
        }
      }

      // Block glitch rectangles
      if (t > 0.05 && t < 0.45) {
        const p = (t - 0.05) / 0.4;
        for (let i = 0; i < Math.floor(p * 5); i++) {
          ctx.fillStyle = Math.random() < 0.3
            ? `rgba(0,212,255,${0.06 + Math.random() * 0.1})`
            : `rgba(0,0,0,${0.4 + Math.random() * 0.3})`;
          ctx.fillRect(
            Math.random() * W * 0.7,
            Math.random() * H,
            30 + Math.random() * 200,
            2 + Math.random() * 12,
          );
        }
      }

      // Phase 2 (0.12–0.82): digital rain
      if (t > 0.12 && t < 0.82) {
        const p = Math.min((t - 0.12) / 0.45, 1);
        ctx.font = `${COL_W - 2}px "Courier New", monospace`;
        for (let c = 0; c < COLS; c++) {
          if (!colActive[c]) continue;
          colHead[c] += colSpeed[c] * 0.6;
          if (Math.random() < 0.08) colChar[c] = rndChar();
          const hr = Math.floor(colHead[c]);
          for (let r = hr; r >= Math.max(0, hr - 8); r--) {
            const fade = 1 - (hr - r) / 9;
            ctx.fillStyle = r === hr - 1
              ? `rgba(180,240,255,${fade * p * 0.95})`
              : `rgba(0,212,255,${fade * p * 0.45})`;
            ctx.fillText(rndChar(), c * COL_W, (r + 1) * COL_W);
          }
          if (hr >= 0 && hr < COL_H) {
            ctx.fillStyle = `rgba(255,255,255,${p * 0.9})`;
            ctx.fillText(colChar[c], c * COL_W, (hr + 1) * COL_W);
          }
        }
      }

      // Phase 3 (0.52–0.82): CRT bloom
      if (t > 0.52 && t < 0.82) {
        const p    = Math.sin(((t - 0.52) / 0.3) * Math.PI);
        const bloom = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.4);
        bloom.addColorStop(0,   `rgba(0,212,255,${p * 0.12})`);
        bloom.addColorStop(0.3, `rgba(0,100,180,${p * 0.06})`);
        bloom.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, W, H);
      }

      // Scanline overlay
      if (t > 0.05 && t < 0.9) {
        for (let y = 0; y < H; y += 4) {
          ctx.fillStyle = `rgba(0,0,0,${bgAlpha * 0.22})`;
          ctx.fillRect(0, y, W, 1);
        }
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, W, H);
        canvasRef.current!.style.display = "none";
        activeRef.current = false;
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    playSound("glitch");
    cancelAnimationFrame(rafRef.current);
    activeRef.current = false;
    run();
  }, [pathname, run]);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); activeRef.current = false; }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999, display: "none" }}
      aria-hidden="true"
    />
  );
}
