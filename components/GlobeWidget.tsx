"use client";

import { useRef, useEffect } from "react";
import Globe from "./Globe";
import type { GlobeHandle } from "./GlobeWrapper";
import type { GeoLocation } from "@/lib/types";

interface GlobeWidgetProps {
  geo: GeoLocation;
  categoryColor: string;
}

export default function GlobeWidget({ geo, categoryColor }: GlobeWidgetProps) {
  const globeRef = useRef<GlobeHandle>(null);

  useEffect(() => {
    // Auto-focus on mount after a brief delay for the globe to initialize
    const timer = setTimeout(() => {
      globeRef.current?.focusOn(geo);
    }, 1500);
    return () => clearTimeout(timer);
  }, [geo]);

  const pins = [
    {
      lat: geo.lat,
      lng: geo.lon,
      label: geo.name,
      color: categoryColor,
      id: "article-location",
    },
  ];

  return (
    <div className="glass-card p-4 !hover:transform-none">
      <h3 className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wider">
        Location
      </h3>
      <div className="flex justify-center">
        <Globe
          ref={globeRef}
          pins={pins}
          width={280}
          height={280}
          autoRotate={false}
        />
      </div>
      <p className="text-center text-sm text-text-secondary mt-2">{geo.name}</p>
    </div>
  );
}
