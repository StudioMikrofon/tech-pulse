"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { playSound } from "@/lib/sounds";

export default function PageTransition() {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isFirstRender = useRef(true);

  const runTransition = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const cx = w / 2;
    const cy = h / 2;
    const duration = 600;
    const lineCount = 90;

    // Pre-generate radial lines
    const lines = Array.from({ length: lineCount }, () => ({
      angle: Math.random() * Math.PI * 2,
      baseLen: 20 + Math.random() * 40,
      offset: Math.random() * 0.3,
    }));

    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);

      ctx!.clearRect(0, 0, w, h);

      // Lines stretch outward, accelerating with progress
      const accel = progress * progress; // quadratic acceleration
      const maxReach = Math.max(w, h);

      for (const line of lines) {
        const p = Math.max(0, progress - line.offset) / (1 - line.offset);
        if (p <= 0) continue;

        const innerR = 10 + accel * 100;
        const outerR = innerR + line.baseLen + p * maxReach * 0.8;

        const x1 = cx + Math.cos(line.angle) * innerR;
        const y1 = cy + Math.sin(line.angle) * innerR;
        const x2 = cx + Math.cos(line.angle) * outerR;
        const y2 = cy + Math.sin(line.angle) * outerR;

        const grad = ctx!.createLinearGradient(x1, y1, x2, y2);
        const alpha = (1 - p) * 0.6;
        grad.addColorStop(0, `rgba(143,211,255,${alpha})`);
        grad.addColorStop(1, `rgba(143,211,255,0)`);

        ctx!.beginPath();
        ctx!.moveTo(x1, y1);
        ctx!.lineTo(x2, y2);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
      }

      // Central flash at peak (around 40-60% progress)
      if (progress > 0.3 && progress < 0.7) {
        const flashAlpha = Math.sin(((progress - 0.3) / 0.4) * Math.PI) * 0.15;
        const flashGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, 150);
        flashGrad.addColorStop(0, `rgba(255,255,255,${flashAlpha})`);
        flashGrad.addColorStop(1, `rgba(143,211,255,0)`);
        ctx!.beginPath();
        ctx!.arc(cx, cy, 150, 0, Math.PI * 2);
        ctx!.fillStyle = flashGrad;
        ctx!.fill();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        ctx!.clearRect(0, 0, w, h);
        setIsTransitioning(false);
      }
    }

    requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else {
      playSound("transition");
    }
    setIsTransitioning(true);
  }, [pathname]);

  useEffect(() => {
    if (isTransitioning) runTransition();
  }, [isTransitioning, runTransition]);

  if (!isTransitioning) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
      aria-hidden="true"
    />
  );
}
