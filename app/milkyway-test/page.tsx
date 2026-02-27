import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SolarSystemLoader from "./SolarSystemLoader";

export const metadata = {
  title: "Solar System WebGL — TECH & SPACE",
  description: "Interactive 3D Solar System visualization",
};

export default function MilkyWayTestPage() {
  return (
    <main className="relative min-h-screen bg-[#050710]">
      {/* Back button */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 glass-card px-4 py-2 flex items-center gap-2 text-sm text-accent-cyan hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="font-mono text-xs">Natrag</span>
      </Link>

      {/* Title */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 text-center pointer-events-none">
        <h1 className="font-heading text-lg font-bold text-cyan-400">
          SOLAR SYSTEM
        </h1>
        <p className="text-[10px] font-mono text-cyan-400/50">
          // Three.js Interactive Visualization
        </p>
      </div>

      <SolarSystemLoader />
    </main>
  );
}
