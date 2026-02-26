"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Orbit, Gamepad2 } from "lucide-react";

interface GameAsteroid {
  x: number;
  y: number;
  radius: number;
  speed: number;
}

export default function NotFound() {
  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const startGame = useCallback(() => {
    setPlaying(true);
    setGameOver(false);
    setScore(0);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = Math.min(window.innerWidth - 32, 600);
    const h = 400;
    canvas.width = w;
    canvas.height = h;

    let shipX = w / 2;
    const shipY = h - 30;
    const shipSize = 12;
    const keys: Record<string, boolean> = {};
    let asteroids: GameAsteroid[] = [];
    let frames = 0;
    let alive = true;
    let touchX: number | null = null;

    function handleKeyDown(e: KeyboardEvent) {
      keys[e.key] = true;
    }
    function handleKeyUp(e: KeyboardEvent) {
      keys[e.key] = false;
    }
    function handleTouchMove(e: TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      touchX = e.touches[0].clientX - rect.left;
    }
    function handleTouchEnd() {
      touchX = null;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd);

    function gameLoop() {
      if (!alive) return;
      frames++;

      // Move ship
      if (keys["ArrowLeft"] || keys["a"]) shipX -= 5;
      if (keys["ArrowRight"] || keys["d"]) shipX += 5;
      if (touchX !== null) {
        const diff = touchX - shipX;
        shipX += diff * 0.15;
      }
      shipX = Math.max(shipSize, Math.min(w - shipSize, shipX));

      // Spawn asteroids
      if (frames % Math.max(10, 30 - Math.floor(frames / 200)) === 0) {
        asteroids.push({
          x: Math.random() * (w - 20) + 10,
          y: -15,
          radius: 6 + Math.random() * 10,
          speed: 2 + Math.random() * 2 + frames * 0.002,
        });
      }

      // Update asteroids
      for (let i = asteroids.length - 1; i >= 0; i--) {
        asteroids[i].y += asteroids[i].speed;
        if (asteroids[i].y > h + 20) {
          asteroids.splice(i, 1);
        }
      }

      // Collision check
      for (const a of asteroids) {
        const dx = a.x - shipX;
        const dy = a.y - shipY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < a.radius + shipSize * 0.7) {
          alive = false;
          setGameOver(true);
          setScore(Math.floor(frames / 60));
          break;
        }
      }

      // Draw
      ctx!.fillStyle = "#05070D";
      ctx!.fillRect(0, 0, w, h);

      // Stars
      ctx!.fillStyle = "rgba(255,255,255,0.3)";
      for (let i = 0; i < 40; i++) {
        const sx = (i * 37 + frames * 0.2) % w;
        const sy = (i * 53 + frames * 0.5) % h;
        ctx!.fillRect(sx, sy, 1, 1);
      }

      // Ship
      ctx!.save();
      ctx!.translate(shipX, shipY);
      ctx!.beginPath();
      ctx!.moveTo(0, -shipSize);
      ctx!.lineTo(-shipSize * 0.7, shipSize * 0.5);
      ctx!.lineTo(shipSize * 0.7, shipSize * 0.5);
      ctx!.closePath();
      ctx!.fillStyle = "#8FD3FF";
      ctx!.fill();
      ctx!.restore();

      // Asteroids
      for (const a of asteroids) {
        ctx!.beginPath();
        ctx!.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx!.fillStyle = "#8B8680";
        ctx!.fill();
        ctx!.strokeStyle = "#6B6660";
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      // Score
      ctx!.fillStyle = "#8FD3FF";
      ctx!.font = '14px "Courier New", monospace';
      ctx!.textAlign = "left";
      ctx!.fillText(`TIME: ${Math.floor(frames / 60)}s`, 10, 25);

      if (alive) {
        animRef.current = requestAnimationFrame(gameLoop);
      }
    }

    animRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  useEffect(() => {
    if (playing && !gameOver) {
      const cleanup = startGame();
      return cleanup;
    }
  }, [playing, gameOver, startGame]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <Orbit className="w-16 h-16 text-accent-cyan/40 mx-auto mb-6" />
      <h1 className="font-heading text-6xl font-bold text-text-primary mb-4">
        404
      </h1>
      <p className="text-xl text-text-secondary mb-8">
        Lost in the asteroid belt. This page doesn&apos;t exist.
      </p>

      {!playing ? (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg text-accent-cyan font-semibold hover:bg-accent-cyan/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <button
            onClick={() => setPlaying(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-lg text-text-primary font-semibold hover:bg-white/10 transition-colors"
          >
            <Gamepad2 className="w-4 h-4" />
            Dodge Asteroids
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <canvas
            ref={canvasRef}
            className="rounded-xl border border-white/10 max-w-full"
            style={{ touchAction: "none" }}
          />
          {gameOver && (
            <div className="space-y-4">
              <p className="text-lg font-mono text-accent-cyan">
                Survived: {score}s
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    setGameOver(false);
                    setPlaying(true);
                  }}
                  className="px-6 py-3 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg text-accent-cyan font-semibold hover:bg-accent-cyan/20 transition-colors"
                >
                  Try Again
                </button>
                <Link
                  href="/"
                  className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg text-text-primary font-semibold hover:bg-white/10 transition-colors"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          )}
          {!gameOver && (
            <p className="text-xs text-text-secondary font-mono">
              Arrow keys or touch to move. Dodge the asteroids!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
