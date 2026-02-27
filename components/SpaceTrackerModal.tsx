"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X, Satellite, Radio, Zap, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { useSpaceProData, DSN_STATIONS } from "@/lib/space-pro-data";
import type { AsteroidDetail } from "@/lib/space-pro-data";

const GlobeComponent = dynamic(() => import("react-globe.gl"), { ssr: false });

type TrackerMode = "iss" | "dsn" | "asteroids" | "overview";

interface SpaceTrackerModalProps {
  mode: TrackerMode;
  open: boolean;
  onClose: () => void;
}

const TABS: { key: TrackerMode; label: string; icon: typeof Satellite }[] = [
  { key: "iss", label: "ISS", icon: Satellite },
  { key: "asteroids", label: "Asteroidi", icon: Zap },
  { key: "dsn", label: "DSN", icon: Radio },
];

// ISS orbit parameters
const ISS_INCLINATION = 51.6; // degrees
const ORBIT_POINTS = 120;

function generateOrbitArcs(issLat: number, issLon: number) {
  const arcs: { startLat: number; startLng: number; endLat: number; endLng: number; color: string }[] = [];
  const degPerStep = 360 / ORBIT_POINTS;

  for (let i = 0; i < ORBIT_POINTS; i++) {
    const angle1 = (i * degPerStep * Math.PI) / 180;
    const angle2 = ((i + 1) * degPerStep * Math.PI) / 180;

    // offset so orbit passes through current ISS position
    const lonOffset = issLon - Math.atan2(Math.sin(Math.asin(issLat / 90) || 0), Math.cos(0)) * (180 / Math.PI);

    const lat1 = ISS_INCLINATION * Math.sin(angle1);
    const lon1 = (((i * degPerStep) + lonOffset) % 360 + 360) % 360 - 180;
    const lat2 = ISS_INCLINATION * Math.sin(angle2);
    const lon2 = ((((i + 1) * degPerStep) + lonOffset) % 360 + 360) % 360 - 180;

    arcs.push({
      startLat: lat1,
      startLng: lon1,
      endLat: lat2,
      endLng: lon2,
      color: "rgba(0, 212, 255, 0.35)",
    });
  }
  return arcs;
}

// Mock enhanced data
const ISS_CREW = ["Oleg Kononenko", "Nikolai Chub", "Tracy Dyson", "Matthew Dominick", "Mike Barratt", "Jeanette Epps", "Alexander Grebenkin"];
const DSN_MISSIONS: Record<string, string[]> = {
  "Goldstone": ["Voyager 1", "Mars Reconnaissance Orbiter", "JWST"],
  "Canberra": ["Voyager 2", "New Horizons", "Juno"],
  "Madrid": ["Parker Solar Probe", "OSIRIS-REx", "Psyche"],
};

function AsteroidDistanceBar({ asteroid }: { asteroid: AsteroidDetail }) {
  const maxLD = 20;
  const pct = Math.min((asteroid.distanceLD / maxLD) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-mono text-text-primary">{asteroid.name}</span>
        <span className={`font-mono ${asteroid.hazardous ? "text-red-400" : "text-green-400"}`}>
          {asteroid.distanceLD} LD
        </span>
      </div>
      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="absolute left-0 top-0 w-2 h-2 rounded-full bg-blue-400 z-10" />
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: asteroid.hazardous
              ? "linear-gradient(90deg, #EF4444, #F87171)"
              : "linear-gradient(90deg, #00D4FF, #34D399)",
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-secondary">
        <span>{asteroid.diameterM}m</span>
        <span>{(asteroid.speedKmH / 1000).toFixed(1)}k km/h</span>
      </div>
    </div>
  );
}

