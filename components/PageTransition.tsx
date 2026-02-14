"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { playSound } from "@/lib/sounds";

export default function PageTransition() {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scanLinePos, setScanLinePos] = useState(0);

  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip sound on initial page load
    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else {
      playSound("transition");
    }
    setIsTransitioning(true);
    setScanLinePos(0);

    // Scan line sweep
    const start = performance.now();
    const duration = 600;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setScanLinePos(progress * 100);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsTransitioning(false);
      }
    }

    requestAnimationFrame(animate);
  }, [pathname]);

  if (!isTransitioning) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-hidden="true">
      {/* Scan line sweep */}
      <div
        className="absolute left-0 right-0 h-[2px] bg-accent-cyan/60 shadow-[0_0_20px_rgba(143,211,255,0.4),0_0_60px_rgba(143,211,255,0.2)]"
        style={{
          top: `${scanLinePos}%`,
          transition: "none",
        }}
      />
      {/* Brief flash on edges */}
      <div
        className="absolute inset-0 border border-accent-cyan/20"
        style={{
          opacity: Math.max(0, 1 - scanLinePos / 30),
        }}
      />
    </div>
  );
}
