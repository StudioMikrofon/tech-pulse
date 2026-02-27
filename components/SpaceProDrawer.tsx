"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import {
  X,
  Sun,
  Zap,
  Satellite,
  Radio,
  Sparkles,
  Camera,
  Moon,
  Info,
} from "lucide-react";
import { useSpaceProData } from "@/lib/space-pro-data";

interface SpaceProDrawerProps {
  open: boolean;
  onClose: () => void;
}

const INFO_TEXTS: Record<string, string> = {
  solar:
    "Kp indeks mjeri geomagnetsku aktivnost Zemlje (0-9). Viši = jača magnetska oluja i veća šansa za auroru.",
  flare:
    "Solarna baklja je iznenadni bljesak na Suncu. Klase: A (slaba), B, C, M, X (najjača).",
  wind: "Tok nabijenih čestica sa Sunca. Normalna brzina ~400 km/s.",
  asteroids:
    "Objekti blizu Zemlje praćeni od NASA-e. LD = Lunarna Distanca (~384,400 km).",
  iss: "Međunarodna svemirska postaja kruži Zemljom na ~420 km visine brzinom ~27,600 km/h.",
  deepspace:
    "NASA-ina mreža antena koja komunicira sa sondama u dubokom svemiru.",
  cosmic:
    "Gravitacijski valovi = valovi u prostorvremenu. FRB = misteriozni kratki radio signali iz svemira.",
  apod: "NASA svaki dan objavi novu astronomsku sliku s objašnjenjem.",
  light:
    "Faze Mjeseca i dnevno svjetlo za vašu lokaciju.",
};

function KpGauge({ value }: { value: number }) {
  const color =
    value <= 3 ? "#34D399" : value <= 5 ? "#FFCF6E" : "#F87171";
  const pct = Math.min((value / 9) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>
        Kp {value}
      </span>
    </div>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {label}
    </span>
  );
}

function InfoToggle({
  id,
  expandedInfo,
  setExpandedInfo,
}: {
  id: string;
  expandedInfo: string | null;
  setExpandedInfo: (id: string | null) => void;
}) {
  return (
    <button
      onClick={() => setExpandedInfo(expandedInfo === id ? null : id)}
      className="p-1 text-text-secondary hover:text-accent-cyan transition-colors cursor-pointer"
      aria-label="Info"
    >
      <Info className="w-3.5 h-3.5" />
    </button>
  );
}

function InfoPanel({ id, expandedInfo }: { id: string; expandedInfo: string | null }) {
  if (expandedInfo !== id || !INFO_TEXTS[id]) return null;
  return (
    <div className="glass-card p-2.5 text-xs text-text-secondary leading-relaxed !hover:transform-none">
      {INFO_TEXTS[id]}
    </div>
  );
}

