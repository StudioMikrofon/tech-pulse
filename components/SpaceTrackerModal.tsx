"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  X, Satellite, Radio, Zap, Activity, MapPin,
  Rocket, Waves, ChevronRight,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useSpaceProData, DSN_STATIONS } from "@/lib/space-pro-data";
import type { AsteroidDetail } from "@/lib/space-pro-data";
import {
  DSN_GROUND_STATIONS,
  ISS_CREW_NAMES,
  ISS_ORBITAL_PERIOD,
  ISS_INCLINATION,
  PROBES_DATASET,
  NEO_DATASET,
  RADIO_JOVE_DATA,
  LAUNCH_DATA,
  getTelemetryStub,
} from "@/lib/space-tracker-data";
import type { FocusTarget, JarvisSceneHandle } from "./JarvisScene";

const JarvisScene = dynamic(() => import("./JarvisScene"), { ssr: false });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SidebarTab = "iss" | "asteroids" | "dsn" | "launches" | "radiojove";

interface SpaceTrackerModalProps {
  mode: "iss" | "dsn" | "asteroids" | "overview";
  open: boolean;
  onClose: () => void;
}

const TABS: { key: SidebarTab; label: string; icon: typeof Satellite }[] = [
  { key: "iss", label: "ISS", icon: Satellite },
  { key: "asteroids", label: "NEO", icon: Zap },
  { key: "dsn", label: "DSN", icon: Radio },
  { key: "launches", label: "Launch", icon: Rocket },
  { key: "radiojove", label: "JOVE", icon: Waves },
];

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
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: asteroid.hazardous ? "linear-gradient(90deg, #EF4444, #F87171)" : "linear-gradient(90deg, #00D4FF, #34D399)" }} />
      </div>
    </div>
  );
}

