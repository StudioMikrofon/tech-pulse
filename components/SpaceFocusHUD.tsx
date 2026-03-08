"use client";

import { useState, useEffect, useMemo } from "react";
import type { DashboardData } from "@/lib/space-pro-data";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FocusObject {
  type: string;  // "ISS" | "Asteroid" | "DSN" | "Solar" | "Sonda" | "Planet" | ...
  name: string;
  data: Record<string, string>;
}

interface SpaceFocusHUDProps {
  obj: FocusObject | null;
  dashData: DashboardData;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Accent palette
// ---------------------------------------------------------------------------

const ACCENT: Record<string, string> = {
  cyan:   "#00cfff",
  amber:  "#00cfff",
  red:    "#00cfff",
  purple: "#00cfff",
  green:  "#00cfff",
};

type AccentKey = "cyan" | "amber" | "red" | "purple" | "green";

// ---------------------------------------------------------------------------
// Corner bracket SVG
// ---------------------------------------------------------------------------

function CB({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const s = 10;
  const d = {
    tl: `M${s},0 L0,0 L0,${s}`,
    tr: `M0,0 L${s},0 L${s},${s}`,
    bl: `M0,0 L0,${s} L${s},${s}`,
    br: `M${s},0 L${s},${s} L0,${s}`,
  }[pos];
  return (
    <svg
      width={s + 2} height={s + 2}
      className={`absolute ${pos === "tl" ? "top-0 left-0" : pos === "tr" ? "top-0 right-0" : pos === "bl" ? "bottom-0 left-0" : "bottom-0 right-0"}`}
    >
      <path d={d} fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Terminal typing hook
// ---------------------------------------------------------------------------

function useTyping(text: string, speedMs = 10) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setOut(""); setDone(false);
    let i = 0;
    const t = setInterval(() => {
      if (i < text.length) { setOut(text.slice(0, ++i)); }
      else { setDone(true); clearInterval(t); }
    }, speedMs);
    return () => clearInterval(t);
  }, [text, speedMs]);
  return { out, done };
}

// ---------------------------------------------------------------------------
// Telemetry row
// ---------------------------------------------------------------------------

type RowStatus = "ok" | "warn" | "alert" | "info";

interface TRow { label: string; value: string; status?: RowStatus }

function TelRow({ label, value, status = "ok" }: TRow) {
  const col = "text-cyan-400";
  const dot = status === "alert" ? "bg-cyan-400 animate-pulse" : status === "warn" ? "bg-cyan-300 animate-pulse" : "bg-cyan-400/60";
  return (
    <div className="flex items-center justify-between py-[3px] border-b border-white/5 last:border-0">
      <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest shrink-0 mr-1">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className={`text-[10px] font-mono font-bold truncate ${col}`}>{value}</span>
        <span className={`w-1 h-1 rounded-full shrink-0 ${dot}`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HUD panel — one corner
// ---------------------------------------------------------------------------

type Corner = "tl" | "tr" | "bl" | "br";

function Panel({
  corner, label, badge, accent = "cyan", delay = 0, children,
}: {
  corner: Corner; label: string; badge?: string; accent?: AccentKey; delay?: number; children: React.ReactNode;
}) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [delay]);

  const pos = {
    tl: "top-14 left-4",
    tr: "top-14 right-4",
    bl: "bottom-8 left-4",
    br: "bottom-8 right-4",
  }[corner];

  const origin = {
    tl: "origin-top-left", tr: "origin-top-right",
    bl: "origin-bottom-left", br: "origin-bottom-right",
  }[corner];

  const hex = ACCENT[accent];

  return (
    <div className={`absolute ${pos} w-52 z-10 ${origin} transition-all duration-500 ${vis ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
      <div
        className="relative bg-black/85 backdrop-blur-md"
        style={{ border: `1px solid ${hex}22`, boxShadow: `0 0 20px ${hex}08, inset 0 0 20px rgba(0,0,0,0.3)` }}
      >
        <CB pos="tl" /><CB pos="tr" /><CB pos="bl" /><CB pos="br" />

        {/* Top accent line */}
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${hex}90, transparent)` }} />

        {/* Header */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/5">
          <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: hex }} />
          <span className="text-[8px] font-mono font-bold uppercase tracking-widest truncate" style={{ color: hex }}>{label}</span>
          {badge && <span className="ml-auto text-[7px] font-mono text-white/20 shrink-0">{badge}</span>}
        </div>

        {/* Content */}
        <div className="px-2.5 py-2 space-y-0">{children}</div>

        {/* Bottom accent */}
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${hex}25, transparent)` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Focus reticle — CSS rings, no canvas
// ---------------------------------------------------------------------------

function Reticle({ vis }: { vis: boolean }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-700 ${vis ? "opacity-100" : "opacity-0"}`}>
      {/* Slow rotating outer rings */}
      <div className="absolute w-48 h-48 rounded-full border border-cyan-400/6 animate-spin" style={{ animationDuration: "30s" }} />
      <div className="absolute w-36 h-36 rounded-full border border-cyan-400/8 animate-spin" style={{ animationDuration: "20s", animationDirection: "reverse" }} />

      {/* Segmented ring */}
      <svg className="absolute w-28 h-28" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="none" stroke="#00d4ff" strokeWidth="0.5" strokeDasharray="10 7" opacity="0.2" />
        {/* 4 arc ticks at cardinal points */}
        {[0, 90, 180, 270].map(a => (
          <line
            key={a}
            x1={50 + 43 * Math.cos((a - 5) * Math.PI / 180)} y1={50 + 43 * Math.sin((a - 5) * Math.PI / 180)}
            x2={50 + 50 * Math.cos((a - 5) * Math.PI / 180)} y2={50 + 50 * Math.sin((a - 5) * Math.PI / 180)}
            stroke="#00d4ff" strokeWidth="1.5" opacity="0.5"
          />
        ))}
      </svg>

      {/* Crosshair */}
      <div className="absolute w-20 h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent" />
      <div className="absolute h-20 w-px bg-gradient-to-b from-transparent via-cyan-400/25 to-transparent" />

      {/* Center dot */}
      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 8px #00d4ff, 0 0 20px #00d4ff44" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connector lines — SVG dashed diagonals from center to corners