export default function SpaceTrackerModal({ mode, open, onClose }: SpaceTrackerModalProps) {
  const [activeTab, setActiveTab] = useState<TrackerMode>(mode);
  const { data } = useSpaceProData();
  const globeRef = useRef<any>(null);
  const [wireframeUrl, setWireframeUrl] = useState<string | null>(null);
  const [selectedAsteroid, setSelectedAsteroid] = useState<AsteroidDetail | null>(null);
  const [globeSize, setGlobeSize] = useState({ w: 500, h: 500 });

  // Generate wireframe texture on mount
  useEffect(() => {
    if (!open) return;
    import("@/lib/wireframe-texture").then(({ generateWireframeTexture }) => {
      setWireframeUrl(generateWireframeTexture());
    });
  }, [open]);

  // Sync tab with mode prop
  useEffect(() => {
    setActiveTab(mode);
  }, [mode]);

  // Responsive globe sizing
  useEffect(() => {
    if (!open) return;
    function calcSize() {
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        setGlobeSize({
          w: Math.min(window.innerWidth - 32, 400),
          h: Math.min(window.innerHeight * 0.35, 350),
        });
      } else {
        setGlobeSize({
          w: Math.min(window.innerWidth * 0.55, 700),
          h: Math.min(window.innerHeight * 0.75, 650),
        });
      }
    }
    calcSize();
    window.addEventListener("resize", calcSize);
    return () => window.removeEventListener("resize", calcSize);
  }, [open]);

  const handleClose = useCallback(() => {
    setSelectedAsteroid(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, handleClose]);

  // ISS orbit arcs
  const orbitArcs = useMemo(() => {
    if (activeTab !== "iss") return [];
    return generateOrbitArcs(data.iss.lat, data.iss.lon);
  }, [activeTab, data.iss.lat, data.iss.lon]);

  // Globe markers
  const htmlElementsData = useMemo(() => {
    const markers: any[] = [];

    markers.push({
      lat: data.iss.lat,
      lng: data.iss.lon,
      type: "iss",
      label: `ISS — ${data.iss.altitude}km, ${data.iss.speed.toLocaleString()}km/h`,
      color: "#00D4FF",
    });

    DSN_STATIONS.forEach((s) => {
      markers.push({
        lat: s.lat,
        lng: s.lon,
        type: "dsn",
        label: `${s.name} (${s.country})`,
        color: "#34D399",
      });
    });

    markers.push({
      lat: 45.815,
      lng: 15.9819,
      type: "user",
      label: "Zagreb",
      color: "#FFCF6E",
    });

    return markers;
  }, [data.iss.lat, data.iss.lon, data.iss.altitude, data.iss.speed]);

  if (!open) return null;

  // Orbital period in minutes
  const orbitalPeriodMin = 92.68;
  const nextPassMin = Math.round(Math.random() * 40 + 15);

  return (
    <div className="fixed inset-0 z-[80] flex">
      {/* Backdrop — stopPropagation prevents SpaceProDrawer click-outside from firing */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {/* Content — responsive flex direction */}
      <div className="relative z-10 flex flex-col sm:flex-row w-full h-full">
        {/* Globe area */}
        <div className="flex-1 flex items-center justify-center relative min-h-[40vh] sm:min-h-0">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-20 p-2 text-text-secondary hover:text-text-primary transition-colors glass-card cursor-pointer"
            aria-label="Zatvori"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Radial grid background */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(0, 212, 255, 0.1) 0%, transparent 70%)",
            }}
          />

          {wireframeUrl && (
            <div className="cursor-grab active:cursor-grabbing">
              <GlobeComponent
                ref={globeRef}
                width={globeSize.w}
                height={globeSize.h}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl={wireframeUrl}
                atmosphereColor="#00D4FF"
                atmosphereAltitude={0.15}
                htmlElementsData={htmlElementsData}
                htmlLat="lat"
                htmlLng="lng"
                htmlAltitude={0.04}
                htmlElement={(d: any) => {
                  const el = document.createElement("div");
                  el.style.cssText = "position:relative;cursor:pointer;";

                  const dot = document.createElement("div");
                  const isPulsing = d.type === "iss";
                  dot.style.cssText = `
                    width: ${d.type === "iss" ? "12px" : "8px"};
                    height: ${d.type === "iss" ? "12px" : "8px"};
                    border-radius: 50%;
                    background: ${d.color};
                    box-shadow: 0 0 8px ${d.color}, 0 0 20px ${d.color}40;
                    ${isPulsing ? "animation: pulse 2s infinite;" : ""}
                  `;
                  el.appendChild(dot);

                  const label = document.createElement("div");
                  label.textContent = d.label;
                  label.style.cssText = `
                    position: absolute;
                    bottom: 16px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(5, 7, 13, 0.9);
                    backdrop-filter: blur(8px);
                    border: 1px solid ${d.color}40;
                    color: ${d.color};
                    font-size: 11px;
                    font-family: monospace;
                    padding: 4px 8px;
                    border-radius: 4px;
                    white-space: nowrap;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s;
                  `;
                  el.appendChild(label);

                  el.addEventListener("mouseenter", () => { label.style.opacity = "1"; });
                  el.addEventListener("mouseleave", () => { label.style.opacity = "0"; });
                  el.addEventListener("touchstart", () => {
                    label.style.opacity = label.style.opacity === "1" ? "0" : "1";
                  }, { passive: true });

                  return el;
                }}
                arcsData={orbitArcs}
                arcStartLat="startLat"
                arcStartLng="startLng"
                arcEndLat="endLat"
                arcEndLng="endLng"
                arcColor="color"
                arcAltitude={0.005}
                arcStroke={0.8}
                arcDashLength={0.4}
                arcDashGap={0.2}
                arcDashAnimateTime={3000}
                animateIn={true}
              />
            </div>
          )}

          {/* Title overlay */}
          <div className="absolute top-4 left-4 z-10">
            <h2 className="font-heading text-lg font-bold text-cyan-400">
              SPACE TRACKER
            </h2>
            <p className="text-xs font-mono text-cyan-400/60">
              // Jarvis Blueprint Mode
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full sm:w-[360px] bg-space-bg/95 backdrop-blur-xl border-l border-cyan-500/20 overflow-y-auto flex flex-col max-h-[60vh] sm:max-h-full">
          {/* Tabs */}
          <div className="flex border-b border-cyan-500/20">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedAsteroid(null); }}
                  className={`flex-1 py-3 px-2 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 p-4 space-y-4">
            {activeTab === "iss" && (
              <>
                <div className="glass-card p-4 space-y-3 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                    <h3 className="text-sm font-semibold text-cyan-400 font-mono">
                      ISS STATUS
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-text-secondary">Visina</span>
                      <p className="font-mono font-bold text-text-primary text-lg">
                        {data.iss.altitude} km
                      </p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Brzina</span>
                      <p className="font-mono font-bold text-text-primary text-lg">
                        {data.iss.speed.toLocaleString()} km/h
                      </p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Latituda</span>
                      <p className="font-mono font-bold text-cyan-400">
                        {data.iss.lat.toFixed(2)}°
                      </p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Longituda</span>
                      <p className="font-mono font-bold text-cyan-400">
                        {data.iss.lon.toFixed(2)}°
                      </p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Orbitalni period</span>
                      <p className="font-mono font-bold text-text-primary">
                        {orbitalPeriodMin} min
                      </p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Sljedeći prolaz</span>
                      <p className="font-mono font-bold text-accent-amber">
                        ~{nextPassMin} min
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-text-secondary">Posada ({data.iss.crew})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ISS_CREW.slice(0, data.iss.crew).map((name) => (
                          <span key={name} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400/80">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-text-secondary font-mono text-center">
                  Orbit trajectory prikazan na globeu — inklinacija {ISS_INCLINATION}°
                </div>
              </>
            )}

            {activeTab === "asteroids" && (
              <>
                <div className="glass-card p-4 space-y-3 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-accent-amber" />
                    <h3 className="text-sm font-semibold text-text-primary font-mono">
                      NEO DANAS — {data.asteroids.countToday}
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {data.asteroids.asteroidList.map((a) => (
                      <button
                        key={a.name}
                        onClick={() => setSelectedAsteroid(selectedAsteroid?.name === a.name ? null : a)}
                        className={`w-full text-left p-2 rounded-lg transition-colors cursor-pointer ${
                          selectedAsteroid?.name === a.name
                            ? "bg-cyan-400/10 border border-cyan-400/30"
                            : "hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono font-bold text-text-primary flex items-center gap-1.5">
                            {a.hazardous && <span className="text-red-400">!</span>}
                            {a.name}
                          </span>
                          <span className={`font-mono ${a.hazardous ? "text-red-400" : "text-green-400"}`}>
                            {a.distanceLD} LD
                          </span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-text-secondary">
                          <span>{a.diameterM}m</span>
                          <span>{(a.speedKmH / 1000).toFixed(1)}k km/h</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedAsteroid && (
                  <div className="glass-card p-4 space-y-2 !hover:transform-none border-cyan-500/20">
                    <h4 className="text-xs font-mono text-cyan-400 mb-2">
                      UDALJENOST — {selectedAsteroid.name}
                    </h4>
                    <AsteroidDistanceBar asteroid={selectedAsteroid} />
                    <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                      <div>
                        <span className="text-text-secondary">Promjer</span>
                        <p className="font-mono font-bold text-text-primary">
                          {selectedAsteroid.diameterM}m
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Brzina</span>
                        <p className="font-mono font-bold text-text-primary">
                          {selectedAsteroid.speedKmH.toLocaleString()} km/h
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Udaljenost</span>
                        <p className="font-mono font-bold text-cyan-400">
                          {(selectedAsteroid.distanceLD * 384400).toLocaleString()} km
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Opasan</span>
                        <p className={`font-mono font-bold ${selectedAsteroid.hazardous ? "text-red-400" : "text-green-400"}`}>
                          {selectedAsteroid.hazardous ? "DA" : "NE"}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Najbliži prolaz</span>
                        <p className="font-mono font-bold text-accent-amber">
                          Danas
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Energija udara</span>
                        <p className="font-mono font-bold text-red-400/80">
                          {(selectedAsteroid.diameterM * selectedAsteroid.speedKmH * 0.001).toFixed(1)} kt
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === "dsn" && (
              <>
                <div className="glass-card p-4 space-y-3 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Radio className="w-3.5 h-3.5 text-purple-400" />
                    <h3 className="text-sm font-semibold text-text-primary font-mono">
                      DSN STANICE
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {DSN_STATIONS.map((s) => (
                      <div
                        key={s.name}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                          <div className="flex-1">
                            <p className="text-xs font-mono font-bold text-text-primary">
                              {s.name}
                            </p>
                            <p className="text-[10px] text-text-secondary">
                              {s.country} — {s.lat.toFixed(2)}°, {s.lon.toFixed(2)}°
                            </p>
                          </div>
                          <MapPin className="w-3 h-3 text-text-secondary" />
                        </div>
                        {/* Signal + missions */}
                        <div className="mt-1.5 ml-5.5 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-text-secondary">Signal:</span>
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map((bar) => (
                                <div
                                  key={bar}
                                  className={`w-1 rounded-full ${bar <= 4 ? "bg-green-400" : "bg-white/10"}`}
                                  style={{ height: `${bar * 3 + 4}px` }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(DSN_MISSIONS[s.name] || []).map((m) => (
                              <span key={m} className="text-[9px] font-mono px-1 py-0.5 rounded bg-purple-400/10 text-purple-400/80">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card p-4 space-y-3 !hover:transform-none border-cyan-500/20">
                  <h4 className="text-xs font-mono text-purple-400 mb-2">
                    AKTIVNE SONDE
                  </h4>
                  <div className="space-y-2">
                    {data.deepSpace.activeLinks.map((link) => (
                      <div
                        key={link.name}
                        className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              link.status === "active"
                                ? "bg-green-400 animate-pulse"
                                : "bg-gray-500"
                            }`}
                          />
                          <span className="font-mono text-text-primary">
                            {link.name}
                          </span>
                        </div>
                        <span className="text-text-secondary font-mono">
                          {link.distance}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
