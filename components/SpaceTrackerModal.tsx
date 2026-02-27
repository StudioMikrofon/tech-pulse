"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X, Satellite, Radio, Zap, Globe, Sun, Crosshair, Activity, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { useSpaceProData, DSN_STATIONS } from "@/lib/space-pro-data";
import type { AsteroidDetail } from "@/lib/space-pro-data";
import {
  DSN_GROUND_STATIONS,
  ISS_CREW_NAMES,
  ISS_ORBITAL_PERIOD,
  ISS_INCLINATION,
  getTelemetryStub,
} from "@/lib/space-tracker-data";

const GlobeComponent = dynamic(() => import("react-globe.gl"), { ssr: false });
const SolarSystemTracker = dynamic(() => import("./SolarSystemTracker"), { ssr: false });
const NEOTracker = dynamic(() => import("./NEOTracker"), { ssr: false });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TrackerMode = "iss" | "dsn" | "asteroids" | "overview";
type ViewMode = "earth" | "solar" | "neo";

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

const VIEW_MODES: { key: ViewMode; label: string; icon: typeof Globe }[] = [
  { key: "earth", label: "Earth", icon: Globe },
  { key: "solar", label: "Solar", icon: Sun },
  { key: "neo", label: "NEO", icon: Crosshair },
];

// ---------------------------------------------------------------------------
// ISS orbit arcs
// ---------------------------------------------------------------------------

const ORBIT_POINTS = 120;

function generateOrbitArcs(issLat: number, issLon: number) {
  const arcs: { startLat: number; startLng: number; endLat: number; endLng: number; color: string }[] = [];
  const degPerStep = 360 / ORBIT_POINTS;
  for (let i = 0; i < ORBIT_POINTS; i++) {
    const angle1 = (i * degPerStep * Math.PI) / 180;
    const angle2 = ((i + 1) * degPerStep * Math.PI) / 180;
    const lonOffset = issLon - Math.atan2(Math.sin(Math.asin(issLat / 90) || 0), Math.cos(0)) * (180 / Math.PI);
    const lat1 = ISS_INCLINATION * Math.sin(angle1);
    const lon1 = (((i * degPerStep) + lonOffset) % 360 + 360) % 360 - 180;
    const lat2 = ISS_INCLINATION * Math.sin(angle2);
    const lon2 = ((((i + 1) * degPerStep) + lonOffset) % 360 + 360) % 360 - 180;
    arcs.push({ startLat: lat1, startLng: lon1, endLat: lat2, endLng: lon2, color: "rgba(0, 212, 255, 0.4)" });
  }
  return arcs;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AsteroidDistanceBar({ asteroid }: { asteroid: AsteroidDetail }) {
  const maxLD = 20;
  const pct = Math.min((asteroid.distanceLD / maxLD) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-mono text-text-primary">{asteroid.name}</span>
        <span className={`font-mono ${asteroid.hazardous ? "text-red-400" : "text-green-400"}`}>{asteroid.distanceLD} LD</span>
      </div>
      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="absolute left-0 top-0 w-2 h-2 rounded-full bg-blue-400 z-10" />
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: asteroid.hazardous ? "linear-gradient(90deg, #EF4444, #F87171)" : "linear-gradient(90deg, #00D4FF, #34D399)" }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-secondary">
        <span>{asteroid.diameterM}m</span>
        <span>{(asteroid.speedKmH / 1000).toFixed(1)}k km/h</span>
      </div>
    </div>
  );
}