function BlueprintHUD({ obj }: { obj: { type: string; name: string; data: Record<string, string> } }) {
  return (
    <div className="glass-card p-3 space-y-1.5 !hover:transform-none border-cyan-500/30">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <h4 className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider truncate">
          {obj.type} // {obj.name}
        </h4>
      </div>
      <div className="border-t border-cyan-500/15 pt-1.5">
        {Object.entries(obj.data).map(([key, val]) => (
          <div key={key} className="flex justify-between text-[11px] py-0.5 gap-2">
            <span className="text-text-secondary font-mono shrink-0">{key}</span>
            <span className="font-mono font-bold text-text-primary text-right truncate">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelemetryPanel({ objectId }: { objectId: string }) {
  const entries = getTelemetryStub(objectId);
  return (
    <div className="glass-card p-3 space-y-1.5 !hover:transform-none border-cyan-500/20">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-3 h-3 text-cyan-400" />
        <h4 className="text-[11px] font-mono text-cyan-400">TELEMETRY</h4>
        <span className="text-[9px] font-mono text-accent-amber/60 ml-auto">STUB</span>
      </div>
      {entries.map((e) => (
        <div key={e.label} className="flex items-center justify-between text-[11px]">
          <span className="text-text-secondary font-mono">{e.label}</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-text-primary">{e.value} {e.unit}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${e.status === "nominal" ? "bg-green-400" : e.status === "warning" ? "bg-yellow-400" : "bg-red-400"}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

const DSN_MISSIONS: Record<string, string[]> = {
  "Goldstone": ["Voyager 1", "MRO", "JWST"],
  "Canberra": ["Voyager 2", "New Horizons", "Juno"],
  "Madrid": ["Parker Solar", "OSIRIS-REx", "Psyche"],
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function SpaceTrackerModal({ mode, open, onClose }: SpaceTrackerModalProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>(mode === "overview" ? "iss" : mode);
  const { data } = useSpaceProData();
  const jarvisRef = useRef<JarvisSceneHandle>(null);
  const [selectedAsteroid, setSelectedAsteroid] = useState<AsteroidDetail | null>(null);
  const [sceneSize, setSceneSize] = useState({ w: 500, h: 500 });
  const [hudObj, setHudObj] = useState<{ type: string; name: string; data: Record<string, string> } | null>(null);
  const [showTelemetry, setShowTelemetry] = useState(false);

  useEffect(() => { if (mode !== "overview") setActiveTab(mode); }, [mode]);

  // Responsive sizing — scene fills entire left area
  useEffect(() => {
    if (!open) return;
    function calcSize() {
      const isMobile = window.innerWidth < 640;
      const sidebarW = isMobile ? 0 : 380;
      setSceneSize({
        w: Math.max(window.innerWidth - sidebarW, 300),
        h: isMobile ? Math.round(window.innerHeight * 0.45) : window.innerHeight,
      });
    }
    calcSize();
    window.addEventListener("resize", calcSize);
    return () => window.removeEventListener("resize", calcSize);
  }, [open]);

  const handleClose = useCallback(() => {
    setSelectedAsteroid(null);
    setHudObj(null);
    setShowTelemetry(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) { if (e.key === "Escape") handleClose(); }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, handleClose]);

  // Focus helpers — send commands to JarvisScene
  const focusOn = useCallback((target: FocusTarget) => {
    jarvisRef.current?.focusOn(target);
  }, []);

  // When tab changes, focus camera on relevant area
  useEffect(() => {
    if (!open) return;
    // Small delay to let scene mount
    const t = setTimeout(() => {
      if (activeTab === "iss") focusOn({ type: "iss" });
      else if (activeTab === "dsn") focusOn({ type: "earth" });
      else if (activeTab === "asteroids") focusOn({ type: "earth" });
      else if (activeTab === "launches") focusOn({ type: "earth" });
      else if (activeTab === "radiojove") focusOn({ type: "sun" });
    }, 300);
    return () => clearTimeout(t);
  }, [activeTab, open, focusOn]);

  if (!open) return null;

  const nextPassMin = Math.round(Math.random() * 40 + 15);

  return (
    <div className="fixed inset-0 z-[80] flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {/* Content — scene + sidebar, no gap */}
      <div className="relative z-10 flex flex-col sm:flex-row w-full h-full">
        {/* 3D Scene — fills all space left of sidebar */}
        <div className="flex-1 relative min-h-[45vh] sm:min-h-0 bg-[#030509]">
          {/* Close */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-20 p-2 text-text-secondary hover:text-text-primary transition-colors glass-card cursor-pointer"
            aria-label="Zatvori"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="absolute top-3 left-4 z-10">
            <h2 className="font-heading text-base font-bold text-cyan-400">SPACE TRACKER</h2>
            <p className="text-[10px] font-mono text-cyan-400/50">// Jarvis Blueprint Mode</p>
          </div>

          {/* HUD overlay on 3D scene */}
          {hudObj && hudObj.name && (
            <div className="absolute bottom-4 left-4 z-10 w-64">
              <BlueprintHUD obj={hudObj} />
            </div>
          )}

          {/* Instructions */}
          <div className="absolute bottom-3 right-4 z-10 text-[9px] font-mono text-text-secondary/30 pointer-events-none">
            Drag rotate / Scroll zoom / Click objects
          </div>

          <JarvisScene
            ref={jarvisRef}
            width={sceneSize.w}
            height={sceneSize.h}
            issData={data.iss}
            onSelectObject={setHudObj}
          />
        </div>

        {/* Sidebar — fixed width, flush against scene */}
        <div className="w-full sm:w-[380px] shrink-0 bg-space-bg/95 backdrop-blur-xl border-l border-cyan-500/20 overflow-y-auto flex flex-col max-h-[55vh] sm:max-h-full">
          {/* Tabs */}
          <div className="flex border-b border-cyan-500/20 shrink-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedAsteroid(null); setHudObj(null); }}
                  className={`flex-1 py-2.5 px-1 text-[10px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">

            {/* ===== ISS ===== */}
            {activeTab === "iss" && (
              <>
                <div className="glass-card p-3 space-y-2 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <h3 className="text-xs font-semibold text-cyan-400 font-mono">ISS STATUS</h3>
                    <button
                      onClick={() => focusOn({ type: "iss" })}
                      className="ml-auto text-[9px] font-mono text-cyan-400/50 hover:text-cyan-400 cursor-pointer"
                    >
                      FOCUS <ChevronRight className="w-2.5 h-2.5 inline" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-text-secondary text-[10px]">Visina</span>
                      <p className="font-mono font-bold text-text-primary">{data.iss.altitude} km</p>
                    </div>
                    <div>
                      <span className="text-text-secondary text-[10px]">Brzina</span>
                      <p className="font-mono font-bold text-text-primary">{data.iss.speed.toLocaleString()} km/h</p>
                    </div>
                    <div>
                      <span className="text-text-secondary text-[10px]">Pozicija</span>
                      <p className="font-mono font-bold text-cyan-400 text-[11px]">{data.iss.lat.toFixed(2)}°, {data.iss.lon.toFixed(2)}°</p>
                    </div>
                    <div>
                      <span className="text-text-secondary text-[10px]">Period</span>
                      <p className="font-mono font-bold text-text-primary">{ISS_ORBITAL_PERIOD} min</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-text-secondary text-[10px]">Posada ({data.iss.crew})</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {ISS_CREW_NAMES.slice(0, data.iss.crew).map((name) => (
                          <span key={name} className="text-[9px] font-mono px-1 py-0.5 rounded bg-cyan-400/10 text-cyan-400/70">{name}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowTelemetry(!showTelemetry)} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-cyan-400/5 border border-cyan-400/10 text-[10px] font-mono text-cyan-400/50 hover:bg-cyan-400/10 transition-colors cursor-pointer">
                  <Activity className="w-3 h-3" />
                  {showTelemetry ? "Sakrij" : "Telemetrija"}
                </button>
                {showTelemetry && <TelemetryPanel objectId="iss" />}

                {/* Probes section */}
                <div className="glass-card p-3 space-y-2 !hover:transform-none border-cyan-500/20">
                  <h4 className="text-[11px] font-mono text-cyan-400/70">SONDE U DUBOKOM SVEMIRU</h4>
                  {PROBES_DATASET.entries.map((probe) => (
                    <button
                      key={probe.id}
                      onClick={() => { focusOn({ type: "probe", id: probe.id }); }}
                      className="w-full flex items-center justify-between text-[11px] p-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${probe.status === "active" ? "bg-green-400" : "bg-gray-500"}`} />
                        <span className="font-mono text-text-primary">{probe.name}</span>
                      </div>
                      <span className="text-text-secondary font-mono text-[10px]">{probe.distanceFromSun}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ===== ASTEROIDS ===== */}
            {activeTab === "asteroids" && (
              <>
                <div className="glass-card p-3 space-y-2 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3 h-3 text-accent-amber" />
                    <h3 className="text-xs font-semibold text-text-primary font-mono">NEO — {data.asteroids.countToday} danas</h3>
                  </div>
                  <div className="space-y-2">
                    {data.asteroids.asteroidList.map((a) => {
                      const neoData = NEO_DATASET.entries.find((n) => n.name === a.name);
                      return (
                        <button
                          key={a.name}
                          onClick={() => {
                            setSelectedAsteroid(selectedAsteroid?.name === a.name ? null : a);
                            if (neoData) focusOn({ type: "asteroid", id: neoData.id });
                          }}
                          className={`w-full text-left p-2 rounded-lg transition-colors cursor-pointer ${
                            selectedAsteroid?.name === a.name ? "bg-cyan-400/10 border border-cyan-400/30" : "hover:bg-white/5 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="font-mono font-bold text-text-primary flex items-center gap-1">
                              {a.hazardous && <span className="text-red-400 text-[10px]">!</span>}
                              {a.name}
                            </span>
                            <span className={`font-mono text-[11px] ${a.hazardous ? "text-red-400" : "text-green-400"}`}>{a.distanceLD} LD</span>
                          </div>
                          <div className="flex gap-2 text-[10px] text-text-secondary">
                            <span>{a.diameterM}m</span>
                            <span>{(a.speedKmH / 1000).toFixed(1)}k km/h</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedAsteroid && (
                  <div className="glass-card p-3 space-y-1.5 !hover:transform-none border-cyan-500/20">
                    <h4 className="text-[11px] font-mono text-cyan-400 mb-1">DETALJI — {selectedAsteroid.name}</h4>
                    <AsteroidDistanceBar asteroid={selectedAsteroid} />
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] mt-2">
                      <div><span className="text-text-secondary">Promjer</span><p className="font-mono font-bold text-text-primary">{selectedAsteroid.diameterM}m</p></div>
                      <div><span className="text-text-secondary">Brzina</span><p className="font-mono font-bold text-text-primary">{selectedAsteroid.speedKmH.toLocaleString()} km/h</p></div>
                      <div><span className="text-text-secondary">Udaljenost</span><p className="font-mono font-bold text-cyan-400">{(selectedAsteroid.distanceLD * 384400).toLocaleString()} km</p></div>
                      <div><span className="text-text-secondary">Opasan</span><p className={`font-mono font-bold ${selectedAsteroid.hazardous ? "text-red-400" : "text-green-400"}`}>{selectedAsteroid.hazardous ? "DA" : "NE"}</p></div>
                      <div><span className="text-text-secondary">Prolaz</span><p className="font-mono font-bold text-accent-amber">Danas</p></div>
                      <div><span className="text-text-secondary">Energija</span><p className="font-mono font-bold text-red-400/80">{(selectedAsteroid.diameterM * selectedAsteroid.speedKmH * 0.001).toFixed(1)} kt</p></div>
                    </div>
                  </div>
                )}

                {/* Quick focus: Sun overview */}
                <button onClick={() => focusOn({ type: "sun" })} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-400/5 border border-amber-400/15 text-[10px] font-mono text-accent-amber/60 hover:bg-amber-400/10 transition-colors cursor-pointer">
                  Sunčev Sustav Overview
                </button>
              </>
            )}

            {/* ===== DSN ===== */}
            {activeTab === "dsn" && (
              <>
                <div className="glass-card p-3 space-y-2 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Radio className="w-3 h-3 text-purple-400" />
                    <h3 className="text-xs font-semibold text-text-primary font-mono">DSN STANICE</h3>
                  </div>
                  {DSN_STATIONS.map((s) => {
                    const stationData = DSN_GROUND_STATIONS.find((gs) => gs.name === s.name);
                    return (
                      <button
                        key={s.name}
                        onClick={() => focusOn({ type: "dsn", id: stationData?.id || `dsn-${s.name}` })}
                        className="w-full p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <div className="flex-1">
                            <p className="text-[11px] font-mono font-bold text-text-primary">{s.name}</p>
                            <p className="text-[9px] text-text-secondary">{s.country} — {s.lat.toFixed(2)}°, {s.lon.toFixed(2)}°</p>
                          </div>
                          <ChevronRight className="w-3 h-3 text-text-secondary/30" />
                        </div>
                        <div className="mt-1 ml-4 flex flex-wrap gap-1">
                          {(DSN_MISSIONS[s.name] || []).map((m) => (
                            <span key={m} className="text-[8px] font-mono px-1 py-0.5 rounded bg-purple-400/10 text-purple-400/70">{m}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="glass-card p-3 space-y-2 !hover:transform-none border-cyan-500/20">
                  <h4 className="text-[11px] font-mono text-purple-400/70 mb-1">AKTIVNE SONDE</h4>
                  {data.deepSpace.activeLinks.map((link) => (
                    <button
                      key={link.name}
                      onClick={() => {
                        const probe = PROBES_DATASET.entries.find((p) => p.name === link.name);
                        if (probe) focusOn({ type: "probe", id: probe.id });
                      }}
                      className="w-full flex items-center justify-between text-[11px] p-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${link.status === "active" ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                        <span className="font-mono text-text-primary">{link.name}</span>
                      </div>
                      <span className="text-text-secondary font-mono text-[10px]">{link.distance}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ===== LAUNCHES ===== */}
            {activeTab === "launches" && (
              <>
                <div className="glass-card p-3 space-y-2 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Rocket className="w-3 h-3 text-accent-amber" />
                    <h3 className="text-xs font-semibold text-text-primary font-mono">LANSIRANJA</h3>
                    <span className="text-[8px] font-mono text-text-secondary ml-auto">Launch Dashboard API</span>
                  </div>
                  {LAUNCH_DATA.entries.map((launch) => (
                    <div key={launch.id} className="p-2 rounded-lg border border-white/5 hover:bg-white/3 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-mono font-bold text-text-primary">{launch.mission}</span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                          launch.status === "live" ? "bg-red-400/20 text-red-400" :
                          launch.status === "upcoming" ? "bg-cyan-400/20 text-cyan-400" :
                          launch.status === "completed" ? "bg-green-400/20 text-green-400" :
                          "bg-gray-400/20 text-gray-400"
                        }`}>
                          {launch.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[10px] text-text-secondary font-mono space-y-0.5">
                        <p>{launch.vehicle} — {launch.provider}</p>
                        <p>{launch.site}</p>
                        <p>T-0: {new Date(launch.launchTime).toLocaleString()}</p>
                      </div>
                      {launch.telemetry && (
                        <div className="mt-1.5 pt-1.5 border-t border-white/5 grid grid-cols-3 gap-1.5 text-[10px]">
                          <div><span className="text-text-secondary">Alt</span><p className="font-mono font-bold text-text-primary">{launch.telemetry.altitude} km</p></div>
                          <div><span className="text-text-secondary">Vel</span><p className="font-mono font-bold text-text-primary">{launch.telemetry.velocity.toLocaleString()} km/h</p></div>
                          <div><span className="text-text-secondary">G</span><p className="font-mono font-bold text-text-primary">{launch.telemetry.acceleration.toFixed(1)}</p></div>
                        </div>
                      )}
                      {/* Timeline events */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {launch.events.map((evt) => (
                          <span key={evt.label} className="text-[8px] font-mono px-1 py-0.5 rounded bg-white/5 text-text-secondary">
                            T+{evt.time}s {evt.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] font-mono text-text-secondary/40 text-center">
                  WebSocket: api.launchdashboard.space — live telemetry during launches
                </div>
              </>
            )}

            {/* ===== RADIO JOVE ===== */}
            {activeTab === "radiojove" && (
              <>
                <div className="glass-card p-3 space-y-2 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Waves className="w-3 h-3 text-purple-400" />
                    <h3 className="text-xs font-semibold text-text-primary font-mono">RADIO JOVE</h3>
                    <span className="text-[8px] font-mono text-text-secondary ml-auto">NASA Citizen Science</span>
                  </div>
                  <p className="text-[10px] text-text-secondary leading-relaxed">
                    Radio emisije Jupitera, Sunca i galaksije na 14-30 MHz. Detekcije od globalnih stanica.
                  </p>
                  {RADIO_JOVE_DATA.entries.map((entry) => (
                    <div key={entry.id} className="p-2 rounded-lg border border-white/5 hover:bg-white/3 transition-colors">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-mono font-bold text-text-primary flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            entry.source === "Jupiter" ? "bg-amber-400" :
                            entry.source === "Sun" ? "bg-yellow-400" : "bg-purple-400"
                          }`} />
                          {entry.source}
                        </span>
                        <span className="text-[9px] font-mono text-cyan-400">{entry.frequency}</span>
                      </div>
                      <div className="text-[10px] text-text-secondary font-mono">
                        <p>{entry.type}</p>
                        <div className="flex justify-between mt-0.5">
                          <span>Intenzitet: <span className={`font-bold ${entry.intensity > 70 ? "text-red-400" : entry.intensity > 40 ? "text-amber-400" : "text-green-400"}`}>{entry.intensity} dB</span></span>
                          <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[9px] text-text-secondary/50">{entry.station}</p>
                      </div>
                      {/* Intensity bar */}
                      <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${entry.intensity}%`,
                            background: entry.intensity > 70 ? "#EF4444" : entry.intensity > 40 ? "#FFCF6E" : "#34D399",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] font-mono text-text-secondary/40 text-center">
                  radiojove.gsfc.nasa.gov — 20.1 MHz spectrogram data
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
