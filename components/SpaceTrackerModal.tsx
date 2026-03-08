"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

import {
  X, Satellite, Radio, Zap, Activity, MapPin,
  Rocket, Waves, ChevronRight, Play,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useSpaceProData, DSN_STATIONS } from "@/lib/space-pro-data";
import SpaceFocusHUD from "./SpaceFocusHUD";

import {
  DSN_GROUND_STATIONS,
  ISS_CREW_NAMES,
  ISS_ORBITAL_PERIOD,
  ISS_INCLINATION,
  PROBES_DATASET,
  NEO_DATASET,
  LAUNCH_DATA,
  getTelemetryStub,
} from "@/lib/space-tracker-data";
// NEO_DATASET also used for asteroid ID lookup in handleObjectSelect
import { playSound } from "@/lib/sounds";

// ---------------------------------------------------------------------------
// Jupiter declination (J2000) — computed client-side
// ---------------------------------------------------------------------------
function getJupiterDeclination(): { decDeg: number; raDeg: number; distAU: number } {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const daysSinceJ2000 = (Date.now() - J2000) / 86400000;
  const T = daysSinceJ2000 / 36525;
  // Jupiter ecliptic longitude (degrees)
  const L = ((34.351 + 3034.906 * T) % 360 + 360) % 360;
  const Lrad = (L * Math.PI) / 180;
  // Jupiter distance from Sun (AU) — simplified
  const distAU = 5.203 + 0.048 * Math.cos(Lrad);
  // Obliquity of ecliptic
  const eps = ((23.439 - 0.0130042 * T) * Math.PI) / 180;
  // Equatorial coordinates (simplified, ignoring inclination for visual accuracy)
  const sinDec = Math.sin(Lrad) * Math.sin(eps);
  const decRad = Math.asin(sinDec);
  const raDeg = ((Math.atan2(Math.cos(eps) * Math.sin(Lrad), Math.cos(Lrad)) * 180) / Math.PI + 360) % 360;
  return { decDeg: (decRad * 180) / Math.PI, raDeg, distAU };
}
import type { FocusTarget, JarvisSceneHandle } from "./JarvisScene";

const JarvisScene = dynamic(() => import("./JarvisScene"), { ssr: false });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SidebarTab = "iss" | "asteroids" | "dsn" | "launches" | "radiojove";

interface AsteroidDisplay {
  name: string;
  distanceLD: number;
  diameterM: number;
  speedKmH: number;
  hazardous: boolean;
}

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

function BootOverlay({ onDone }: { onDone: () => void }) {
  const [lines, setLines] = useState<{ text: string; status: string }[]>([]);

  useEffect(() => {
    const sequence = [
      { text: "> SECURE LINK...", status: "[OK]", delay: 0 },
      { text: "> JARVIS ONLINE", status: "[OK]", delay: 200 },
      { text: "> SIGNAL ACQUIRED", status: "", delay: 400 },
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((item) => {
      timers.push(setTimeout(() => {
        setLines(prev => [...prev, { text: item.text, status: item.status }]);
      }, item.delay));
    });

    timers.push(setTimeout(onDone, 600));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="absolute inset-0 z-30 bg-[#030509]/95 flex items-center justify-center animate-fade-out" style={{ animationDelay: "0.5s", animationDuration: "0.2s", animationFillMode: "forwards" }}>
      <div className="space-y-2 font-mono text-sm text-cyan-400 max-w-md px-4">
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2 animate-typewriter-line" style={{ animationDelay: `${i * 0.05}s` }}>
            <span className="whitespace-nowrap">{line.text}</span>
            {line.status && <span className="text-green-400 font-bold">{line.status}</span>}
          </div>
        ))}
        <div className="mt-4 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      </div>
    </div>
  );
}

