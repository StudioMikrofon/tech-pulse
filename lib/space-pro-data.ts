import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SolarData {
  kp_index: number;
  flare_class: string;
  solar_wind: number;
  aurora_chance: "none" | "low" | "moderate" | "high" | "storm";
  flux: number;
  updated: string;
}

export interface ISSData {
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  visibility: string;
  timestamp: number;
}

export interface NEOData {
  id: string;
  name: string;
  distance_km: number;
  distance_ld: number;
  speed_kmh: number;
  diameter_m: number;
  hazardous: boolean;
  approach_time: string;
}

export interface LaunchData {
  id: string;
  name: string;
  rocket: string;
  provider: string;
  pad: string;
  net: string;
  t_minus_hours: number | null;
  status: string;
  mission: string;
  image: string;
}

export interface SpaceAlert {
  id: string;
  severity: "blue" | "amber" | "red" | "purple";
  title: string;
  summary: string;
  timestamp: string;
}

export interface APODData {
  title: string;
  explanation: string;
  date: string;
  url: string;
  media_type: string;
}

export interface DashboardData {
  iss: ISSData | null;
  solar: SolarData | null;
  crew_count: number | null;
  next_launch: LaunchData | null;
  upcoming_launches: LaunchData[];
  neo_closest: NEOData | null;
  neo_count: number | null;
  neo_hazardous: number | null;
  dsn_active: number | null;
  alerts: SpaceAlert[];
  apod?: APODData | null;
  updated: string;
}

// ---------------------------------------------------------------------------
// DSN Ground Stations (statični, koordinate se ne mijenjaju)
// ---------------------------------------------------------------------------

export const DSN_STATIONS = [
  { name: "Goldstone", lat: 35.4267, lon: -116.89, country: "SAD" },
  { name: "Madrid",    lat: 40.4316, lon: -4.2486,  country: "Španjolska" },
  { name: "Canberra",  lat: -35.4014, lon: 148.9819, country: "Australija" },
];

// ---------------------------------------------------------------------------
// Fallback mock (dok se live podaci ne učitaju)
// ---------------------------------------------------------------------------

export const MOCK_DASHBOARD: DashboardData = {
  iss: { lat: 0, lon: 0, altitude: 420, speed: 27600, visibility: "daylight", timestamp: 0 },
  solar: { kp_index: 0, flare_class: "B1.0", solar_wind: 400, aurora_chance: "none", flux: 0, updated: "" },
  crew_count: 7,
  next_launch: null,
  upcoming_launches: [],
  neo_closest: null,
  neo_count: 0,
  neo_hazardous: 0,
  dsn_active: 0,
  alerts: [],
  updated: "",
};

// ---------------------------------------------------------------------------
// Live data hook — polling /api/space/dashboard
// ---------------------------------------------------------------------------

export function useSpaceProData(intervalMs = 10000) {
  const [data, setData] = useState<DashboardData>(MOCK_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetch("/api/space/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled && json.ok && json.data) {
          setData(json.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const timer = setInterval(fetchData, intervalMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [intervalMs]);

  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Specialized hooks za pojedine endpointe
// ---------------------------------------------------------------------------

export function useLiveISS(intervalMs = 5000) {
  const [data, setData] = useState<ISSData | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/space/iss", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) setData(json.data);
      } catch {}
    };
    fetch_();
    const t = setInterval(fetch_, intervalMs);
    return () => { cancelled = true; clearInterval(t); };
  }, [intervalMs]);
  return data;
}

export function useLiveSolar(intervalMs = 60000) {
  const [data, setData] = useState<SolarData | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/space/solar", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) setData(json.data);
      } catch {}
    };
    fetch_();
    const t = setInterval(fetch_, intervalMs);
    return () => { cancelled = true; clearInterval(t); };
  }, [intervalMs]);
  return data;
}

export function useLiveAlerts() {
  const [alerts, setAlerts] = useState<SpaceAlert[]>([]);
  useEffect(() => {
    let cancelled = false;
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/space/alerts", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) setAlerts(json.data);
      } catch {}
    };
    fetch_();
    const t = setInterval(fetch_, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  return alerts;
}
