"use client";

import {
  Sun,
  Zap,
  Satellite,
  Radio,
  Sparkles,
  Camera,
  Moon,
} from "lucide-react";
import { useSpaceProData } from "@/lib/space-pro-data";

function KpGauge({ value }: { value: number }) {
  const color = value <= 3 ? "#34D399" : value <= 5 ? "#FFCF6E" : "#F87171";
  const pct = Math.min((value / 9) * 100, 100);

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-mono font-bold" style={{ color }}>
        Kp {value}
      </span>
    </div>
  );
}

export default function SpaceProDashboard() {
  const { data } = useSpaceProData();

  const auroraColors: Record<string, string> = {
    none: "#A7B3D1",
    low: "#34D399",
    moderate: "#FFCF6E",
    high: "#F87171",
    storm: "#EF4444",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-2">
          Space Pro — Live Telemetry
        </h1>
        <p className="text-sm text-text-secondary font-mono">
          // Data refreshes automatically when API is connected
        </p>
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Solar Activity */}
        <div className="glass-card p-6 space-y-4 !hover:transform-none">
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-yellow-400" />
            <h2 className="font-heading text-lg font-semibold text-text-primary">
              Solar Activity
            </h2>
          </div>
          <KpGauge value={data.solar.kpIndex} />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-text-secondary block text-xs">Flare Class</span>
              <p className="font-mono font-bold text-accent-amber text-lg">
                {data.solar.flareClass}
              </p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Solar Wind</span>
              <p className="font-mono font-bold text-text-primary text-lg">
                {data.solar.solarWind} <span className="text-xs text-text-secondary">km/s</span>
              </p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Aurora</span>
              <p
                className="font-mono font-bold capitalize text-lg"
                style={{ color: auroraColors[data.solar.auroraChance] || "#A7B3D1" }}
              >
                {data.solar.auroraChance}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Asteroids Today */}
        <div className="glass-card p-6 space-y-4 !hover:transform-none">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent-amber" />
            <h2 className="font-heading text-lg font-semibold text-text-primary">
              Asteroids Today
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-text-secondary block text-xs">Near-Earth</span>
              <p className="font-mono font-bold text-text-primary text-3xl">
                {data.asteroids.countToday}
              </p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Closest</span>
              <p className="font-mono font-bold text-accent-cyan text-xl">
                {data.asteroids.closestDistanceLD} LD
              </p>
              <p className="text-xs text-text-secondary">{data.asteroids.closestName}</p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Hazardous</span>
              <p className={`font-mono font-bold text-3xl ${data.asteroids.hazardousCount > 0 ? "text-red-400" : "text-green-400"}`}>
                {data.asteroids.hazardousCount}
              </p>
            </div>
          </div>
        </div>

        {/* 3. ISS Now */}
        <div className="glass-card p-6 space-y-4 !hover:transform-none">
          <div className="flex items-center gap-2">
            <Satellite className="w-5 h-5 text-accent-cyan" />
            <h2 className="font-heading text-lg font-semibold text-text-primary">
              ISS Now
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-secondary block text-xs">Altitude</span>
              <p className="font-mono font-bold text-text-primary text-2xl">
                {data.iss.altitude} <span className="text-xs text-text-secondary">km</span>
              </p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Speed</span>
              <p className="font-mono font-bold text-text-primary text-2xl">
                {data.iss.speed.toLocaleString()} <span className="text-xs text-text-secondary">km/h</span>
              </p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Position</span>
              <p className="font-mono font-bold text-accent-cyan">
                {data.iss.lat.toFixed(1)}°, {data.iss.lon.toFixed(1)}°
              </p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Crew</span>
              <p className="font-mono font-bold text-text-primary text-2xl">
                {data.iss.crew}
              </p>
            </div>
          </div>
        </div>

        {/* 4. Deep Space Network */}
        <div className="glass-card p-6 space-y-4 !hover:transform-none">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-purple-400" />
            <h2 className="font-heading text-lg font-semibold text-text-primary">
              Deep Space Network
            </h2>
          </div>
          <div className="space-y-3">
            {data.deepSpace.activeLinks.map((link) => (
              <div key={link.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${link.status === "active" ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                  <span className="font-mono font-semibold text-text-primary">{link.name}</span>
                </div>
                <span className="text-text-secondary font-mono text-xs">{link.distance}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Cosmic Events */}
        <div className="glass-card p-6 space-y-4 !hover:transform-none">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <h2 className="font-heading text-lg font-semibold text-text-primary">
              Cosmic Events
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-secondary block text-xs">Gravitational Waves</span>
              <p className="font-mono font-bold text-text-primary text-lg">
                {data.cosmic.recentGW || "None recent"}
              </p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Fast Radio Bursts</span>
              <p className="font-mono font-bold text-accent-cyan text-lg">
                {data.cosmic.frbCount} <span className="text-xs text-text-secondary">detected</span>
              </p>
            </div>
          </div>
        </div>

        {/* 6. APOD */}
        <div className="glass-card p-6 space-y-4 !hover:transform-none">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-pink-400" />
            <h2 className="font-heading text-lg font-semibold text-text-primary">
              Astronomy Picture of the Day
            </h2>
          </div>
          <div>
            <p className="font-semibold text-text-primary mb-2">{data.apod.title}</p>
            <p className="text-sm text-text-secondary leading-relaxed">{data.apod.description}</p>
            <p className="text-xs text-text-secondary/60 mt-2 font-mono">{data.apod.date}</p>
          </div>
        </div>

        {/* 7. Light & Moon (full width) */}
        <div className="glass-card p-6 space-y-4 md:col-span-2 !hover:transform-none">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-yellow-200" />
            <h2 className="font-heading text-lg font-semibold text-text-primary">
              Light & Moon
            </h2>
            <span className="ml-auto text-xs text-text-secondary font-mono">
              📍 {data.light.location}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-text-secondary block text-xs">Sunrise</span>
              <p className="font-mono font-bold text-accent-amber text-xl">{data.light.sunrise}</p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Sunset</span>
              <p className="font-mono font-bold text-orange-400 text-xl">{data.light.sunset}</p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Moon Phase</span>
              <p className="font-mono font-bold text-text-primary">{data.light.moonPhase}</p>
            </div>
            <div>
              <span className="text-text-secondary block text-xs">Illumination</span>
              <p className="font-mono font-bold text-yellow-200 text-xl">
                🌔 {data.light.moonIllumination}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
