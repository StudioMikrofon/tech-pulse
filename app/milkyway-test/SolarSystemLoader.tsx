"use client";

import dynamic from "next/dynamic";

const SolarSystemWebGL = dynamic(
  () => import("@/components/SolarSystemWebGL"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-screen bg-[#050710]">
        <div className="text-sm font-mono text-cyan-400/60 animate-pulse">
          Loading Solar System...
        </div>
      </div>
    ),
  }
);

export default function SolarSystemLoader() {
  return <SolarSystemWebGL />;
}
