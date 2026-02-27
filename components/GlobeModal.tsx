"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Globe2 } from "lucide-react";
import dynamic from "next/dynamic";
import type { GlobeHandle } from "./GlobeWrapper";
import type { GeoLocation } from "@/lib/types";

const Globe = dynamic(() => import("./Globe"), { ssr: false });

interface Pin {
  lat: number;
  lng: number;
  label: string;
  color: string;
  id: string;
}

interface GlobeModalProps {
  pins: Pin[];
  initialGeo?: GeoLocation;
}

export default function GlobeModal({ pins, initialGeo }: GlobeModalProps) {
  const [open, setOpen] = useState(false);
  const globeRef = useRef<GlobeHandle>(null);

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, handleClose]);

  // Focus globe on initial geo after open
  useEffect(() => {
    if (open && initialGeo) {
      const timer = setTimeout(() => {
        globeRef.current?.focusOn(initialGeo);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [open, initialGeo]);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-[55] glass-card px-4 py-3 flex items-center gap-2 text-sm text-accent-cyan hover:text-text-primary transition-colors cursor-pointer hover:border-accent-cyan/30"
        aria-label="Open interactive globe"
      >
        <Globe2 className="w-4 h-4" />
        <span className="hidden sm:inline font-mono text-xs">Open Globe</span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-space-bg/80 backdrop-blur-md globe-modal-backdrop"
            onClick={handleClose}
          />

          {/* Content */}
          <div className="relative z-10 w-full h-full md:w-[70vw] md:h-[70vh] md:max-w-[1000px] flex items-center justify-center">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 p-2 text-text-secondary hover:text-text-primary transition-colors glass-card cursor-pointer"
              aria-label="Close globe"
            >
              <X className="w-5 h-5" />
            </button>

            <div
              className="cursor-grab active:cursor-grabbing w-full h-full flex items-center justify-center"
              style={{ pointerEvents: "auto" }}
            >
              <Globe
                ref={globeRef}
                pins={pins}
                width={typeof window !== "undefined" ? Math.min(window.innerWidth * 0.65, 900) : 600}
                height={typeof window !== "undefined" ? Math.min(window.innerHeight * 0.65, 700) : 500}
                autoRotate={true}
                enableZoom={true}
                initialAltitude={1.8}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
