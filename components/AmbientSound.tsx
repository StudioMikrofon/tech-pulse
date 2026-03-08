"use client";

// Starts the ambient space drone on first user interaction.
// Respects the sound-enabled toggle from sounds.ts.

import { useEffect, useRef } from "react";
import { startAmbient, isSoundEnabled } from "@/lib/sounds";

export default function AmbientSound() {
  const started = useRef(false);

  useEffect(() => {
    function tryStart() {
      if (started.current) return;
      if (!isSoundEnabled()) return;
      started.current = true;
      startAmbient();
      window.removeEventListener("click",    tryStart);
      window.removeEventListener("keydown",  tryStart);
      window.removeEventListener("touchstart", tryStart);
    }

    window.addEventListener("click",     tryStart, { passive: true });
    window.addEventListener("keydown",   tryStart, { passive: true });
    window.addEventListener("touchstart", tryStart, { passive: true });

    return () => {
      window.removeEventListener("click",    tryStart);
      window.removeEventListener("keydown",  tryStart);
      window.removeEventListener("touchstart", tryStart);
    };
  }, []);

  return null;
}
