import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SolarData {
  kpIndex: number;
  flareClass: string;
  solarWind: number; // km/s
  auroraChance: "none" | "low" | "moderate" | "high" | "storm";
}

export interface AsteroidDetail {
  name: string;
  distanceLD: number;
  diameterM: number;
  speedKmH: number;
  hazardous: boolean;
}

export interface AsteroidData {
  countToday: number;
  closestDistanceLD: number; // lunar distances
  closestName: string;
  hazardousCount: number;
  asteroidList: AsteroidDetail[];
}

export interface ISSData {
  altitude: number; // km
  speed: number; // km/h
  lat: number;
  lon: number;
  crew: number;
}

export interface DeepSpaceLink {
  name: string;
  distance: string;
  status: "active" | "idle";
}

export interface DeepSpaceData {
  activeLinks: DeepSpaceLink[];
}

export interface CosmicData {
  recentGW: string | null;
  frbCount: number;
}

export interface APODData {
  title: string;
  description: string;
  date: string;
}

export interface LightData {
  sunrise: string;
  sunset: string;
  moonPhase: string;
  moonIllumination: number; // percent
  location: string;
}

export interface SpaceProSummary {
  solar: SolarData;
  asteroids: AsteroidData;
  iss: ISSData;
  deepSpace: DeepSpaceData;
  cosmic: CosmicData;
  apod: APODData;
  light: LightData;
  lastUpdated: string; // ISO string — fixed for SSR
  stale: boolean;
}

// ---------------------------------------------------------------------------
// DSN Ground Stations
// ---------------------------------------------------------------------------

export const DSN_STATIONS = [
  { name: "Goldstone", lat: 35.4267, lon: -116.89, country: "SAD" },
  { name: "Madrid", lat: 40.4316, lon: -4.2486, country: "Španjolska" },
  { name: "Canberra", lat: -35.4014, lon: 148.9819, country: "Australija" },
];

// ---------------------------------------------------------------------------
// Mock data (fixed timestamps to avoid hydration mismatch)
// ---------------------------------------------------------------------------

export const MOCK_SPACE_DATA: SpaceProSummary = {
  solar: {
    kpIndex: 3,
    flareClass: "C2.1",
    solarWind: 420,
    auroraChance: "low",
  },
  asteroids: {
    countToday: 12,
    closestDistanceLD: 2.3,
    closestName: "2024 BX1",
    hazardousCount: 1,
    asteroidList: [
      { name: "2024 BX1", distanceLD: 2.3, diameterM: 48, speedKmH: 52400, hazardous: true },
      { name: "2026 DA14", distanceLD: 5.1, diameterM: 120, speedKmH: 28300, hazardous: false },
      { name: "2025 YR2", distanceLD: 8.7, diameterM: 35, speedKmH: 41200, hazardous: false },
      { name: "2026 CK3", distanceLD: 12.4, diameterM: 210, speedKmH: 19800, hazardous: false },
      { name: "2024 QN1", distanceLD: 3.8, diameterM: 85, speedKmH: 63100, hazardous: true },
      { name: "2025 FW9", distanceLD: 18.2, diameterM: 15, speedKmH: 35600, hazardous: false },
    ],
  },
  iss: {
    altitude: 420,
    speed: 27600,
    lat: 41.2,
    lon: -73.8,
    crew: 7,
  },
  deepSpace: {
    activeLinks: [
      { name: "Voyager 1", distance: "24.5 B km", status: "active" },
      { name: "New Horizons", distance: "8.2 B km", status: "active" },
      { name: "JWST", distance: "1.5 M km", status: "active" },
    ],
  },
  cosmic: {
    recentGW: null,
    frbCount: 2,
  },
  apod: {
    title: "The Horsehead Nebula in Infrared",
    description:
      "One of the most identifiable nebulae in the sky, the Horsehead Nebula appears dark against a glowing background of interstellar gas.",
    date: "2026-02-27",
  },
  light: {
    sunrise: "06:42",
    sunset: "17:38",
    moonPhase: "Waxing Gibbous",
    moonIllumination: 78,
    location: "Zagreb, HR",
  },
  lastUpdated: "2026-02-27T12:00:00Z",
  stale: false,
};

// ---------------------------------------------------------------------------
// Data fetcher (swap this when backend is ready)
// ---------------------------------------------------------------------------

export function getSpaceProData(): SpaceProSummary {
  // TODO: Replace with fetch('/api/space/summary') when API is ready
  return MOCK_SPACE_DATA;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useSpaceProData() {
  const [data, setData] = useState<SpaceProSummary>(MOCK_SPACE_DATA);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In the future, this will fetch from API and set up polling
    setData(getSpaceProData());
    setLoading(false);
  }, []);

  return { data, loading };
}
