/**
 * Space Tracker Data Layer
 * Structured data models for DSN stations, probes, asteroids, ISS.
 * Currently uses mock/placeholder data — swap with API fetch later.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrackerObject {
  id: string;
  name: string;
  type: "dsn" | "iss" | "probe" | "asteroid" | "station" | "user";
  lat?: number;
  lon?: number;
  color: string;
  // Solar system coordinates (AU from Sun) — for 3D solar view
  solarX?: number;
  solarY?: number;
  solarZ?: number;
  // Metadata
  meta: Record<string, string | number | boolean>;
}

export interface ProbeData {
  id: string;
  name: string;
  distanceFromSun: string; // e.g. "24.5 B km"
  distanceAU: number;
  speed: string; // km/s
  status: "active" | "idle" | "lost";
  launchYear: number;
  mission: string;
  // Trajectory: array of [angle, distance] for simplified 2D orbit
  trajectory: { angle: number; distance: number }[];
  // Position angle in solar system (degrees from Sun, 0 = right)
  positionAngle: number;
  lastSignal: string; // ISO timestamp
}

export interface NEOAsteroid {
  id: string;
  name: string;
  distanceLD: number;
  distanceKm: number;
  diameterM: number;
  speedKmH: number;
  hazardous: boolean;
  closestApproach: string; // ISO date
  approachAngle: number; // degrees, trajectory angle relative to Earth
  // Trajectory points for visualization
  trajectory: { x: number; y: number; z: number }[];
}

export interface TrackerDataset<T> {
  lastUpdated: string;
  source: string;
  entries: T[];
}

// ---------------------------------------------------------------------------
// DSN Ground Stations (enhanced)
// ---------------------------------------------------------------------------

export const DSN_GROUND_STATIONS: TrackerObject[] = [
  {
    id: "dsn-goldstone",
    name: "Goldstone",
    type: "dsn",
    lat: 35.4267,
    lon: -116.89,
    color: "#34D399",
    meta: {
      country: "SAD",
      antennas: 4,
      primaryDish: "70m DSS-14",
      activeMissions: "Voyager 1, MRO, JWST",
      signalStrength: 4,
    },
  },
  {
    id: "dsn-madrid",
    name: "Madrid",
    type: "dsn",
    lat: 40.4316,
    lon: -4.2486,
    color: "#34D399",
    meta: {
      country: "Španjolska",
      antennas: 4,
      primaryDish: "70m DSS-63",
      activeMissions: "Parker Solar Probe, OSIRIS-REx, Psyche",
      signalStrength: 5,
    },
  },
  {
    id: "dsn-canberra",
    name: "Canberra",
    type: "dsn",
    lat: -35.4014,
    lon: 148.9819,
    color: "#34D399",
    meta: {
      country: "Australija",
      antennas: 4,
      primaryDish: "70m DSS-43",
      activeMissions: "Voyager 2, New Horizons, Juno",
      signalStrength: 4,
    },
  },
];

// ---------------------------------------------------------------------------
// Active Deep Space Probes
// ---------------------------------------------------------------------------

export const PROBES_DATASET: TrackerDataset<ProbeData> = {
  lastUpdated: "2026-02-27T12:00:00Z",
  source: "NASA/JPL Horizons (mock)",
  entries: [
    {
      id: "voyager-1",
      name: "Voyager 1",
      distanceFromSun: "24.5 B km",
      distanceAU: 163.8,
      speed: "17.0 km/s",
      status: "active",
      launchYear: 1977,
      mission: "Interstellar space exploration",
      positionAngle: 35,
      lastSignal: "2026-02-27T08:00:00Z",
      trajectory: Array.from({ length: 60 }, (_, i) => ({
        angle: i * 6,
        distance: 2 + i * 2.7,
      })),
    },
    {
      id: "voyager-2",
      name: "Voyager 2",
      distanceFromSun: "20.6 B km",
      distanceAU: 137.4,
      speed: "15.4 km/s",
      status: "active",
      launchYear: 1977,
      mission: "Interstellar space exploration",
      positionAngle: 225,
      lastSignal: "2026-02-27T06:30:00Z",
      trajectory: Array.from({ length: 60 }, (_, i) => ({
        angle: 180 + i * 6,
        distance: 2 + i * 2.3,
      })),
    },
    {
      id: "new-horizons",
      name: "New Horizons",
      distanceFromSun: "8.2 B km",
      distanceAU: 54.8,
      speed: "14.1 km/s",
      status: "active",
      launchYear: 2006,
      mission: "Kuiper Belt exploration",
      positionAngle: 290,
      lastSignal: "2026-02-27T10:00:00Z",
      trajectory: Array.from({ length: 40 }, (_, i) => ({
        angle: 250 + i * 4,
        distance: 1 + i * 1.4,
      })),
    },
    {
      id: "jwst",
      name: "JWST",
      distanceFromSun: "1.5 M km",
      distanceAU: 1.01,
      speed: "0.3 km/s",
      status: "active",
      launchYear: 2021,
      mission: "L2 space telescope",
      positionAngle: 180,
      lastSignal: "2026-02-27T11:45:00Z",
      trajectory: [
        { angle: 175, distance: 1.01 },
        { angle: 180, distance: 1.01 },
        { angle: 185, distance: 1.01 },
      ],
    },
    {
      id: "parker-solar",
      name: "Parker Solar Probe",
      distanceFromSun: "21 M km",
      distanceAU: 0.14,
      speed: "195 km/s",
      status: "active",
      launchYear: 2018,
      mission: "Solar corona study",
      positionAngle: 95,
      lastSignal: "2026-02-27T11:00:00Z",
      trajectory: Array.from({ length: 30 }, (_, i) => ({
        angle: 60 + i * 12,
        distance: 0.05 + Math.sin(i * 0.5) * 0.7 + 0.2,
      })),
    },
    {
      id: "juno",
      name: "Juno",
      distanceFromSun: "778 M km",
      distanceAU: 5.2,
      speed: "13.1 km/s",
      status: "active",
      launchYear: 2011,
      mission: "Jupiter orbiter",
      positionAngle: 145,
      lastSignal: "2026-02-27T09:15:00Z",
      trajectory: Array.from({ length: 20 }, (_, i) => ({
        angle: 120 + i * 8,
        distance: 5.0 + Math.sin(i * 0.8) * 0.3,
      })),
    },
  ],
};

// ---------------------------------------------------------------------------
// NEO Asteroids (enhanced with trajectories)
// ---------------------------------------------------------------------------

function generateAsteroidTrajectory(approachAngle: number, distanceLD: number): { x: number; y: number; z: number }[] {
  const points: { x: number; y: number; z: number }[] = [];
  const scale = distanceLD * 0.5;
  for (let i = 0; i < 40; i++) {
    const t = (i - 20) * 0.15;
    const rad = (approachAngle * Math.PI) / 180;
    points.push({
      x: Math.cos(rad) * t * scale + Math.sin(rad) * 0.2,
      y: Math.sin(t * 0.3) * 0.5,
      z: Math.sin(rad) * t * scale - Math.cos(rad) * 0.2,
    });
  }
  return points;
}

export const NEO_DATASET: TrackerDataset<NEOAsteroid> = {
  lastUpdated: "2026-02-27T12:00:00Z",
  source: "NASA CNEOS (mock)",
  entries: [
    {
      id: "2024-bx1", name: "2024 BX1", distanceLD: 2.3, distanceKm: 883720,
      diameterM: 48, speedKmH: 52400, hazardous: true,
      closestApproach: "2026-02-27T18:30:00Z", approachAngle: 45,
      trajectory: generateAsteroidTrajectory(45, 2.3),
    },
    {
      id: "2026-da14", name: "2026 DA14", distanceLD: 5.1, distanceKm: 1960440,
      diameterM: 120, speedKmH: 28300, hazardous: false,
      closestApproach: "2026-02-28T03:00:00Z", approachAngle: 130,
      trajectory: generateAsteroidTrajectory(130, 5.1),
    },
    {
      id: "2025-yr2", name: "2025 YR2", distanceLD: 8.7, distanceKm: 3344280,
      diameterM: 35, speedKmH: 41200, hazardous: false,
      closestApproach: "2026-02-28T12:00:00Z", approachAngle: 220,
      trajectory: generateAsteroidTrajectory(220, 8.7),
    },
    {
      id: "2026-ck3", name: "2026 CK3", distanceLD: 12.4, distanceKm: 4766560,
      diameterM: 210, speedKmH: 19800, hazardous: false,
      closestApproach: "2026-03-01T06:00:00Z", approachAngle: 310,
      trajectory: generateAsteroidTrajectory(310, 12.4),
    },
    {
      id: "2024-qn1", name: "2024 QN1", distanceLD: 3.8, distanceKm: 1460720,
      diameterM: 85, speedKmH: 63100, hazardous: true,
      closestApproach: "2026-02-27T22:00:00Z", approachAngle: 170,
      trajectory: generateAsteroidTrajectory(170, 3.8),
    },
    {
      id: "2025-fw9", name: "2025 FW9", distanceLD: 18.2, distanceKm: 6996080,
      diameterM: 15, speedKmH: 35600, hazardous: false,
      closestApproach: "2026-03-02T08:00:00Z", approachAngle: 85,
      trajectory: generateAsteroidTrajectory(85, 18.2),
    },
  ],
};

// ---------------------------------------------------------------------------
// ISS orbit crew data
// ---------------------------------------------------------------------------

export const ISS_CREW_NAMES = [
  "Oleg Kononenko", "Nikolai Chub", "Tracy Dyson",
  "Matthew Dominick", "Mike Barratt", "Jeanette Epps",
  "Alexander Grebenkin",
];

export const ISS_ORBITAL_PERIOD = 92.68; // minutes
export const ISS_INCLINATION = 51.6; // degrees

// ---------------------------------------------------------------------------
// Telemetry stub (for future live data)
// ---------------------------------------------------------------------------

export interface TelemetryEntry {
  label: string;
  value: string;
  unit: string;
  status: "nominal" | "warning" | "critical";
}

export function getTelemetryStub(objectId: string): TelemetryEntry[] {
  switch (objectId) {
    case "iss":
      return [
        { label: "O₂ Level", value: "21.0", unit: "%", status: "nominal" },
        { label: "CO₂ Level", value: "0.04", unit: "%", status: "nominal" },
        { label: "Cabin Temp", value: "22.3", unit: "°C", status: "nominal" },
        { label: "Power Draw", value: "84.2", unit: "kW", status: "nominal" },
        { label: "Solar Array", value: "98.1", unit: "%", status: "nominal" },
      ];
    case "voyager-1":
      return [
        { label: "RTG Power", value: "249", unit: "W", status: "warning" },
        { label: "Signal Delay", value: "22.7", unit: "h", status: "nominal" },
        { label: "Data Rate", value: "160", unit: "bps", status: "nominal" },
        { label: "Instruments", value: "4/11", unit: "active", status: "warning" },
      ];
    default:
      return [
        { label: "Status", value: "Online", unit: "", status: "nominal" },
        { label: "Signal", value: "OK", unit: "", status: "nominal" },
      ];
  }
}

// ---------------------------------------------------------------------------
// Radio JOVE data (NASA citizen science — Jupiter/Sun radio emissions)
// Source: https://radiojove.gsfc.nasa.gov/
// ---------------------------------------------------------------------------

export interface RadioJoveEntry {
  id: string;
  source: string; // "Jupiter" | "Sun" | "Galaxy"
  frequency: string; // MHz
  type: string; // "S-burst" | "L-burst" | "Type III" etc.
  intensity: number; // dB, 0-100 scale
  timestamp: string;
  station: string; // observer station name
}

export const RADIO_JOVE_DATA: TrackerDataset<RadioJoveEntry> = {
  lastUpdated: "2026-02-27T11:30:00Z",
  source: "NASA Radio JOVE Archive",
  entries: [
    {
      id: "rj-1", source: "Jupiter", frequency: "20.1 MHz",
      type: "Io-B L-burst", intensity: 72, timestamp: "2026-02-27T08:14:00Z",
      station: "Windward CC, FL",
    },
    {
      id: "rj-2", source: "Sun", frequency: "20.1 MHz",
      type: "Type III Solar Burst", intensity: 85, timestamp: "2026-02-27T10:42:00Z",
      station: "Radio JOVE HQ",
    },
    {
      id: "rj-3", source: "Jupiter", frequency: "18.5 MHz",
      type: "Io-A S-burst", intensity: 58, timestamp: "2026-02-26T22:30:00Z",
      station: "AJ4CO Observatory",
    },
    {
      id: "rj-4", source: "Galaxy", frequency: "20.1 MHz",
      type: "Galactic Background", intensity: 34, timestamp: "2026-02-27T04:00:00Z",
      station: "UFRO Chile",
    },
    {
      id: "rj-5", source: "Sun", frequency: "22.0 MHz",
      type: "Type II Sweep", intensity: 91, timestamp: "2026-02-27T11:15:00Z",
      station: "Larry Dodd SDRplay",
    },
  ],
};

// ---------------------------------------------------------------------------
// Launch Dashboard data (WebSocket telemetry for rocket launches)
// Source: https://github.com/shahar603/Launch-Dashboard-API
// WebSocket: wss://api.launchdashboard.space (Socket.IO)
// ---------------------------------------------------------------------------

export interface LaunchTelemetryFrame {
  time: number; // seconds since launch (T+)
  velocity: number; // km/h
  altitude: number; // km
  downrange: number; // km
  acceleration: number; // G
  dynamicPressure: number; // kPa (Max-Q)
}

export interface LaunchEvent {
  id: string;
  mission: string;
  vehicle: string;
  provider: string;
  site: string;
  status: "upcoming" | "live" | "completed" | "scrubbed";
  launchTime: string; // ISO
  // Latest telemetry frame (mock for now)
  telemetry: LaunchTelemetryFrame | null;
  // Key events
  events: { time: number; label: string }[];
}

export const LAUNCH_DATA: TrackerDataset<LaunchEvent> = {
  lastUpdated: "2026-02-27T12:00:00Z",
  source: "Launch Dashboard API (mock)",
  entries: [
    {
      id: "launch-1",
      mission: "Starlink Group 12-5",
      vehicle: "Falcon 9 Block 5",
      provider: "SpaceX",
      site: "KSC LC-39A, Florida",
      status: "upcoming",
      launchTime: "2026-02-28T14:30:00Z",
      telemetry: null,
      events: [
        { time: 0, label: "Liftoff" },
        { time: 58, label: "Max-Q" },
        { time: 162, label: "MECO" },
        { time: 168, label: "Stage Sep" },
        { time: 390, label: "Entry Burn" },
        { time: 510, label: "Landing" },
        { time: 535, label: "SECO" },
        { time: 960, label: "Deployment" },
      ],
    },
    {
      id: "launch-2",
      mission: "NROL-186",
      vehicle: "Vulcan Centaur",
      provider: "ULA",
      site: "CCSFS SLC-41, Florida",
      status: "upcoming",
      launchTime: "2026-03-02T08:00:00Z",
      telemetry: null,
      events: [
        { time: 0, label: "Liftoff" },
        { time: 80, label: "Max-Q" },
        { time: 252, label: "Booster Sep" },
        { time: 750, label: "Payload Deploy" },
      ],
    },
    {
      id: "launch-3",
      mission: "CRS-32",
      vehicle: "Falcon 9 Block 5",
      provider: "SpaceX",
      site: "KSC LC-39A, Florida",
      status: "completed",
      launchTime: "2026-02-25T18:15:00Z",
      telemetry: {
        time: 535, velocity: 27400, altitude: 210, downrange: 1240,
        acceleration: 0.0, dynamicPressure: 0.0,
      },
      events: [
        { time: 0, label: "Liftoff" },
        { time: 62, label: "Max-Q" },
        { time: 158, label: "MECO" },
        { time: 535, label: "SECO" },
        { time: 960, label: "Dragon Deploy" },
      ],
    },
  ],
};