// ---------------------------------------------------------------------------

function Lines({ vis }: { vis: boolean }) {
  return (
    <svg className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000 ${vis ? "opacity-100" : "opacity-0"}`}>
      <defs>
        {(["tl", "tr", "bl", "br"] as const).map((id) => {
          const x2 = id.includes("r") ? "100%" : "0%";
          const y2 = id.includes("b") ? "100%" : "0%";
          return (
            <linearGradient key={id} id={`lg-${id}`} x1="50%" y1="50%" x2={x2} y2={y2} gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
            </linearGradient>
          );
        })}
      </defs>
      <line x1="50%" y1="50%" x2="16%" y2="12%" stroke="url(#lg-tl)" strokeWidth="0.5" strokeDasharray="5 6" />
      <line x1="50%" y1="50%" x2="84%" y2="12%" stroke="url(#lg-tr)" strokeWidth="0.5" strokeDasharray="5 6" />
      <line x1="50%" y1="50%" x2="16%" y2="88%" stroke="url(#lg-bl)" strokeWidth="0.5" strokeDasharray="5 6" />
      <line x1="50%" y1="50%" x2="84%" y2="88%" stroke="url(#lg-br)" strokeWidth="0.5" strokeDasharray="5 6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Scanline overlay
// ---------------------------------------------------------------------------

function Scanlines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.008) 3px, rgba(0,212,255,0.008) 4px)",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Per-object data builders
// ---------------------------------------------------------------------------

interface BuiltData {
  hero: TRow[];
  telemetry: TRow[];
  aiNote: string;
  events: { time: string; label: string; color: string }[];
  accent: AccentKey;
}

function buildISS(dash: DashboardData): BuiltData {
  const iss = dash.iss;
  const hemisphere = iss ? (iss.lat > 0 ? "northern" : "southern") : "equatorial";
  const sunlit = iss?.visibility === "daylight";

  return {
    hero: [
      { label: "STATUS",   value: "NOMINAL",                              status: "ok" },
      { label: "ALTITUDE", value: `${iss?.altitude ?? 420} km`,           status: "info" },
      { label: "VELOCITY", value: `${((iss?.speed ?? 27600) / 1000).toFixed(2)} km/s`, status: "ok" },
      { label: "CREW",     value: `${dash.crew_count ?? 7} persons`,      status: "ok" },
    ],
    telemetry: [
      { label: "LAT",        value: `${(iss?.lat ?? 0).toFixed(4)}°`,    status: "info" },
      { label: "LON",        value: `${(iss?.lon ?? 0).toFixed(4)}°`,    status: "info" },
      { label: "INCL",       value: "51.64°",                            status: "ok" },
      { label: "PERIOD",     value: "91.7 min",                          status: "ok" },
      { label: "VISIBILITY", value: sunlit ? "SUNLIT" : "ECLIPSE",       status: sunlit ? "ok" : "warn" },
    ],
    aiNote: `ISS Alpha maintains stable low Earth orbit at ~${iss?.altitude ?? 420}km. Tracking across ${hemisphere} hemisphere at ${((iss?.speed ?? 27600) / 1000).toFixed(1)} km/s. ${sunlit ? "Currently illuminated — visible from ground with naked eye." : "In orbital eclipse — battery systems nominal, full power on next orbital sunrise."} ${dash.crew_count ?? 7}-person crew aboard. Orbital period 91.7 minutes.`,
    events: [
      { time: "NOW",   label: sunlit ? "Orbital daylight"    : "Orbital eclipse",       color: "cyan" },
      { time: "T+46m", label: "Next terminator crossing",                                color: "amber" },
      { time: "T+92m", label: "Full orbit complete",                                     color: "cyan" },
    ],
    accent: "cyan",
  };
}

function buildAsteroid(dash: DashboardData): BuiltData {
  const neo = dash.neo_closest;
  const hazardous = neo?.hazardous ?? false;

  return {
    hero: [
      { label: "CLASS",    value: "NEO / APOLLO",                              status: "info" },
      { label: "HAZARD",   value: hazardous ? "PHA — ALERT" : "NON-PHA",      status: hazardous ? "alert" : "ok" },
      { label: "DIAMETER", value: `~${neo?.diameter_m ?? 0} m`,               status: "info" },
      { label: "SPEED",    value: `${((neo?.speed_kmh ?? 0) / 1000).toFixed(2)} km/s`, status: "warn" },
    ],
    telemetry: [
      { label: "MISS DIST", value: `${neo?.distance_ld?.toFixed(3) ?? "?"} LD`,        status: hazardous ? "alert" : "ok" },
      { label: "DIST KM",   value: `${(neo?.distance_km ?? 0).toLocaleString()} km`,   status: "info" },
      { label: "APPROACH",  value: neo?.approach_time ? new Date(neo.approach_time).toLocaleDateString() : "—", status: "warn" },
      { label: "NEO TODAY", value: `${dash.neo_count ?? 0} tracked`,                   status: "ok" },
      { label: "HAZARDOUS", value: `${dash.neo_hazardous ?? 0} PHA`,                   status: (dash.neo_hazardous ?? 0) > 0 ? "warn" : "ok" },
    ],
    aiNote: `Near-Earth Object ${neo?.name ?? "Unknown"} on close approach at ${neo?.distance_ld?.toFixed(2) ?? "?"} LD (${(neo?.distance_km ?? 0).toLocaleString()} km). ${hazardous ? "CLASSIFIED POTENTIALLY HAZARDOUS — trajectory within 0.05 AU, diameter above 140m threshold. Active monitoring required." : "Non-hazardous trajectory confirmed. Miss distance well outside planetary defense threshold."} Estimated diameter ${neo?.diameter_m ?? "?"}m, relative velocity ${((neo?.speed_kmh ?? 0) / 1000).toFixed(1)} km/s.`,
    events: [
      { time: "NOW",  label: "Active tracking",                                          color: "cyan" },
      { time: neo?.approach_time ? new Date(neo.approach_time).toLocaleDateString() : "TODAY", label: "Close approach", color: hazardous ? "red" : "amber" },
      { time: "POST", label: "Receding trajectory",                                      color: "cyan" },
    ],
    accent: hazardous ? "red" : "amber",
  };
}

function buildSolar(dash: DashboardData): BuiltData {
  const sol = dash.solar;
  const kp = sol?.kp_index ?? 0;
  const kpStatus: RowStatus = kp >= 7 ? "alert" : kp >= 5 ? "warn" : "ok";
  const wind = sol?.solar_wind ?? 400;
  const windStatus: RowStatus = wind > 600 ? "warn" : "ok";

  return {
    hero: [
      { label: "KP INDEX",    value: `${kp} / 9`,                       status: kpStatus },
      { label: "FLARE CLASS", value: sol?.flare_class ?? "B1.0",        status: kp > 3 ? "warn" : "ok" },
      { label: "SOLAR WIND",  value: `${wind} km/s`,                    status: windStatus },
      { label: "AURORA",      value: (sol?.aurora_chance ?? "none").toUpperCase(), status: sol?.aurora_chance === "high" || sol?.aurora_chance === "storm" ? "alert" : "info" },
    ],
    telemetry: [
      { label: "X-RAY FLUX",  value: `${sol?.flux?.toExponential(2) ?? "—"}`,  status: "info" },
      { label: "GEO STORM",   value: kp >= 7 ? "SEVERE" : kp >= 5 ? "MODERATE" : "QUIET", status: kpStatus },
      { label: "UPDATED",     value: sol?.updated ? new Date(sol.updated).toLocaleTimeString() : "—", status: "ok" },
    ],
    aiNote: `Solar activity report: Kp index ${kp}/9 — ${kp >= 7 ? "severe geomagnetic storm in progress. HF radio blackout likely. Satellite drag elevated." : kp >= 5 ? "moderate storm — aurora visible at high latitudes, minor radio interference." : "space weather quiet, all systems nominal."}  ${sol?.flare_class} solar flare detected. Wind at ${wind} km/s. Aurora probability: ${sol?.aurora_chance ?? "none"}.`,
    events: [
      { time: "NOW",   label: `Kp=${kp} — ${kp >= 5 ? "Storm active" : "Quiet"}`,     color: kp >= 5 ? "red" : "cyan" },
      { time: "NOAA",  label: sol?.flare_class ? `${sol.flare_class} flare detected` : "No flares", color: "amber" },
    ],
    accent: kp >= 7 ? "red" : kp >= 5 ? "amber" : "cyan",
  };
}

function buildLaunch(dash: DashboardData): BuiltData {
  const launch = dash.next_launch;
  const tMinus = launch?.t_minus_hours;
  const tStr = tMinus != null ? `${tMinus > 0 ? "T-" : "T+"}${Math.abs(tMinus).toFixed(1)}h` : "—";

  return {
    hero: [
      { label: "MISSION",  value: (launch?.name ?? "—").split("|")[0].trim().slice(0, 20), status: "info" },
      { label: "VEHICLE",  value: launch?.rocket ?? "—",                                   status: "ok" },
      { label: "PROVIDER", value: (launch?.provider ?? "—").slice(0, 18),                  status: "ok" },
      { label: "STATUS",   value: (launch?.status ?? "—").toUpperCase().slice(0, 18),      status: "ok" },
    ],
    telemetry: [
      { label: "T-MINUS", value: tStr, status: tMinus != null && tMinus > 0 && tMinus < 1 ? "alert" : "info" },
      { label: "PAD",     value: (launch?.pad ?? "—").slice(0, 24), status: "ok" },
    ],
    aiNote: `${launch?.name ?? "Mission"}. Vehicle: ${launch?.rocket ?? "—"} (${launch?.provider ?? "—"}). ${tMinus != null && tMinus > 0 ? `T-${tMinus.toFixed(1)}h to launch window. Pad: ${launch?.pad ?? "—"}.` : "Launch window closed."} ${launch?.mission?.slice(0, 120) ?? ""}`,
    events: [
      { time: tStr, label: launch?.status ?? "Standby",  color: "amber" },
    ],
    accent: "amber",
  };
}

function buildDSN(obj: FocusObject): BuiltData {
  return {
    hero: [
      { label: "STATION",  value: obj.name,     status: "ok" },
      { label: "NETWORK",  value: "NASA DSN",   status: "info" },
      { label: "STATUS",   value: "ACTIVE",     status: "ok" },
      { label: "FREQ",     value: "X / Ka Band", status: "ok" },
    ],
    telemetry: [
      { label: "SIGNAL",   value: "ACQUIRED",   status: "ok" },
      { label: "UPLINK",   value: "7.19 GHz",   status: "ok" },
      { label: "DOWNLINK", value: "8.44 GHz",   status: "ok" },
    ],
    aiNote: `Deep Space Network ground station ${obj.name}. Maintains 24/7 uplink/downlink with interplanetary missions. X-Band and Ka-Band capable. One-way light time to Voyager 1: ~22+ hours. Station is part of the global 3-station DSN array providing continuous deep-space coverage.`,
    events: [
      { time: "NOW",   label: "Signal locked",         color: "green" },
      { time: "24/7",  label: "Continuous coverage",   color: "cyan" },
    ],
    accent: "purple",
  };
}

function buildProbe(obj: FocusObject): BuiltData {
  const entries = Object.entries(obj.data);
  return {
    hero: entries.slice(0, 4).map(([label, value]) => ({
      label: label.slice(0, 12).toUpperCase(), value: String(value).slice(0, 18), status: "info" as RowStatus,
    })),
    telemetry: entries.slice(4, 8).map(([label, value]) => ({
      label: label.slice(0, 12).toUpperCase(), value: String(value).slice(0, 18), status: "ok" as RowStatus,
    })),
    aiNote: `${obj.name} deep space probe — active mission. ${entries.slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(". ")}. Signal received from JPL mission operations center.`,
    events: [
      { time: "NOW",  label: "Telemetry stream active", color: "cyan" },
      { time: "LIVE", label: "JPL DSN contact",          color: "green" },
    ],
    accent: "cyan",
  };
}

function buildGeneric(obj: FocusObject): BuiltData {
  const entries = Object.entries(obj.data);
  return {
    hero: entries.slice(0, 4).map(([label, value]) => ({
      label: label.slice(0, 12).toUpperCase(), value: String(value).slice(0, 18), status: "info" as RowStatus,
    })),
    telemetry: entries.slice(4, 8).map(([label, value]) => ({
      label: label.slice(0, 12).toUpperCase(), value: String(value).slice(0, 18), status: "ok" as RowStatus,
    })),
    aiNote: `${obj.type}: ${obj.name}. Object tracked and identified. ${entries.slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(". ")}.`,
    events: [{ time: "NOW", label: "Object locked", color: "cyan" }],
    accent: "cyan",
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SpaceFocusHUD({ obj, dashData, onClose }: SpaceFocusHUDProps) {
  const [vis, setVis] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  useEffect(() => {
    if (obj) {
      setVis(false);
      const t = setTimeout(() => setVis(true), 60);
      return () => clearTimeout(t);
    } else {
      setVis(false);
    }
  }, [obj?.name, obj?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const built = useMemo<BuiltData | null>(() => {
    if (!obj) return null;
    const t = obj.type.toLowerCase();
    if (t === "iss")                          return buildISS(dashData);
    if (t === "asteroid")                     return buildAsteroid(dashData);
    if (t === "solar" || t.includes("solar")) return buildSolar(dashData);
    if (t === "launch")                       return buildLaunch(dashData);
    if (t === "dsn")                          return buildDSN(obj);
    if (t === "sonda")                        return buildProbe(obj);
    return buildGeneric(obj);
  }, [obj, dashData]);

  const { out: aiText, done: aiDone } = useTyping(built?.aiNote ?? "", 9);

  if (!obj || !built) return null;

  const accent = built.accent;
  const hex = ACCENT[accent];
  const timeStr = new Date().toLocaleTimeString("en-GB", { hour12: false });

  return (
    <div className={`absolute inset-0 transition-opacity duration-300 ${vis ? "opacity-100" : "opacity-0"}`}>
      <Scanlines />
      <Lines vis={vis} />
      <Reticle vis={vis} />

      {/* Status bar — top center */}
      <div
        className={`absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1 border transition-all duration-700 ${vis ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
        style={{ background: "rgba(0,0,0,0.7)", borderColor: `${hex}30`, backdropFilter: "blur(8px)" }}
      >
        <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: hex }} />
        <span className="text-[8px] font-mono uppercase tracking-widest" style={{ color: hex }}>
          {obj.type} // {obj.name.slice(0, 24)}
        </span>
        <div className="w-px h-3 bg-white/10 mx-1" />
        <span className="text-[7px] font-mono text-white/25">SIGNAL LOCKED</span>
        <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute z-20 font-mono text-[8px] text-white/25 hover:text-cyan-400 transition-colors cursor-pointer border border-white/8 hover:border-cyan-400/30 px-2 py-1"
        style={{ top: "50px", right: "16px" }}
      >
        [ESC]
      </button>

      {/* Corner HUD panels — hidden on mobile portrait, scaled on landscape */}
      {!isPortrait && (
        <div style={isMobile ? { transform: "scale(0.72)", transformOrigin: "top left" } : undefined}>
          {/* TOP-LEFT — Primary data */}
          <Panel corner="tl" label={`${obj.type} — ${obj.name.slice(0, 16)}`} badge="PRIMARY" accent={accent} delay={0}>
            {built.hero.map((r, i) => <TelRow key={i} label={r.label} value={r.value} status={r.status} />)}
          </Panel>

          {/* TOP-RIGHT — Live telemetry */}
          <Panel corner="tr" label="Live Telemetry" badge="SRC:LIVE" accent="cyan" delay={100}>
            {built.telemetry.map((r, i) => <TelRow key={i} label={r.label} value={r.value} status={r.status} />)}
            <div className="mt-1.5 flex items-center gap-1">
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #00cfff40, transparent)" }} />
              <span className="text-[7px] font-mono text-white/20">LIVE</span>
              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
            </div>
          </Panel>
        </div>
      )}

      {/* Bottom panels — hidden on mobile */}
      {!isMobile && (
        <>
          {/* BOTTOM-LEFT — AI mission intelligence */}
          <Panel corner="bl" label="Mission Intelligence" badge="AI·ANALYSIS" accent="cyan" delay={220}>
            <p className="text-[9px] font-mono text-white/45 leading-relaxed">
              {aiText}
              {!aiDone && <span className="text-cyan-400 animate-pulse">▌</span>}
            </p>
          </Panel>

          {/* BOTTOM-RIGHT — Event log */}
          <Panel corner="br" label="Event Log" badge={timeStr} accent="cyan" delay={340}>
            <div className="space-y-0">
              {built.events.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 py-[3px] border-b border-white/5 last:border-0">
                  <span className="text-[7px] font-mono text-white/20 w-10 shrink-0">{e.time}</span>
                  <div className="w-1 h-1 rounded-full shrink-0" style={{ background: "#00cfff" }} />
                  <span className="text-[8px] font-mono text-white/35 leading-none">{e.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[7px] font-mono text-cyan-400/40">SIGNAL LOCKED</span>
              <span className="ml-auto text-[7px] font-mono text-white/15">{timeStr}</span>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
