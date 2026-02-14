"use client";

import SolarSystem from "./SolarSystem";

interface SolarSystemBackgroundProps {
  highlightPlanet?: string;
}

export default function SolarSystemBackground({
  highlightPlanet,
}: SolarSystemBackgroundProps) {
  return (
    <div className="fixed inset-0 pointer-events-none opacity-20 z-[1]">
      <SolarSystem highlightPlanet={highlightPlanet} />
    </div>
  );
}