// Blueprint HUD panel for selected 3D object
function BlueprintHUD({ obj }: { obj: { type: string; name: string; data: Record<string, string> } }) {
  return (
    <div className="glass-card p-4 space-y-2 !hover:transform-none border-cyan-500/30 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <h4 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
          {obj.type} // {obj.name}
        </h4>
      </div>
      <div className="border-t border-cyan-500/15 pt-2">
        {Object.entries(obj.data).map(([key, val]) => (
          <div key={key} className="flex justify-between text-xs py-0.5">
            <span className="text-text-secondary font-mono">{key}</span>
            <span className="font-mono font-bold text-text-primary">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Telemetry tab content
function TelemetryPanel({ objectId }: { objectId: string }) {
  const entries = getTelemetryStub(objectId);
  return (
    <div className="glass-card p-4 space-y-2 !hover:transform-none border-cyan-500/20">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3.5 h-3.5 text-cyan-400" />
        <h4 className="text-xs font-mono text-cyan-400">TELEMETRY</h4>
        <span className="text-[9px] font-mono text-accent-amber ml-auto">STUB — awaiting live feed</span>
      </div>
      {entries.map((e) => (
        <div key={e.label} className="flex items-center justify-between text-xs">
          <span className="text-text-secondary font-mono">{e.label}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-text-primary">{e.value} {e.unit}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${
              e.status === "nominal" ? "bg-green-400" : e.status === "warning" ? "bg-yellow-400" : "bg-red-400"
            }`} />
          </div>
        </div>
      ))}
    </div>
  );
}

const DSN_MISSIONS: Record<string, string[]> = {
  "Goldstone": ["Voyager 1", "Mars Reconnaissance Orbiter", "JWST"],
  "Canberra": ["Voyager 2", "New Horizons", "Juno"],
  "Madrid": ["Parker Solar Probe", "OSIRIS-REx", "Psyche"],
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SpaceTrackerModal({ mode, open, onClose }: SpaceTrackerModalProps) {
  const [activeTab, setActiveTab] = useState<TrackerMode>(mode);
  const [viewMode, setViewMode] = useState<ViewMode>("earth");
  const { data } = useSpaceProData();
  const globeRef = useRef<any>(null);
  const [wireframeUrl, setWireframeUrl] = useState<string | null>(null);
  const [selectedAsteroid, setSelectedAsteroid] = useState<AsteroidDetail | null>(null);
  const [globeSize, setGlobeSize] = useState({ w: 500, h: 500 });
  const [hudObj, setHudObj] = useState<{ type: string; name: string; data: Record<string, string> } | null>(null);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const autoRotateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  // Generate wireframe texture on mount (brighter)
  useEffect(() => {
    if (!open) return;
    import("@/lib/wireframe-texture").then(({ generateWireframeTexture }) => {
      setWireframeUrl(generateWireframeTexture(0.15, 0.10));
    });
  }, [open]);

  useEffect(() => { setActiveTab(mode); }, [mode]);

  // Auto switch to NEO view when asteroids tab selected
  useEffect(() => {
    if (activeTab === "asteroids" && viewMode === "earth") {
      // Keep earth view but suggest NEO
    }
  }, [activeTab, viewMode]);

  // Responsive sizing
  useEffect(() => {
    if (!open) return;
    function calcSize() {
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        setGlobeSize({ w: Math.min(window.innerWidth - 32, 400), h: Math.min(window.innerHeight * 0.35, 350) });
      } else {
        setGlobeSize({ w: Math.min(window.innerWidth * 0.55, 700), h: Math.min(window.innerHeight * 0.75, 650) });
      }
    }
    calcSize();
    window.addEventListener("resize", calcSize);
    return () => window.removeEventListener("resize", calcSize);
  }, [open]);

  const handleClose = useCallback(() => {
    setSelectedAsteroid(null);
    setHudObj(null);
    setShowTelemetry(false);
    setViewMode("earth");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) { if (e.key === "Escape") handleClose(); }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, handleClose]);

  // ISS orbit arcs
  const orbitArcs = useMemo(() => {
    if (activeTab !== "iss" || viewMode !== "earth") return [];
    return generateOrbitArcs(data.iss.lat, data.iss.lon);
  }, [activeTab, viewMode, data.iss.lat, data.iss.lon]);

  // Globe markers with click-to-focus
  const htmlElementsData = useMemo(() => {
    const markers: any[] = [];
    markers.push({ id: "iss", lat: data.iss.lat, lng: data.iss.lon, type: "iss", label: `ISS — ${data.iss.altitude}km`, sublabel: "International Space Station", color: "#00D4FF" });
    DSN_STATIONS.forEach((s) => {
      markers.push({ id: `dsn-${s.name}`, lat: s.lat, lng: s.lon, type: "dsn", label: s.name, sublabel: `DSN Ground Station — ${s.country}`, color: "#34D399" });
    });
    markers.push({ id: "user", lat: 45.815, lng: 15.9819, type: "user", label: "Zagreb", sublabel: "Your Location", color: "#FFCF6E" });
    return markers;
  }, [data.iss.lat, data.iss.lon, data.iss.altitude]);

  // Click handler for globe markers — rotate globe to point + flash
  const handleMarkerClick = useCallback((d: any) => {
    setSelectedMarkerId(d.id);
    // Rotate globe to point
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.5 }, 800);
    }
    // Set HUD data
    if (d.type === "iss") {
      setHudObj({
        type: "ISS",
        name: "International Space Station",
        data: {
          "Visina": `${data.iss.altitude} km`,
          "Brzina": `${data.iss.speed.toLocaleString()} km/h`,
          "Pozicija": `${data.iss.lat.toFixed(2)}°, ${data.iss.lon.toFixed(2)}°`,
          "Posada": `${data.iss.crew} astronauta`,
          "Orbitalni period": `${ISS_ORBITAL_PERIOD} min`,
        },
      });
    } else if (d.type === "dsn") {
      const station = DSN_GROUND_STATIONS.find((s) => d.id === s.id);
      setHudObj({
        type: "DSN",
        name: d.label,
        data: {
          "Lokacija": `${d.sublabel}`,
          "Koordinate": `${d.lat.toFixed(2)}°, ${d.lng.toFixed(2)}°`,
          "Misije": station?.meta.activeMissions as string || "N/A",
          "Primarni dish": station?.meta.primaryDish as string || "N/A",
        },
      });
    }
    // Auto-clear flash after 2s
    setTimeout(() => setSelectedMarkerId(null), 2000);
  }, [data.iss]);

  if (!open) return null;

  const nextPassMin = Math.round(Math.random() * 40 + 15);

  return (
    <div className="fixed inset-0 z-[80] flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col sm:flex-row w-full h-full">
        {/* View area */}
        <div className="flex-1 flex items-center justify-center relative min-h-[40vh] sm:min-h-0">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-20 p-2 text-text-secondary hover:text-text-primary transition-colors glass-card cursor-pointer"
            aria-label="Zatvori"
          >
            <X className="w-5 h-5" />
          </button>

          {/* View mode switcher */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-1 bg-space-bg/80 backdrop-blur-sm rounded-lg p-1 border border-cyan-500/20">
            {VIEW_MODES.map((vm) => {
              const Icon = vm.icon;
              return (
                <button
                  key={vm.key}
                  onClick={() => { setViewMode(vm.key); setHudObj(null); }}
                  className={`px-3 py-1.5 text-[11px] font-mono flex items-center gap-1.5 rounded-md transition-colors cursor-pointer ${
                    viewMode === vm.key
                      ? "text-cyan-400 bg-cyan-400/10 border border-cyan-400/30"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {vm.label}
                </button>
              );
            })}
          </div>

          {/* Radial grid background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 50%, rgba(0, 212, 255, 0.12) 0%, transparent 70%)" }}
          />

          {/* === EARTH VIEW === */}
          {viewMode === "earth" && wireframeUrl && (
            <div className="cursor-grab active:cursor-grabbing">
              <GlobeComponent
                ref={globeRef}
                width={globeSize.w}
                height={globeSize.h}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl={wireframeUrl}
                atmosphereColor="#00D4FF"
                atmosphereAltitude={0.18}
                // Auto-rotate
                enablePointerInteraction={true}
                // Markers
                htmlElementsData={htmlElementsData}
                htmlLat="lat"
                htmlLng="lng"
                htmlAltitude={0.04}
                htmlElement={(d: any) => {
                  const el = document.createElement("div");
                  el.style.cssText = "position:relative;cursor:pointer;";

                  const isSelected = d.id === selectedMarkerId;
                  const dotSize = d.type === "iss" ? 14 : 10;

                  // Pulsing dot
                  const dot = document.createElement("div");
                  dot.style.cssText = `
                    width: ${dotSize}px; height: ${dotSize}px;
                    border-radius: 50%; background: ${d.color};
                    box-shadow: 0 0 10px ${d.color}, 0 0 25px ${d.color}50;
                    ${d.type === "iss" || isSelected ? "animation: pulse 1.5s infinite;" : ""}
                    transition: transform 0.3s;
                  `;
                  el.appendChild(dot);

                  // Tooltip with name + type
                  const tooltip = document.createElement("div");
                  tooltip.innerHTML = `
                    <div style="font-size:12px;font-weight:bold;color:${d.color}">${d.label}</div>
                    <div style="font-size:10px;color:rgba(167,179,209,0.8)">${d.sublabel}</div>
                  `;
                  tooltip.style.cssText = `
                    position:absolute; bottom:${dotSize + 6}px; left:50%; transform:translateX(-50%);
                    background:rgba(5,7,13,0.92); backdrop-filter:blur(8px);
                    border:1px solid ${d.color}40; padding:6px 10px; border-radius:6px;
                    white-space:nowrap; pointer-events:none; opacity:0; transition:opacity 0.2s;
                  `;
                  el.appendChild(tooltip);

                  el.addEventListener("mouseenter", () => {
                    tooltip.style.opacity = "1";
                    dot.style.transform = "scale(1.4)";
                  });
                  el.addEventListener("mouseleave", () => {
                    tooltip.style.opacity = "0";
                    dot.style.transform = "scale(1)";
                  });
                  el.addEventListener("click", () => {
                    handleMarkerClick(d);
                  });
                  el.addEventListener("touchstart", () => {
                    tooltip.style.opacity = tooltip.style.opacity === "1" ? "0" : "1";
                    handleMarkerClick(d);
                  }, { passive: true });

                  return el;
                }}
                // Orbit arcs
                arcsData={orbitArcs}
                arcStartLat="startLat"
                arcStartLng="startLng"
                arcEndLat="endLat"
                arcEndLng="endLng"
                arcColor="color"
                arcAltitude={0.005}
                arcStroke={1.0}
                arcDashLength={0.4}
                arcDashGap={0.2}
                arcDashAnimateTime={2500}
                animateIn={true}
              />
            </div>
          )}

          {/* === SOLAR SYSTEM VIEW === */}
          {viewMode === "solar" && (
            <SolarSystemTracker
              width={globeSize.w}
              height={globeSize.h}
              onSelectObject={setHudObj}
            />
          )}

          {/* === NEO VIEW === */}
          {viewMode === "neo" && (
            <NEOTracker
              width={globeSize.w}
              height={globeSize.h}
              onSelectObject={setHudObj}
            />
          )}

          {/* Title overlay */}
          <div className="absolute top-14 left-4 z-10">
            <h2 className="font-heading text-lg font-bold text-cyan-400">
              SPACE TRACKER
            </h2>
            <p className="text-xs font-mono text-cyan-400/60">
              // {viewMode === "earth" ? "Jarvis Blueprint Mode" : viewMode === "solar" ? "Solar System View" : "Near-Earth Objects"}
            </p>
          </div>

          {/* Instructions */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[10px] font-mono text-text-secondary/40 pointer-events-none text-center">
            {viewMode === "earth"
              ? "Drag to rotate / Scroll to zoom / Click markers for info"
              : "Drag to rotate / Scroll to zoom / Click objects for info"}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full sm:w-[380px] bg-space-bg/95 backdrop-blur-xl border-l border-cyan-500/20 overflow-y-auto flex flex-col max-h-[60vh] sm:max-h-full">
          {/* Tabs */}
          <div className="flex border-b border-cyan-500/20">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedAsteroid(null); setHudObj(null); }}
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
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Blueprint HUD for 3D selected objects */}
            {hudObj && hudObj.name && <BlueprintHUD obj={hudObj} />}

            {activeTab === "iss" && (
              <>
                <div className="glass-card p-4 space-y-3 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                    <h3 className="text-sm font-semibold text-cyan-400 font-mono">ISS STATUS</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-text-secondary">Visina</span>
                      <p className="font-mono font-bold text-text-primary text-lg">{data.iss.altitude} km</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Brzina</span>
                      <p className="font-mono font-bold text-text-primary text-lg">{data.iss.speed.toLocaleString()} km/h</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Latituda</span>
                      <p className="font-mono font-bold text-cyan-400">{data.iss.lat.toFixed(2)}°</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Longituda</span>
                      <p className="font-mono font-bold text-cyan-400">{data.iss.lon.toFixed(2)}°</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Orbitalni period</span>
                      <p className="font-mono font-bold text-text-primary">{ISS_ORBITAL_PERIOD} min</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Sljedeći prolaz</span>
                      <p className="font-mono font-bold text-accent-amber">~{nextPassMin} min</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-text-secondary">Posada ({data.iss.crew})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ISS_CREW_NAMES.slice(0, data.iss.crew).map((name) => (
                          <span key={name} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400/80">{name}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Telemetry */}
                <button
                  onClick={() => setShowTelemetry(!showTelemetry)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-cyan-400/5 border border-cyan-400/15 text-xs font-mono text-cyan-400/70 hover:bg-cyan-400/10 transition-colors cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5" />
                  {showTelemetry ? "Sakrij Telemetriju" : "Prikaži Telemetriju"}
                </button>
                {showTelemetry && <TelemetryPanel objectId="iss" />}

                <div className="text-[10px] text-text-secondary font-mono text-center">
                  {viewMode === "earth" && `Orbit trajectory prikazan — inklinacija ${ISS_INCLINATION}°`}
                  {viewMode === "solar" && "Solar System view — klikni planete i sonde"}
                </div>
              </>
            )}

            {activeTab === "asteroids" && (
              <>
                <div className="glass-card p-4 space-y-3 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-accent-amber" />
                    <h3 className="text-sm font-semibold text-text-primary font-mono">NEO DANAS — {data.asteroids.countToday}</h3>
                  </div>
                  <div className="space-y-3">
                    {data.asteroids.asteroidList.map((a) => (
                      <button
                        key={a.name}
                        onClick={() => setSelectedAsteroid(selectedAsteroid?.name === a.name ? null : a)}
                        className={`w-full text-left p-2 rounded-lg transition-colors cursor-pointer ${
                          selectedAsteroid?.name === a.name ? "bg-cyan-400/10 border border-cyan-400/30" : "hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono font-bold text-text-primary flex items-center gap-1.5">
                            {a.hazardous && <span className="text-red-400">!</span>}
                            {a.name}
                          </span>
                          <span className={`font-mono ${a.hazardous ? "text-red-400" : "text-green-400"}`}>{a.distanceLD} LD</span>
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
                    <h4 className="text-xs font-mono text-cyan-400 mb-2">UDALJENOST — {selectedAsteroid.name}</h4>
                    <AsteroidDistanceBar asteroid={selectedAsteroid} />
                    <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                      <div>
                        <span className="text-text-secondary">Promjer</span>
                        <p className="font-mono font-bold text-text-primary">{selectedAsteroid.diameterM}m</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Brzina</span>
                        <p className="font-mono font-bold text-text-primary">{selectedAsteroid.speedKmH.toLocaleString()} km/h</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Udaljenost</span>
                        <p className="font-mono font-bold text-cyan-400">{(selectedAsteroid.distanceLD * 384400).toLocaleString()} km</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Opasan</span>
                        <p className={`font-mono font-bold ${selectedAsteroid.hazardous ? "text-red-400" : "text-green-400"}`}>
                          {selectedAsteroid.hazardous ? "DA" : "NE"}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Najbliži prolaz</span>
                        <p className="font-mono font-bold text-accent-amber">Danas</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Energija udara</span>
                        <p className="font-mono font-bold text-red-400/80">{(selectedAsteroid.diameterM * selectedAsteroid.speedKmH * 0.001).toFixed(1)} kt</p>
                      </div>
                    </div>
                  </div>
                )}

                {viewMode !== "neo" && (
                  <button
                    onClick={() => setViewMode("neo")}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-xs font-mono text-accent-amber hover:bg-amber-400/20 transition-colors cursor-pointer"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    3D NEO View
                  </button>
                )}
              </>
            )}

            {activeTab === "dsn" && (
              <>
                <div className="glass-card p-4 space-y-3 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Radio className="w-3.5 h-3.5 text-purple-400" />
                    <h3 className="text-sm font-semibold text-text-primary font-mono">DSN STANICE</h3>
                  </div>
                  <div className="space-y-2">
                    {DSN_STATIONS.map((s) => {
                      const stationData = DSN_GROUND_STATIONS.find((gs) => gs.name === s.name);
                      return (
                        <button
                          key={s.name}
                          onClick={() => handleMarkerClick({
                            id: `dsn-${s.name}`, lat: s.lat, lng: s.lon, type: "dsn",
                            label: s.name, sublabel: `DSN Ground Station — ${s.country}`,
                          })}
                          className="w-full p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                            <div className="flex-1">
                              <p className="text-xs font-mono font-bold text-text-primary">{s.name}</p>
                              <p className="text-[10px] text-text-secondary">{s.country} — {s.lat.toFixed(2)}°, {s.lon.toFixed(2)}°</p>
                            </div>
                            <MapPin className="w-3 h-3 text-text-secondary" />
                          </div>
                          <div className="mt-1.5 ml-5.5 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-text-secondary">Signal:</span>
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map((bar) => (
                                  <div
                                    key={bar}
                                    className={`w-1 rounded-full ${bar <= (stationData?.meta.signalStrength as number || 4) ? "bg-green-400" : "bg-white/10"}`}
                                    style={{ height: `${bar * 3 + 4}px` }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(DSN_MISSIONS[s.name] || []).map((m) => (
                                <span key={m} className="text-[9px] font-mono px-1 py-0.5 rounded bg-purple-400/10 text-purple-400/80">{m}</span>
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="glass-card p-4 space-y-3 !hover:transform-none border-cyan-500/20">
                  <h4 className="text-xs font-mono text-purple-400 mb-2">AKTIVNE SONDE</h4>
                  <div className="space-y-2">
                    {data.deepSpace.activeLinks.map((link) => (
                      <div key={link.name} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${link.status === "active" ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                          <span className="font-mono text-text-primary">{link.name}</span>
                        </div>
                        <span className="text-text-secondary font-mono">{link.distance}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {viewMode !== "solar" && (
                  <button
                    onClick={() => setViewMode("solar")}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-400/10 border border-purple-400/20 text-xs font-mono text-purple-400 hover:bg-purple-400/20 transition-colors cursor-pointer"
                  >
                    <Sun className="w-3.5 h-3.5" />
                    3D Solar System View
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
