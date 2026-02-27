"use client";

import { useEffect, useRef } from "react";
import type { Category } from "@/lib/types";

const CATEGORY_COLORS: Record<Category, string> = {
  ai: "#A78BFA",
  gaming: "#F87171",
  space: "#60A5FA",
  technology: "#34D399",
  medicine: "#FB923C",
  society: "#F472B6",
  robotics: "#38BDF8",
};

interface CategoryBannerProps {
  category: Category;
}

export default function CategoryBanner({ category }: CategoryBannerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const color = CATEGORY_COLORS[category];

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas!.getBoundingClientRect().width;
    const H = () => canvas!.getBoundingClientRect().height;

    // Parse hex color
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Animation functions per category
    const animations: Record<Category, (t: number) => void> = {
      // AI: neural network nodes + connections
      ai: (t) => {
        const w = W(), h = H();
        ctx.clearRect(0, 0, w, h);
        const nodes: { x: number; y: number }[] = [];
        const count = 18;
        for (let i = 0; i < count; i++) {
          const x = (Math.sin(i * 1.7 + t * 0.0005) * 0.4 + 0.5) * w;
          const y = (Math.cos(i * 2.3 + t * 0.0007) * 0.35 + 0.5) * h;
          nodes.push({ x, y });
        }
        // connections
        ctx.strokeStyle = `rgba(${r},${g},${b},0.15)`;
        ctx.lineWidth = 1;
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            if (Math.sqrt(dx * dx + dy * dy) < w * 0.25) {
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.stroke();
            }
          }
        }
        // nodes
        for (const n of nodes) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},0.6)`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(n.x, n.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},0.1)`;
          ctx.fill();
        }
      },

      // Gaming: pixel grid with glowing cells
      gaming: (t) => {
        const w = W(), h = H();
        ctx.clearRect(0, 0, w, h);
        const cellSize = 20;
        const cols = Math.ceil(w / cellSize);
        const rows = Math.ceil(h / cellSize);
        for (let c = 0; c < cols; c++) {
          for (let row = 0; row < rows; row++) {
            const active = Math.sin(c * 0.5 + row * 0.7 + t * 0.002) > 0.7;
            if (active) {
              const alpha = (Math.sin(c * 0.5 + row * 0.7 + t * 0.002) - 0.7) / 0.3;
              ctx.fillStyle = `rgba(${r},${g},${b},${(alpha * 0.4).toFixed(2)})`;
              ctx.fillRect(c * cellSize + 1, row * cellSize + 1, cellSize - 2, cellSize - 2);
            }
          }
        }
        // grid lines
        ctx.strokeStyle = `rgba(${r},${g},${b},0.06)`;
        ctx.lineWidth = 0.5;
        for (let c = 0; c <= cols; c++) {
          ctx.beginPath();
          ctx.moveTo(c * cellSize, 0);
          ctx.lineTo(c * cellSize, h);
          ctx.stroke();
        }
        for (let row = 0; row <= rows; row++) {
          ctx.beginPath();
          ctx.moveTo(0, row * cellSize);
          ctx.lineTo(w, row * cellSize);
          ctx.stroke();
        }
      },

      // Space: starfield + shooting stars
      space: (t) => {
        const w = W(), h = H();
        ctx.clearRect(0, 0, w, h);
        // stars
        const seed = 42;
        for (let i = 0; i < 80; i++) {
          const px = ((i * 7919 + seed) % 1000) / 1000 * w;
          const py = ((i * 6271 + seed) % 1000) / 1000 * h;
          const twinkle = Math.sin(t * 0.003 + i) * 0.3 + 0.5;
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${twinkle.toFixed(2)})`;
          ctx.fill();
        }
        // shooting stars
        for (let s = 0; s < 3; s++) {
          const phase = ((t * 0.001 + s * 3.33) % 3) / 3;
          if (phase < 0.3) {
            const p = phase / 0.3;
            const sx = (0.1 + s * 0.3) * w + p * w * 0.3;
            const sy = (0.1 + s * 0.15) * h + p * h * 0.15;
            const grad = ctx.createLinearGradient(sx - 30, sy, sx, sy);
            grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},${(0.6 * (1 - p)).toFixed(2)})`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx - 30, sy - 8);
            ctx.lineTo(sx, sy);
            ctx.stroke();
          }
        }
      },

      // Technology: circuit board traces + signals
      technology: (t) => {
        const w = W(), h = H();
        ctx.clearRect(0, 0, w, h);
        const gridSize = 40;
        ctx.strokeStyle = `rgba(${r},${g},${b},0.12)`;
        ctx.lineWidth = 1;
        // horizontal traces
        for (let row = 0; row < h; row += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, row);
          for (let x = 0; x < w; x += gridSize) {
            const jog = ((x + row) * 7 + 13) % 3 === 0 ? gridSize / 2 : 0;
            ctx.lineTo(x + gridSize / 2, row + jog);
            ctx.lineTo(x + gridSize, row);
          }
          ctx.stroke();
        }
        // signal pulses
        for (let s = 0; s < 5; s++) {
          const progress = ((t * 0.001 + s * 0.8) % 4) / 4;
          const px = progress * w;
          const py = (s * gridSize * 2 + gridSize) % h;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},0.6)`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(px, py, 10, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
          ctx.fill();
        }
      },

      // Medicine: DNA helix rotation
      medicine: (t) => {
        const w = W(), h = H();
        ctx.clearRect(0, 0, w, h);
        const helixW = w * 0.15;
        const cx = w / 2;
        ctx.lineWidth = 2;
        for (let y = 0; y < h; y += 3) {
          const phase = y * 0.04 + t * 0.002;
          const x1 = cx + Math.sin(phase) * helixW;
          const x2 = cx + Math.sin(phase + Math.PI) * helixW;
          // strands
          ctx.fillStyle = `rgba(${r},${g},${b},0.4)`;
          ctx.fillRect(x1 - 1.5, y, 3, 3);
          ctx.fillStyle = `rgba(${r},${g},${b},0.25)`;
          ctx.fillRect(x2 - 1.5, y, 3, 3);
          // base pairs every 12px
          if (y % 12 === 0) {
            ctx.strokeStyle = `rgba(${r},${g},${b},0.12)`;
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
            ctx.stroke();
          }
        }
      },

      // Society: connected network dots
      society: (t) => {
        const w = W(), h = H();
        ctx.clearRect(0, 0, w, h);
        const dots: { x: number; y: number }[] = [];
        for (let i = 0; i < 24; i++) {
          const angle = i * 0.67 + t * 0.0003;
          dots.push({
            x: (Math.sin(angle + i) * 0.35 + 0.5) * w,
            y: (Math.cos(angle * 1.3 + i * 0.5) * 0.35 + 0.5) * h,
          });
        }
        // connections
        ctx.strokeStyle = `rgba(${r},${g},${b},0.1)`;
        ctx.lineWidth = 1;
        for (let i = 0; i < dots.length; i++) {
          for (let j = i + 1; j < dots.length; j++) {
            const dx = dots[i].x - dots[j].x;
            const dy = dots[i].y - dots[j].y;
            if (Math.sqrt(dx * dx + dy * dy) < w * 0.2) {
              ctx.beginPath();
              ctx.moveTo(dots[i].x, dots[i].y);
              ctx.lineTo(dots[j].x, dots[j].y);
              ctx.stroke();
            }
          }
        }
        for (const d of dots) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
          ctx.fill();
        }
      },

      // Robotics: rotating gears
      robotics: (t) => {
        const w = W(), h = H();
        ctx.clearRect(0, 0, w, h);
        const gears = [
          { x: w * 0.3, y: h * 0.45, r: 35, teeth: 10, speed: 1 },
          { x: w * 0.55, y: h * 0.5, r: 25, teeth: 8, speed: -1.3 },
          { x: w * 0.72, y: h * 0.4, r: 30, teeth: 9, speed: 1.1 },
        ];
        for (const gear of gears) {
          const angle = t * 0.001 * gear.speed;
          ctx.strokeStyle = `rgba(${r},${g},${b},0.3)`;
          ctx.lineWidth = 1.5;
          // outer ring
          ctx.beginPath();
          ctx.arc(gear.x, gear.y, gear.r, 0, Math.PI * 2);
          ctx.stroke();
          // inner ring
          ctx.beginPath();
          ctx.arc(gear.x, gear.y, gear.r * 0.4, 0, Math.PI * 2);
          ctx.stroke();
          // teeth
          for (let i = 0; i < gear.teeth; i++) {
            const a = (i / gear.teeth) * Math.PI * 2 + angle;
            const x1 = gear.x + Math.cos(a) * gear.r;
            const y1 = gear.y + Math.sin(a) * gear.r;
            const x2 = gear.x + Math.cos(a) * (gear.r + 8);
            const y2 = gear.y + Math.sin(a) * (gear.r + 8);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
          // center dot
          ctx.beginPath();
          ctx.arc(gear.x, gear.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
          ctx.fill();
        }
      },
    };

    let running = true;
    function loop(t: number) {
      if (!running) return;
      const drawFn = animations[category];
      if (drawFn) drawFn(t);
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [category]);

  const color = CATEGORY_COLORS[category];

  return (
    <div className="relative h-32 md:h-48 rounded-xl overflow-hidden mb-6">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* Gradient fade at edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to right, rgba(5,7,16,0.8) 0%, transparent 20%, transparent 80%, rgba(5,7,16,0.8) 100%), linear-gradient(to bottom, transparent 50%, rgba(5,7,16,0.9) 100%)`,
        }}
      />
      {/* Bottom glow line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }}
      />
    </div>
  );
}