export default function SpaceProDrawer({ open, onClose }: SpaceProDrawerProps) {
  const { data } = useSpaceProData();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [expandedInfo, setExpandedInfo] = useState<string | null>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, handleEscape, handleClickOutside]);

  if (!open) return null;

  const auroraColors: Record<string, string> = {
    none: "#A7B3D1",
    low: "#34D399",
    moderate: "#FFCF6E",
    high: "#F87171",
    storm: "#EF4444",
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm drawer-backdrop" />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 z-[60] h-full w-full sm:w-[400px] bg-space-bg/95 backdrop-blur-xl border-l border-white/10 overflow-y-auto drawer-slide-in"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-space-bg/90 backdrop-blur-md border-b border-white/10 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-text-primary">
              Space Pro
            </h2>
            <p className="text-xs text-text-secondary font-mono">
              // Telemetrija uživo
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Zatvori"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cards */}
        <div className="p-5 space-y-4">
          {/* 1. Sunčeva Aktivnost */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-semibold text-text-primary">
                Sunčeva Aktivnost
              </h3>
              <InfoToggle id="solar" expandedInfo={expandedInfo} setExpandedInfo={setExpandedInfo} />
              <div className="ml-auto">
                <StatusBadge label="Uživo" color="#34D399" />
              </div>
            </div>
            <InfoPanel id="solar" expandedInfo={expandedInfo} />
            <KpGauge value={data.solar.kpIndex} />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Baklja</span>
                <p className="font-mono font-bold text-accent-amber">
                  {data.solar.flareClass}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Sunčev Vjetar</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.solar.solarWind} km/s
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-text-secondary">Aurora</span>
                <p
                  className="font-mono font-bold capitalize"
                  style={{
                    color: auroraColors[data.solar.auroraChance] || "#A7B3D1",
                  }}
                >
                  {data.solar.auroraChance}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Asteroidi Danas */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent-amber" />
              <h3 className="text-sm font-semibold text-text-primary">
                Asteroidi Danas
              </h3>
              <InfoToggle id="asteroids" expandedInfo={expandedInfo} setExpandedInfo={setExpandedInfo} />
              <div className="ml-auto">
                <StatusBadge label="Uživo" color="#34D399" />
              </div>
            </div>
            <InfoPanel id="asteroids" expandedInfo={expandedInfo} />
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Broj</span>
                <p className="font-mono font-bold text-text-primary text-lg">
                  {data.asteroids.countToday}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Najbliži</span>
                <p className="font-mono font-bold text-accent-cyan">
                  {data.asteroids.closestDistanceLD} LD
                </p>
                <p className="text-text-secondary truncate">
                  {data.asteroids.closestName}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Opasni</span>
                <p
                  className={`font-mono font-bold text-lg ${
                    data.asteroids.hazardousCount > 0
                      ? "text-red-400"
                      : "text-green-400"
                  }`}
                >
                  {data.asteroids.hazardousCount}
                </p>
              </div>
            </div>
          </div>

          {/* 3. ISS Trenutno */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Satellite className="w-4 h-4 text-accent-cyan" />
              <h3 className="text-sm font-semibold text-text-primary">
                ISS Trenutno
              </h3>
              <InfoToggle id="iss" expandedInfo={expandedInfo} setExpandedInfo={setExpandedInfo} />
              <div className="ml-auto">
                <StatusBadge label="Uživo" color="#34D399" />
              </div>
            </div>
            <InfoPanel id="iss" expandedInfo={expandedInfo} />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Visina</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.iss.altitude} km
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Brzina</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.iss.speed.toLocaleString()} km/h
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Pozicija</span>
                <p className="font-mono font-bold text-accent-cyan text-xs">
                  {data.iss.lat.toFixed(1)}°, {data.iss.lon.toFixed(1)}°
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Posada</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.iss.crew}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Mreža Dubokog Svemira */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-text-primary">
                Mreža Dubokog Svemira
              </h3>
              <InfoToggle id="deepspace" expandedInfo={expandedInfo} setExpandedInfo={setExpandedInfo} />
              <div className="ml-auto">
                <StatusBadge label="Uživo" color="#34D399" />
              </div>
            </div>
            <InfoPanel id="deepspace" expandedInfo={expandedInfo} />
            <div className="space-y-2">
              {data.deepSpace.activeLinks.map((link) => (
                <div
                  key={link.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-text-primary">
                    {link.name}
                  </span>
                  <span className="text-text-secondary">{link.distance}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      link.status === "active"
                        ? "bg-green-400"
                        : "bg-gray-500"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 5. Kozmički Događaji */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <h3 className="text-sm font-semibold text-text-primary">
                Kozmički Događaji
              </h3>
              <InfoToggle id="cosmic" expandedInfo={expandedInfo} setExpandedInfo={setExpandedInfo} />
              <div className="ml-auto">
                <StatusBadge label="Uživo" color="#34D399" />
              </div>
            </div>
            <InfoPanel id="cosmic" expandedInfo={expandedInfo} />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Gravitacijski Valovi</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.cosmic.recentGW || "Nema nedavnih"}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">
                  Brzi Radio Bljeskovi
                </span>
                <p className="font-mono font-bold text-accent-cyan">
                  {data.cosmic.frbCount} detektirano
                </p>
              </div>
            </div>
          </div>

          {/* 6. Astronomska Slika Dana */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-semibold text-text-primary">
                Astronomska Slika Dana
              </h3>
              <InfoToggle id="apod" expandedInfo={expandedInfo} setExpandedInfo={setExpandedInfo} />
              <div className="ml-auto">
                <StatusBadge label="Dnevno" color="#A78BFA" />
              </div>
            </div>
            <InfoPanel id="apod" expandedInfo={expandedInfo} />
            <div className="text-xs">
              <p className="font-semibold text-text-primary mb-1">
                {data.apod.title}
              </p>
              <p className="text-text-secondary line-clamp-3">
                {data.apod.description}
              </p>
            </div>
          </div>

          {/* 7. Svjetlost i Mjesec */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-yellow-200" />
              <h3 className="text-sm font-semibold text-text-primary">
                Svjetlost i Mjesec
              </h3>
              <InfoToggle id="light" expandedInfo={expandedInfo} setExpandedInfo={setExpandedInfo} />
              <div className="ml-auto">
                <StatusBadge label="Uživo" color="#34D399" />
              </div>
            </div>
            <InfoPanel id="light" expandedInfo={expandedInfo} />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Izlazak Sunca</span>
                <p className="font-mono font-bold text-accent-amber">
                  {data.light.sunrise}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Zalazak Sunca</span>
                <p className="font-mono font-bold text-orange-400">
                  {data.light.sunset}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Faza Mjeseca</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.light.moonPhase}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Osvijetljenost</span>
                <p className="font-mono font-bold text-yellow-200">
                  🌔 {data.light.moonIllumination}%
                </p>
              </div>
            </div>
            <p className="text-xs text-text-secondary font-mono">
              📍 {data.light.location}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
