"use client";

import { useEffect, useState, useRef } from "react";

const KONAMI_SEQUENCE = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "KeyB", "KeyA",
];

export default function KonamiCode() {
  const [active, setActive] = useState(false);
  const indexRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (active) return;

      const expected = KONAMI_SEQUENCE[indexRef.current];
      if (e.code === expected) {
        indexRef.current++;
        if (indexRef.current === KONAMI_SEQUENCE.length) {
          indexRef.current = 0;
          setActive(true);

          // Deactivate after 10s
          timeoutRef.current = setTimeout(() => setActive(false), 10000);
        }
      } else {
        indexRef.current = 0;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <>
      {/* Hue-rotate filter on starfield canvas */}
      <style jsx global>{`
        #space-stage-canvas {
          filter: hue-rotate(90deg) saturate(2) !important;
          transition: filter 0.5s ease;
        }
        .glass-card {
          border-color: rgba(255, 100, 255, 0.3) !important;
          box-shadow: 0 0 20px rgba(255, 100, 255, 0.1) !important;
        }
      `}</style>
      <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
        <div className="text-center animate-bounce">
          <p
            className="text-3xl sm:text-5xl font-heading font-bold"
            style={{
              background: "linear-gradient(90deg, #ff0080, #ff8c00, #40e0d0, #8a2be2, #ff0080)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "rainbow-shift 2s linear infinite",
            }}
          >
            SECRET MODE ACTIVATED
          </p>
        </div>
      </div>
      <style jsx global>{`
        @keyframes rainbow-shift {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </>
  );
}
