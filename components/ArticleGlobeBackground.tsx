"use client";

import { useRef, useEffect, useState } from "react";
import Globe from "./Globe";
import type { GlobeHandle } from "./GlobeWrapper";
import type { GeoLocation } from "@/lib/types";

interface ArticleGlobeBackgroundProps {
  geo: GeoLocation;
  categoryColor: string;
}

export default function ArticleGlobeBackground({
  geo,
  categoryColor,
}: ArticleGlobeBackgroundProps) {
  const globeRef = useRef<GlobeHandle>(null);
  const [globeSize, setGlobeSize] = useState(900);

  useEffect(() => {
    function updateSize() {
      setGlobeSize(Math.max(window.innerWidth, window.innerHeight) * 1.15);
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Focus on geo location after globe loads
  useEffect(() => {
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
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none opacity-[0.22] z-[1]">
      <div className="globe-glow">
        <Globe
          ref={globeRef}
          pins={pins}
          width={globeSize}
          height={globeSize}
          autoRotate={false}
          enableZoom={false}
          initialAltitude={1.6}
        />
      </div>
    </div>
  );
}
