"use client";

import { useState } from "react";
import { useSpaceProData } from "@/lib/space-pro-data";
import SpaceProDrawer from "./SpaceProDrawer";

function KpColor(kp: number): string {
  if (kp <= 3) return "#34D399";
  if (kp <= 5) return "#FFCF6E";
  return "#F87171";
}

export default function SpaceBar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data } = useSpaceProData(30000);

  const kp = data.solar?.kp_index ?? 0;
  const flare = data.solar?.flare_class ?? "—";
  const neos = data.neo_count ?? 0;
  const issAlt = data.iss?.altitude ?? 420;
  const crew = data.crew_count ?? 0;

  return (
    <>
      <div
        className="max-w-7xl mx-auto px-4 mb-4 cursor-pointer"
        onClick={() => setDrawerOpen(true)}
      >
        <div className="glass-card px-4 py-2 !hover:transform-none flex items-center justify-center gap-4 sm:gap-6 text-xs font-mono overflow-x-auto">
          <div
            className="flex items-center gap-1.5 whitespace-nowrap"
            title="Kp indeks — geomagnetska aktivnost (0-9). Viši = jača magnetska oluja."
          >
            <span className="text-text-secondary">Kp</span>
            <span className="font-bold" style={{ color: KpColor(kp) }}>
              {kp}
            </span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div
            className="flex items-center gap-1.5 whitespace-nowrap"
            title="Solarna baklja — klasa trenutne erupcije na Suncu (A/B/C/M/X)."
          >
            <span className="text-text-secondary">Baklja</span>
            <span className="font-bold text-accent-amber">{flare}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div
            className="flex items-center gap-1.5 whitespace-nowrap"
            title="Objekti blizu Zemlje — asteroidi praćeni danas od NASA-e."
          >
            <span className="text-text-secondary">NEOs</span>
            <span className="font-bold text-text-primary">{neos}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div
            className="flex items-center gap-1.5 whitespace-nowrap"
            title="ISS — Međunarodna svemirska postaja, trenutna visina orbite."
          >
            <span className="text-text-secondary">ISS</span>
            <span className="font-bold text-accent-cyan">{issAlt} km</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div
            className="flex items-center gap-1.5 whitespace-nowrap"
            title="Broj ljudi trenutno u svemiru."
          >
            <span className="text-text-secondary">Ljudi</span>
            <span className="font-bold text-yellow-200">👨‍🚀 {crew}</span>
          </div>
        </div>
      </div>

      <SpaceProDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