function AsteroidDistanceBar({ asteroid }: { asteroid: {name: string; distanceLD: number; diameterM: number; speedKmH: number; hazardous: boolean} }) {
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

function JarvisTerminalHUD({ obj, onClose, onSimToggle, compact }: { obj: { type: string; name: string; data: Record<string, string> }; onClose: () => void; onSimToggle?: () => void; compact?: boolean }) {
  const [displayedText, setDisplayedText] = useState("");
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Build the full text block to type out
  const fullText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`${obj.type} // ${obj.name}`);
    lines.push("─".repeat(28));
    for (const [key, val] of Object.entries(obj.data)) {
      const dots = ".".repeat(Math.max(1, 22 - key.length));
      lines.push(`${key} ${dots} ${val}`);
    }
    return lines.join("\n");
  }, [obj.type, obj.name, obj.data]);

  // Sci-fi terminal tick sound per character
  const playTypeTick = useCallback(() => {
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem("tp-sound") === "off") return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const hp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      hp.type = "highpass";
      hp.frequency.value = 2000;
      osc.connect(hp);
      hp.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800 + Math.random() * 400;
      osc.type = "square";
      gain.gain.value = 0.005;
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.015);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.015);
    } catch { /* audio not available */ }
  }, []);

  useEffect(() => {
    setDisplayedText("");
    let charIdx = 0;
    const speed = 5; // ms per character
    const timer = setInterval(() => {
      if (charIdx < fullText.length) {
        setDisplayedText(fullText.slice(0, charIdx + 1));
        // Play tick every 3rd visible character only
        const ch = fullText[charIdx];
        if (ch !== " " && ch !== "\n" && ch !== "─") playTypeTick();
        charIdx++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [fullText, playTypeTick]);

  return (
    <div className={`font-mono select-none ${compact ? "text-[9px] max-w-60" : "text-[11px] max-w-80"}`}>
      {/* Scanline top bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-px bg-gradient-to-r from-cyan-400/80 via-cyan-400/30 to-transparent animate-pulse" />
        <button
          onClick={onClose}
          className="text-cyan-400/50 hover:text-cyan-400 transition-colors cursor-pointer text-[10px] leading-none"
          aria-label="Zatvori HUD"
        >
          [X]
        </button>
      </div>

      {/* Terminal text — character by character */}
      <pre className="whitespace-pre-wrap leading-relaxed">
        {displayedText.split("\n").map((line, i) => (
          <div key={i}>
            {i === 0 ? (
              <span className="text-cyan-400 uppercase tracking-wider">{line}</span>
            ) : i === 1 ? (
              <span className="text-cyan-400/20">{line}</span>
            ) : (
              <>
                <span className="text-cyan-400/60">{line.split(/(?<=\.{2,}\s)/)[0]}</span>
                <span className="text-green-400/90">{line.split(/(?<=\.{2,}\s)/).slice(1).join("")}</span>
              </>
            )}
          </div>
        ))}
        {/* Blinking terminal cursor — always visible */}
        <span className={`text-cyan-400 ${displayedText.length >= fullText.length ? "animate-pulse" : ""}`}>▌</span>
      </pre>

      {/* Sim button for asteroids */}
      {onSimToggle && (
        <button
          onClick={onSimToggle}
          className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 rounded bg-cyan-400/10 border border-cyan-400/20 text-[9px] font-mono text-cyan-400/70 hover:bg-cyan-400/20 transition-colors cursor-pointer"
        >
          SIMULACIJA
        </button>
      )}

      {/* Bottom scanline */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent mt-1.5" />
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
  const dataRef = useRef(data);
  dataRef.current = data;
  const jarvisRef = useRef<JarvisSceneHandle>(null);
  const [selectedAsteroid, setSelectedAsteroid] = useState<AsteroidDisplay | null>(null);
  const [selectedAsteroidId, setSelectedAsteroidId] = useState<string | null>(null);
  const [sceneSize, setSceneSize] = useState({ w: 500, h: 500 });
  const [hudObj, setHudObj] = useState<{ type: string; name: string; data: Record<string, string> } | null>(null);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [booting, setBooting] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const jupiterReturnRef = useRef<ReturnType<typeof setTimeout> | null>(null); // kept for cleanup only

  useEffect(() => { if (mode !== "overview") setActiveTab(mode); }, [mode]);

  // Boot sound + reset boot state on open
  useEffect(() => {
    if (open) {
      setBooting(true);
      playSound("boot");
    }
  }, [open]);

  // Responsive sizing + landscape detection
  useEffect(() => {
    if (!open) return;
    function calcSize() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < 640;
      const landscape = vw > vh && vw < 1024;
      setIsLandscape(landscape);
      if (landscape) {
        // Landscape mobile: side-by-side, scene takes 65%
        const sceneW = Math.round(vw * 0.65);
        setSceneSize({ w: sceneW, h: vh });
      } else {
        const sidebarW = isMobile ? 0 : 380;
        setSceneSize({
          w: Math.max(vw - sidebarW, 300),
          h: isMobile ? Math.round(vh * 0.45) : vh,
        });
      }
    }
    calcSize();
    window.addEventListener("resize", calcSize);
    window.addEventListener("orientationchange", calcSize);
    return () => {
      window.removeEventListener("resize", calcSize);
      window.removeEventListener("orientationchange", calcSize);
    };
  }, [open]);

  const handleClose = useCallback(() => {
    setSelectedAsteroid(null);
    setHudObj(null);
    setShowTelemetry(false);
    playSound("click");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) { if (e.key === "Escape") handleClose(); }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, handleClose]);

  const focusOn = useCallback((target: FocusTarget) => {
    jarvisRef.current?.focusOn(target);
  }, []);

  // When tab changes, focus camera + play sound
  useEffect(() => {
    if (!open) return;
    // Cancel any pending Jupiter auto-return
    if (jupiterReturnRef.current) { clearTimeout(jupiterReturnRef.current); jupiterReturnRef.current = null; }

    const t = setTimeout(() => {
      if (activeTab === "iss") focusOn({ type: "iss" });
      else if (activeTab === "dsn") focusOn({ type: "earth" });
      else if (activeTab === "asteroids") focusOn({ type: "earth" });
      else if (activeTab === "launches") focusOn({ type: "earth" });
      else if (activeTab === "radiojove") {
        focusOn({ type: "planet", id: "planet-jupiter" });
        // stay on Jupiter — user navigates away manually
      }
    }, 300);
    return () => { clearTimeout(t); if (jupiterReturnRef.current) { clearTimeout(jupiterReturnRef.current); jupiterReturnRef.current = null; } };
  }, [activeTab, open, focusOn]);

  const handleTabSwitch = useCallback((tab: SidebarTab) => {
    setActiveTab(tab);
    setSelectedAsteroid(null);
    setHudObj(null);
    playSound("click");
  }, []);

  const handleSidebarItemClick = useCallback((target: FocusTarget) => {
    focusOn(target);
    playSound("ping");
  }, [focusOn]);

  const handleObjectSelect = useCallback((obj: { type: string; name: string; data: Record<string, string> } | null) => {
    if (obj) {
      // Enrich with live data via ref (no dependency on data to avoid scene rebuilds)
      const live = dataRef.current;
      if (obj.type === "ISS" && live.iss) {
        obj.data["Visina"]   = `${live.iss.altitude} km`;
        obj.data["Brzina"]   = `${live.iss.speed.toLocaleString()} km/h`;
        obj.data["Pozicija"] = `${live.iss.lat.toFixed(4)}°, ${live.iss.lon.toFixed(4)}°`;
      }
      if (obj.type === "Zvijezda" && live.solar) {
        obj.data["Kp Index"]      = String(live.solar.kp_index);
        obj.data["Flare klasa"]   = live.solar.flare_class;
        obj.data["Sunčev vjetar"] = `${live.solar.solar_wind} km/s`;
      }
    }
    setHudObj(obj);
    setSelectedAsteroidId(null);
    if (obj) playSound("dataStream");
  }, []); // empty deps — reads live data via dataRef.current

  const handleBootDone = useCallback(() => {
    setBooting(false);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {/* Content */}
      <div className={`relative z-10 flex w-full h-full ${isLandscape ? "flex-row" : "flex-col sm:flex-row"}`}>
        {/* 3D Scene */}
        <div className={`relative bg-[#030509] min-w-0 overflow-hidden ${isLandscape ? "w-[65%]" : "shrink-0 h-[45dvh] sm:h-auto sm:flex-1"}`}>
          {/* Boot overlay */}
          {booting && <BootOverlay onDone={handleBootDone} />}

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

          {/* Cinematic HUD Focus Mode */}
          {hudObj && hudObj.name && (
            <SpaceFocusHUD
              obj={hudObj}
              dashData={data}
              onClose={() => {
                setHudObj(null);
                playSound("click");
              }}
            />
          )}

          {/* Instructions */}
          <div className="absolute bottom-3 right-4 z-10 text-[9px] font-mono text-text-secondary/30 pointer-events-none">
            Drag rotate / Scroll zoom / Click objects
          </div>

          <JarvisScene
            ref={jarvisRef}
            width={sceneSize.w}
            height={sceneSize.h}
            issData={data.iss ?? { lat: 0, lon: 0, altitude: 420, speed: 27600, visibility: "daylight", timestamp: 0 }}
            onSelectObject={handleObjectSelect}
          />
        </div>

        {/* Sidebar */}
        <div
          className={`bg-space-bg/95 backdrop-blur-xl border-l border-cyan-500/20 overflow-y-auto flex flex-col overscroll-contain ${isLandscape ? "shrink-0 w-[35%] max-w-[300px] max-h-full" : "flex-1 min-h-0 w-full sm:w-[380px] sm:shrink-0 sm:flex-none sm:max-h-full"}`}
          style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {/* Tabs */}
          <div className="flex border-b border-cyan-500/20 shrink-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabSwitch(tab.key)}
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
          <div className="flex-1 p-4 space-y-3 overflow-y-auto overscroll-contain" style={{ touchAction: "pan-y" }}>

            {/* ===== ISS ===== */}
            {activeTab === "iss" && (
              <>
                <div className="glass-card p-3 space-y-2 !hover:transform-none border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <h3 className="text-xs font-semibold text-cyan-400 font-mono">ISS STATUS</h3>
                    <button
                      onClick={() => handleSidebarItemClick({ type: "iss" })}
                      className="ml-auto text-[9px] font-mono text-cyan-400/50 hover:text-cyan-400 cursor-pointer"
                    >
                      FOCUS <ChevronRight className="w-2.5 h-2.5 inline" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-text-secondary text-[10px]">Visina</span>
                      <p className="font-mono font-bold text-text-primary">{data.iss?.altitude ?? 420} km</p>
                    </div>
                    <div>
                      <span className="text-text-secondary text-[10px]">Brzina</span>
                      <p className="font-mono font-bold text-text-primary">{(data.iss?.speed ?? 0).toLocaleString()} km/h</p>
                    </div>
                    <div>
                      <span className="text-text-secondary text-[10px]">Pozicija</span>
                      <p className="font-mono font-bold text-cyan-400 text-[11px]">{(data.iss?.lat ?? 0).toFixed(2)}°, {(data.iss?.lon ?? 0).toFixed(2)}°</p>
                    </div>
                    <div>
                      <span className="text-text-secondary text-[10px]">Period</span>
                      <p className="font-mono font-bold text-text-primary">{ISS_ORBITAL_PERIOD} min</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-text-secondary text-[10px]">Posada ({data.crew_count ?? 7})</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {ISS_CREW_NAMES.slice(0, data.crew_count ?? 7).map((name) => (
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

                {/* APOD — Slika Dana */}
                {data.apod && (
                  <div className="glass-card p-3 space-y-1.5 !hover:transform-none border-amber-500/20">
                    <h4 className="text-[11px] font-mono text-accent-amber">SLIKA DANA // APOD</h4>
                    <div className="h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
                    <p className="text-[11px] font-mono font-bold text-text-primary">{data.apod?.title ?? "—"}</p>
                    <p className="text-[10px] text-text-secondary leading-relaxed">{data.apod?.explanation ?? "—"}</p>
                    <p className="text-[9px] font-mono text-text-secondary/40">{data.apod?.date ?? "—"} — NASA APOD</p>
                  </div>
                )}

                {/* Probes section */}
                <div className="glass-card p-3 space-y-2 !hover:transform-none border-cyan-500/20">
                  <h4 className="text-[11px] font-mono text-cyan-400/70">SONDE U DUBOKOM SVEMIRU</h4>
                  {PROBES_DATASET.entries.map((probe) => (
                    <button
                      key={probe.id}
                      onClick={() => handleSidebarItemClick({ type: "probe", id: probe.id })}
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
                    <h3 className="text-xs font-semibold text-text-primary font-mono">NEO — {data.neo_count ?? 0} danas</h3>
                  </div>
                  <div className="space-y-2">
                    {(data.neo_closest ? [{
                      name: data.neo_closest.name,
                      distanceLD: data.neo_closest.distance_ld,
                      diameterM: data.neo_closest.diameter_m,
                      speedKmH: data.neo_closest.speed_kmh,
                      hazardous: data.neo_closest.hazardous,
                    }] : []).map((a) => {
                      const neoData = NEO_DATASET.entries.find((n) => n.name === a.name);
                      return (
                        <button
                          key={a.name}
                          onClick={() => {
                            setSelectedAsteroid(selectedAsteroid?.name === a.name ? null : a);
                            if (neoData) handleSidebarItemClick({ type: "asteroid", id: neoData.id });
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
                            <span className={`font-mono text-[11px] ${a.hazardous ? "text-red-400" : "text-green-400"}`}>{a.distanceLD.toFixed(2)} LD</span>
                          </div>
                          <div className="flex gap-2 text-[10px] text-text-secondary">
                            <span>{a.diameterM.toFixed(0)}m</span>
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

                <button onClick={() => { focusOn({ type: "sun" }); playSound("ping"); }} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-400/5 border border-amber-400/15 text-[10px] font-mono text-accent-amber/60 hover:bg-amber-400/10 transition-colors cursor-pointer">
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
                        onClick={() => handleSidebarItemClick({ type: "dsn", id: stationData?.id || `dsn-${s.name}` })}
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
                  <h4 className="text-[11px] font-mono text-purple-400/70 mb-1">SONDE U SUSTAVU</h4>
                  {PROBES_DATASET.entries.map((probe) => (
                    <button
                      key={probe.id}
                      onClick={() => handleSidebarItemClick({ type: "probe", id: probe.id })}
                      className="w-full flex items-center justify-between text-[11px] p-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${probe.status === "active" ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                        <span className="font-mono text-text-primary">{probe.name}</span>
                      </div>
                      <span className="text-text-secondary font-mono text-[10px]">{probe.distanceFromSun}</span>
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
                    <span className="text-[8px] font-mono ml-auto">
                      {data.upcoming_launches?.length > 0
                        ? <span className="text-green-400">● LIVE {data.upcoming_launches.length}</span>
                        : <span className="text-text-secondary">mock</span>}
                    </span>
                  </div>
                  {data.upcoming_launches?.length > 0
                    ? data.upcoming_launches.map((launch, idx) => {
                        const tMinus = launch.t_minus_hours;
                        const tStr = tMinus != null
                          ? (tMinus < 0 ? `T+${Math.abs(tMinus).toFixed(1)}h` : `T-${tMinus.toFixed(1)}h`)
                          : "—";
                        const isFirst = idx === 0;
                        return (
                          <div key={launch.id} className={`p-2 rounded-lg border ${isFirst ? "border-amber-500/30 bg-amber-500/5" : "border-white/5"}`}>
                            {isFirst && launch.image && (
                              <div className="w-full h-14 rounded-md overflow-hidden mb-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={launch.image} alt={launch.name} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex items-start justify-between gap-1 mb-0.5">
                              <span className="text-[10px] font-mono font-bold text-text-primary leading-tight">{launch.name}</span>
                              <span className={`text-[8px] font-mono px-1 py-0.5 rounded-full shrink-0 ${
                                launch.status.includes("Go") || launch.status.includes("Successful") ? "bg-green-400/20 text-green-400" :
                                launch.status.includes("Hold") ? "bg-red-400/20 text-red-400" :
                                "bg-gray-400/20 text-gray-400"
                              }`}>{launch.status.slice(0, 10)}</span>
                            </div>
                            <div className="text-[9px] text-text-secondary font-mono space-y-0.5">
                              <p className={isFirst ? "text-amber-400/80" : ""}>{launch.rocket} — {launch.provider}</p>
                              <div className="flex items-center justify-between">
                                <span>{launch.net ? new Date(launch.net).toLocaleString("hr-HR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                                <span className={`font-bold ${tMinus != null && tMinus < 24 ? "text-amber-400" : "text-cyan-400/70"}`}>{tStr}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    : LAUNCH_DATA.entries.map((launch) => (
                        <div key={launch.id} className="p-2 rounded-lg border border-white/5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono font-bold text-text-primary">{launch.mission}</span>
                            <span className="text-[8px] font-mono px-1 py-0.5 rounded-full bg-gray-400/20 text-gray-400">{launch.status.toUpperCase()}</span>
                          </div>
                          <div className="text-[9px] text-text-secondary font-mono">
                            <p>{launch.vehicle} — {launch.provider}</p>
                            <p>{new Date(launch.launchTime).toLocaleString()}</p>
                          </div>
                        </div>
                      ))
                  }
                </div>
                <div className="text-[9px] font-mono text-text-secondary/40 text-center">
                  The Space Devs API — api.thespacedevs.com
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
                  {/* Jupiter position computed from J2000 */}
                  {(() => {
                    const jup = getJupiterDeclination();
                    const decSign = jup.decDeg >= 0 ? "+" : "";
                    const raH = Math.floor(jup.raDeg / 15);
                    const raM = Math.floor(((jup.raDeg / 15) % 1) * 60);
                    // Io orbital period 1.769 days — current Io longitude (rough)
                    const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
                    const daysSinceJ2000 = (Date.now() - J2000) / 86400000;
                    const ioLon = ((daysSinceJ2000 / 1.769) * 360) % 360;
                    // Burst windows at Io-A (~90°), Io-B (~200°), Io-C (~300°), Io-D (~150°)
                    const ioPhaseDeg: Record<string, number> = { "Io-A": 90, "Io-B": 200, "Io-C": 300, "Io-D": 150 };
                    const getIoStatus = (target: number) => {
                      const diff = Math.abs(((ioLon - target + 540) % 360) - 180);
                      if (diff < 25) return { label: "ACTIVE", color: "text-green-400" };
                      if (diff < 60) return { label: "SOON", color: "text-amber-400" };
                      return { label: `${Math.round(diff)}°`, color: "text-text-secondary/60" };
                    };
                    return (
                      <div className="p-2 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          <span className="text-[11px] font-mono font-bold text-text-primary">Jupiter — trenutna pozicija</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                          <div className="col-span-1 bg-white/5 rounded p-1.5 text-center">
                            <p className="text-text-secondary text-[8px]">Deklinacija</p>
                            <p className="text-amber-400 font-bold">{decSign}{jup.decDeg.toFixed(2)}°</p>
                          </div>
                          <div className="col-span-1 bg-white/5 rounded p-1.5 text-center">
                            <p className="text-text-secondary text-[8px]">RA (J2000)</p>
                            <p className="text-amber-400 font-bold">{raH}h {raM}m</p>
                          </div>
                          <div className="col-span-1 bg-white/5 rounded p-1.5 text-center">
                            <p className="text-text-secondary text-[8px]">Dist.</p>
                            <p className="text-amber-400 font-bold">{jup.distAU.toFixed(2)} AU</p>
                          </div>
                        </div>
                        <div className="text-[10px] text-text-secondary font-mono">
                          <p>Io faze — optimalan radio prijem:</p>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {Object.entries(ioPhaseDeg).map(([phase, target]) => {
                            const s = getIoStatus(target);
                            return (
                              <div key={phase} className="text-center p-1 rounded bg-white/5">
                                <p className="text-[8px] font-mono text-text-secondary">{phase}</p>
                                <p className={`text-[9px] font-mono font-bold ${s.color}`}>{s.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="p-2 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                      <span className="text-[11px] font-mono font-bold text-text-primary">Sunce — radio burstovi</span>
                      {data.solar && (
                        <span className={`text-[9px] font-mono ml-auto ${
                          data.solar.kp_index > 5 ? "text-red-400" : data.solar.kp_index > 2 ? "text-amber-400" : "text-green-400"
                        }`}>Kp {data.solar.kp_index.toFixed(1)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-secondary font-mono">
                      {data.solar?.flare_class
                        ? `Aktivna klasa: ${data.solar.flare_class} — Solarni vjetar: ${data.solar.solar_wind} km/s`
                        : "Nema live podataka o burstovima"}
                    </p>
                  </div>
                  <p className="text-[9px] font-mono text-text-secondary/40 text-center pt-1">
                    Live API za JOVE detekcije nije javno dostupan — pratite live stream ispod
                  </p>
                </div>

                {/* JOVE Live Stream — link (embedding disabled by channel) */}
                <div className="glass-card p-3 space-y-2 !hover:transform-none border-red-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <h4 className="text-[11px] font-mono text-red-400">LIVE STREAM — 20.1 MHz</h4>
                  </div>
                  <p className="text-[10px] text-text-secondary leading-relaxed">
                    Radio JOVE 24/7 live spectrograf i audio s K4LED opservatorija (Georgia, SAD).
                    SDRplay prijemnik na 16-24 MHz — prikazuje radio emisije Jupitera, Sunca i galaktičke pozadine u realnom vremenu.
                    Spektrogram prikazuje frekvenciju (y-os) vs. vrijeme (x-os), a boje označavaju intenzitet signala.
                  </p>
                  <a
                    href="https://www.youtube.com/watch?v=wjYIvyCkj-4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-mono font-bold text-red-400">Otvori Live Stream na YouTube</p>
                      <p className="text-[9px] font-mono text-text-secondary">K4LED Observatory — 24/7 spectrogram + audio</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-red-400/50" />
                  </a>
                  <p className="text-[8px] font-mono text-text-secondary/40 text-center">
                    NASA Radio JOVE Citizen Science — radiojove.gsfc.nasa.gov
                  </p>
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
