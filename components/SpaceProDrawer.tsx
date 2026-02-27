"use client";

import { useEffect, useCallback, useRef } from "react";
import {
  X,
  Sun,
  Zap,
  Satellite,
  Radio,
  Sparkles,
  Camera,
  Moon,
} from "lucide-react";
import { useSpaceProData } from "@/lib/space-pro-data";

interface SpaceProDrawerProps {
  open: boolean;
  onClose: () => void;
}

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

export default function SpaceProDrawer({ open, onClose }: SpaceProDrawerProps) {
  const { data } = useSpaceProData();
  const drawerRef = useRef<HTMLDivElement>(null);

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
              // Live telemetry
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cards */}
        <div className="p-5 space-y-4">
          {/* 1. Solar Activity */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-semibold text-text-primary">
                Solar Activity
              </h3>
              <div className="ml-auto">
                <StatusBadge label="Live" color="#34D399" />
              </div>
            </div>
            <KpGauge value={data.solar.kpIndex} />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Flare</span>
                <p className="font-mono font-bold text-accent-amber">
                  {data.solar.flareClass}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Solar Wind</span>
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

          {/* 2. Asteroids Today */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent-amber" />
              <h3 className="text-sm font-semibold text-text-primary">
                Asteroids Today
              </h3>
              <div className="ml-auto">
                <StatusBadge label="Live" color="#34D399" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Count</span>
                <p className="font-mono font-bold text-text-primary text-lg">
                  {data.asteroids.countToday}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Closest</span>
                <p className="font-mono font-bold text-accent-cyan">
                  {data.asteroids.closestDistanceLD} LD
                </p>
                <p className="text-text-secondary truncate">
                  {data.asteroids.closestName}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Hazardous</span>
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

          {/* 3. ISS Now */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Satellite className="w-4 h-4 text-accent-cyan" />
              <h3 className="text-sm font-semibold text-text-primary">
                ISS Now
              </h3>
              <div className="ml-auto">
                <StatusBadge label="Live" color="#34D399" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Altitude</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.iss.altitude} km
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Speed</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.iss.speed.toLocaleString()} km/h
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Position</span>
                <p className="font-mono font-bold text-accent-cyan text-xs">
                  {data.iss.lat.toFixed(1)}°, {data.iss.lon.toFixed(1)}°
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Crew</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.iss.crew}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Deep Space Network */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-text-primary">
                Deep Space Network
              </h3>
              <div className="ml-auto">
                <StatusBadge label="Live" color="#34D399" />
              </div>
            </div>
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

          {/* 5. Cosmic Events */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <h3 className="text-sm font-semibold text-text-primary">
                Cosmic Events
              </h3>
              <div className="ml-auto">
                <StatusBadge label="Live" color="#34D399" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Gravitational Waves</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.cosmic.recentGW || "None recent"}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">
                  Fast Radio Bursts
                </span>
                <p className="font-mono font-bold text-accent-cyan">
                  {data.cosmic.frbCount} detected
                </p>
              </div>
            </div>
          </div>

          {/* 6. APOD */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-semibold text-text-primary">
                APOD
              </h3>
              <div className="ml-auto">
                <StatusBadge label="Daily" color="#A78BFA" />
              </div>
            </div>
            <div className="text-xs">
              <p className="font-semibold text-text-primary mb-1">
                {data.apod.title}
              </p>
              <p className="text-text-secondary line-clamp-3">
                {data.apod.description}
              </p>
            </div>
          </div>

          {/* 7. Light & Moon */}
          <div className="glass-card p-4 space-y-3 !hover:transform-none">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-yellow-200" />
              <h3 className="text-sm font-semibold text-text-primary">
                Light & Moon
              </h3>
              <div className="ml-auto">
                <StatusBadge label="Live" color="#34D399" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Sunrise</span>
                <p className="font-mono font-bold text-accent-amber">
                  {data.light.sunrise}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Sunset</span>
                <p className="font-mono font-bold text-orange-400">
                  {data.light.sunset}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Moon Phase</span>
                <p className="font-mono font-bold text-text-primary">
                  {data.light.moonPhase}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Illumination</span>
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
