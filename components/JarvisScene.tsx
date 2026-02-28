"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  DSN_GROUND_STATIONS,
  PROBES_DATASET,
  NEO_DATASET,
  ISS_INCLINATION,
} from "@/lib/space-tracker-data";

import type { ISSData } from "@/lib/space-pro-data";

// ---------------------------------------------------------------------------
// Scene layout constants (all in scene units)
// ---------------------------------------------------------------------------
const EARTH_RADIUS = 2;
const EARTH_POS = new THREE.Vector3(0, 0, 0);
const LD_SCALE = 1.5;
const YEAR_SCENE_SECONDS = 120;
function orbitalSpeed(periodDays: number) {
  return (2 * Math.PI) / ((periodDays / 365.25) * YEAR_SCENE_SECONDS);
}
function selfRotSpeed(rotationHours: number) {
  const earthRotScene = YEAR_SCENE_SECONDS / 365.25;
  return (2 * Math.PI) / ((rotationHours / 24) * earthRotScene);
}

const PLANET_DATA: {
  name: string; radius: number; dist: number; color: string;
  speed: number; ring?: boolean; tilt: number; selfRot: number;
  gasGiant?: boolean;
}[] = [
  { name: "Mercury", radius: 0.12, dist: 12, color: "#A0826D", speed: orbitalSpeed(88), tilt: 0.03, selfRot: selfRotSpeed(1407.6) },
  { name: "Venus", radius: 0.22, dist: 16, color: "#E8CDA0", speed: orbitalSpeed(225), tilt: 2.64, selfRot: selfRotSpeed(5832.5) },
  { name: "Mars", radius: 0.18, dist: 22, color: "#C1440E", speed: orbitalSpeed(687), tilt: 25.2, selfRot: selfRotSpeed(24.6) },
  { name: "Jupiter", radius: 0.7, dist: 32, color: "#C88B3A", speed: orbitalSpeed(4333), tilt: 3.13, selfRot: selfRotSpeed(9.93), gasGiant: true },
  { name: "Saturn", radius: 0.55, dist: 42, color: "#E8D5A3", speed: orbitalSpeed(10759), ring: true, tilt: 26.7, selfRot: selfRotSpeed(10.7), gasGiant: true },
  { name: "Uranus", radius: 0.35, dist: 52, color: "#73C2C6", speed: orbitalSpeed(30687), tilt: 97.8, selfRot: selfRotSpeed(17.2), gasGiant: true },
  { name: "Neptune", radius: 0.33, dist: 60, color: "#4B70DD", speed: orbitalSpeed(60190), tilt: 28.3, selfRot: selfRotSpeed(16.1), gasGiant: true },
];
const SUN_POS = new THREE.Vector3(-70, 0, 0);

// Moon orbital constants
const MOON_DIST = EARTH_RADIUS + 1.2; // scene units from Earth center
const MOON_RADIUS = 0.14;
const MOON_ORBITAL_PERIOD = 27.3; // days → scene time
const MOON_INCLINATION = 5.14; // degrees

// ---------------------------------------------------------------------------
// Planet info — real astronomical data (Croatian labels)
// ---------------------------------------------------------------------------
const PLANET_INFO: Record<string, Record<string, string>> = {
  mercury: {
    Tip: "Kameni planet", Masa: "3.3×10²³ kg", Radijus: "2,440 km",
    "Udaljenost od Sunca": "57.9 M km", "Orbitalni period": "88 dana",
    "Nagib osi": "0.03°", "Broj mjeseci": "0", Temperatura: "-180°C do 430°C",
  },
  venus: {
    Tip: "Kameni planet", Masa: "4.87×10²⁴ kg", Radijus: "6,052 km",
    "Udaljenost od Sunca": "108.2 M km", "Orbitalni period": "225 dana",
    "Nagib osi": "177.4°", "Broj mjeseci": "0", Temperatura: "462°C (prosječno)",
  },
  mars: {
    Tip: "Kameni planet", Masa: "6.42×10²³ kg", Radijus: "3,390 km",
    "Udaljenost od Sunca": "227.9 M km", "Orbitalni period": "687 dana",
    "Nagib osi": "25.2°", "Broj mjeseci": "2", Temperatura: "-87°C do -5°C",
  },
  jupiter: {
    Tip: "Plinski div", Masa: "1.90×10²⁷ kg", Radijus: "69,911 km",
    "Udaljenost od Sunca": "778.5 M km", "Orbitalni period": "11.86 god",
    "Nagib osi": "3.13°", "Broj mjeseci": "95", Temperatura: "-110°C (oblaci)",
  },
  saturn: {
    Tip: "Plinski div", Masa: "5.68×10²⁶ kg", Radijus: "58,232 km",
    "Udaljenost od Sunca": "1.43 B km", "Orbitalni period": "29.46 god",
    "Nagib osi": "26.7°", "Broj mjeseci": "146", Temperatura: "-140°C (oblaci)",
  },
  uranus: {
    Tip: "Ledeni div", Masa: "8.68×10²⁵ kg", Radijus: "25,362 km",
    "Udaljenost od Sunca": "2.87 B km", "Orbitalni period": "84.01 god",
    "Nagib osi": "97.8°", "Broj mjeseci": "28", Temperatura: "-195°C",
  },
  neptune: {
    Tip: "Ledeni div", Masa: "1.02×10²⁶ kg", Radijus: "24,622 km",
    "Udaljenost od Sunca": "4.50 B km", "Orbitalni period": "164.8 god",
    "Nagib osi": "28.3°", "Broj mjeseci": "16", Temperatura: "-200°C",
  },
};

const SUN_INFO: Record<string, string> = {
  Tip: "G2V (žuta patuljica)", Masa: "1.989×10³⁰ kg", Temperatura: "5,778 K (površina)",
  Radijus: "696,340 km", Luminozitet: "3.828×10²⁶ W", Starost: "4.6 B godina",
  "Sunčev vjetar": "400-800 km/s", "Korona temp.": "1-3 M K",
};

const MOON_INFO: Record<string, string> = {
  Tip: "Prirodni satelit", Masa: "7.34×10²² kg", Radijus: "1,737 km",
  "Udaljenost od Zemlje": "384,400 km", "Orbitalni period": "27.3 dana",
  "Nagib osi": "1.5°", Temperatura: "-173°C do 127°C",
  "Gravitacija": "1.62 m/s² (16.6% Zemlje)",
};

// ---------------------------------------------------------------------------
// Procedural planet texture fallback
// ---------------------------------------------------------------------------
function generatePlanetTexture(name: string, w = 512, h = 256): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const n = name.toLowerCase();

  if (n === "mercury") {
    ctx.fillStyle = "#8a8278";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 12, 0, Math.PI * 2);
      const s = 60 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgb(${s},${s - 5},${s - 10})`;
      ctx.fill();
    }
  } else if (n === "venus") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#e8d8a0"); g.addColorStop(0.5, "#e0c880"); g.addColorStop(1, "#e8d090");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      ctx.strokeStyle = `rgba(255,240,200,0.08)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x < w; x += 10) ctx.lineTo(x, y + Math.sin((x + Math.sin(y * 0.04) * 20) * 0.02) * 6);
      ctx.stroke();
    }
  } else if (n === "mars") {
    ctx.fillStyle = "#b04820"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, h * 0.15 + Math.random() * h * 0.7, 20 + Math.random() * 60, 10 + Math.random() * 30, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${80 + Math.random() * 40},${20 + Math.random() * 20},10,${0.2 + Math.random() * 0.15})`; ctx.fill();
    }
    const cg = ctx.createLinearGradient(0, 0, 0, 20); cg.addColorStop(0, "rgba(255,255,255,0.7)"); cg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = cg; ctx.fillRect(0, 0, w, 20);
    const cg2 = ctx.createLinearGradient(0, h - 20, 0, h); cg2.addColorStop(0, "rgba(255,255,255,0)"); cg2.addColorStop(1, "rgba(255,255,255,0.7)");
    ctx.fillStyle = cg2; ctx.fillRect(0, h - 20, w, 20);
  } else if (n === "jupiter") {
    const bc = ["#c88b3a","#a67228","#d4a050","#8a5e1e","#c88b3a","#b8802e","#d4a050","#a67228","#c88b3a","#9a6e28","#d0a048","#b88830"];
    const bh = h / bc.length;
    bc.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bh, w, bh + 1); });
    ctx.save(); ctx.translate(w * 0.6, h * 0.58); ctx.beginPath(); ctx.ellipse(0, 0, 28, 16, 0, 0, Math.PI * 2);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 28); gr.addColorStop(0, "rgba(200,80,40,0.7)"); gr.addColorStop(1, "rgba(160,60,30,0)");
    ctx.fillStyle = gr; ctx.fill(); ctx.restore();
  } else if (n === "saturn") {
    const sb = ["#e8d5a3","#d4c090","#e0c888","#c8b478","#e8d0a0","#d8c498","#e0cc90","#d0b880"];
    const bh2 = h / sb.length;
    sb.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bh2, w, bh2 + 1); });
  } else if (n === "uranus") {
    const ug = ctx.createLinearGradient(0, 0, 0, h);
    ug.addColorStop(0, "#73c2c6"); ug.addColorStop(0.5, "#80ccd0"); ug.addColorStop(1, "#75c4c8");
    ctx.fillStyle = ug; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) { ctx.strokeStyle = "rgba(100,200,210,0.08)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  } else if (n === "neptune") {
    const ng = ctx.createLinearGradient(0, 0, 0, h);
    ng.addColorStop(0, "#3058c8"); ng.addColorStop(0.5, "#3850c0"); ng.addColorStop(1, "#3550c0");
    ctx.fillStyle = ng; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { ctx.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.15})`; ctx.lineWidth = 1 + Math.random() * 2; ctx.beginPath(); ctx.moveTo(Math.random() * w, h * 0.2 + Math.random() * h * 0.6); ctx.lineTo(Math.random() * w, h * 0.2 + Math.random() * h * 0.6); ctx.stroke(); }
  } else if (n === "sun") {
    ctx.fillStyle = "#ff8800"; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      const v = Math.sin(x * 0.05 + y * 0.07) * Math.cos(x * 0.03 - y * 0.04);
      ctx.fillStyle = `rgb(${Math.floor(220 + v * 35)},${Math.floor(140 + v * 50)},${Math.floor(30 + v * 20)})`;
      ctx.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 15; i++) {
      const cx2 = Math.random() * w, cy2 = Math.random() * h, r2 = 10 + Math.random() * 30;
      const sg = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2); sg.addColorStop(0, "rgba(255,255,200,0.3)"); sg.addColorStop(1, "rgba(255,200,100,0)");
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, Math.PI * 2); ctx.fill();
    }
  }
  return canvas;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FocusTarget {
  type: "earth" | "iss" | "dsn" | "asteroid" | "probe" | "planet" | "sun" | "moon" | "reset";
  id?: string;
}

export interface JarvisSceneHandle {
  focusOn: (target: FocusTarget) => void;
}

interface JarvisSceneProps {
  width: number;
  height: number;
  issData: ISSData;
  onSelectObject?: (obj: { type: string; name: string; data: Record<string, string> } | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createLabel(text: string, color: string, scale: number = 2): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 36px monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8 });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale * 0.25, 1);
  return sprite;
}

function createDashedRing(radius: number, color: number, opacity: number): THREE.Line {
  const pts: THREE.Vector3[] = [];
  for (let a = 0; a <= 360; a += 2) {
    const r = (a * Math.PI) / 180;
    pts.push(new THREE.Vector3(Math.cos(r) * radius, 0, Math.sin(r) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.5, gapSize: 0.3 });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return line;
}

function latLonToSphere(lat: number, lon: number, radius: number, center: THREE.Vector3): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    center.x - radius * Math.sin(phi) * Math.cos(theta),
    center.y + radius * Math.cos(phi),
    center.z + radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Build the data object for an object ID — used by both click handler and focusOn */
function getObjectData(id: string, issData: ISSData): { type: string; name: string; data: Record<string, string> } | null {
  const data: Record<string, string> = {};
  let type = "object";
  let displayName = id.toUpperCase();

  if (id.startsWith("dsn-")) {
    type = "DSN";
    const station = DSN_GROUND_STATIONS.find((s) => s.id === id);
    if (station) {
      displayName = station.name;
      data["Lokacija"] = station.meta.country as string;
      data["Antene"] = String(station.meta.antennas);
      data["Primarni dish"] = station.meta.primaryDish as string;
      data["Aktivne misije"] = station.meta.activeMissions as string;
      data["Signal"] = `${station.meta.signalStrength}/5`;
      data["Koordinate"] = `${station.lat?.toFixed(2)}°, ${station.lon?.toFixed(2)}°`;
    }
  } else if (id === "iss") {
    type = "ISS";
    displayName = "ISS";
    data["Visina"] = `${issData.altitude} km`;
    data["Brzina"] = `${issData.speed.toLocaleString()} km/h`;
    data["Pozicija"] = `${issData.lat.toFixed(2)}°, ${issData.lon.toFixed(2)}°`;
    data["Inklinacija"] = `${ISS_INCLINATION}°`;
    data["Posada"] = `${issData.crew} članova`;
    data["Orbitalni period"] = "92.68 min";
  } else if (id === "moon") {
    type = "Mjesec";
    displayName = "Mjesec";
    Object.assign(data, MOON_INFO);
  } else if (id.startsWith("planet-")) {
    type = "Planet";
    const pName = id.replace("planet-", "");
    displayName = pName.charAt(0).toUpperCase() + pName.slice(1);
    const info = PLANET_INFO[pName];
    if (info) Object.assign(data, info);
  } else if (id === "sun") {
    type = "Zvijezda";
    displayName = "Sunce";
    Object.assign(data, SUN_INFO);
  } else {
    const neo = NEO_DATASET.entries.find((a) => a.id === id);
    if (neo) {
      type = "Asteroid";
      displayName = neo.name;
      data["Promjer"] = `${neo.diameterM}m`;
      data["Brzina"] = `${neo.speedKmH.toLocaleString()} km/h`;
      data["Udaljenost"] = `${neo.distanceLD} LD`;
      data["Udaljenost (km)"] = `${neo.distanceKm.toLocaleString()} km`;
      data["Opasan"] = neo.hazardous ? "DA ⚠" : "NE";
      data["Najbliži prolaz"] = new Date(neo.closestApproach).toLocaleString();
      data["Energija udara"] = `~${(neo.diameterM * neo.speedKmH * 0.001).toFixed(1)} kt TNT`;
      data["Kut prilaza"] = `${neo.approachAngle}°`;
      data["Izvor"] = "NASA CNEOS";
    }
    const probe = PROBES_DATASET.entries.find((p) => p.id === id);
    if (probe) {
      type = "Sonda";
      displayName = probe.name;
      data["Misija"] = probe.mission;
      data["Lansiranje"] = String(probe.launchYear);
      data["Status"] = probe.status === "active" ? "Aktivan" : probe.status === "idle" ? "Neaktivan" : "Izgubljen";
      data["Udaljenost"] = probe.distanceFromSun;
      data["Brzina"] = probe.speed;
      data["Zadnji signal"] = new Date(probe.lastSignal).toLocaleString();
      data["Izvor"] = "NASA/JPL Horizons";
    }
  }

  if (Object.keys(data).length === 0) return null;
  return { type, name: displayName, data };
}

/** Compute camera position: behind object, looking toward Earth */
function computeFlyTo(id: string, type: string, pos: THREE.Vector3) {
  let dist = 5;
  if (type === "Asteroid") dist = 4;
  else if (type === "Sonda") dist = 4;
  else if (type === "DSN") dist = 4;
  else if (type === "Zvijezda") dist = 12;
  else if (type === "Mjesec") dist = 3;
  else if (type === "Planet") {
    const pName = id.replace("planet-", "");
    const pData = PLANET_DATA.find((p) => p.name.toLowerCase() === pName);
    dist = pData ? pData.radius * 5 + 2 : 6;
  }

  let flyTarget: THREE.Vector3;
  let flyLook: THREE.Vector3;

  if (type === "ISS") {
    flyTarget = pos.clone().add(new THREE.Vector3(0, 2, 3));
    flyLook = pos.clone();
  } else {
    const dirToEarth = EARTH_POS.clone().sub(pos).normalize();
    flyTarget = pos.clone().sub(dirToEarth.clone().multiplyScalar(dist));
    flyTarget.y = Math.max(flyTarget.y, pos.y + dist * 0.25);
    flyLook = pos.clone().add(dirToEarth.clone().multiplyScalar(pos.distanceTo(EARTH_POS) * 0.3));
  }

  return { flyTarget, flyLook, dist };
}

// ---------------------------------------------------------------------------
// Probe model builder — more detailed per-probe type
// ---------------------------------------------------------------------------
function buildProbeModel(probeName: string): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc, emissive: 0x334455, emissiveIntensity: 0.4,
    roughness: 0.3, metalness: 0.7,
  });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1a4488, emissive: 0x0044aa, emissiveIntensity: 0.3,
    side: THREE.DoubleSide, roughness: 0.3, metalness: 0.5,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xdaa520, emissive: 0x886611, emissiveIntensity: 0.3,
    roughness: 0.4, metalness: 0.6,
  });

  const name = probeName.toLowerCase();

  if (name.includes("voyager")) {
    // Voyager: decagonal bus + boom + dish
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), bodyMat);
    group.add(bus);
    // High-gain antenna dish
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.8, side: THREE.DoubleSide }),
    );
    dish.rotation.x = Math.PI;
    dish.position.y = 0.08;
    group.add(dish);
    // Magnetometer boom
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.4, 4), bodyMat);
    boom.position.set(0.2, 0, 0);
    boom.rotation.z = Math.PI / 2;
    group.add(boom);
    // RTG power source
    const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), goldMat);
    rtg.position.set(-0.12, -0.02, 0);
    rtg.rotation.z = Math.PI / 4;
    group.add(rtg);
  } else if (name.includes("jwst")) {
    // JWST: hexagonal primary mirror + sunshield
    const mirror = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.1, metalness: 0.9, side: THREE.DoubleSide }),
    );
    mirror.rotation.x = -Math.PI / 6;
    group.add(mirror);
    // Sunshield (flat kite shape)
    const shield = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.15),
      new THREE.MeshStandardMaterial({ color: 0xccccdd, roughness: 0.8, metalness: 0.1, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    );
    shield.position.y = -0.08;
    shield.rotation.x = Math.PI / 3;
    group.add(shield);
  } else if (name.includes("parker")) {
    // Parker Solar Probe: heat shield + body
    const heatShield = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 16),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide }),
    );
    group.add(heatShield);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), bodyMat);
    body.position.z = -0.06;
    body.rotation.x = Math.PI / 2;
    group.add(body);
    // Small solar panels
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), panelMat);
    sp.position.set(0.07, 0, -0.06);
    group.add(sp);
    const sp2 = sp.clone();
    sp2.position.set(-0.07, 0, -0.06);
    group.add(sp2);
  } else if (name.includes("juno")) {
    // Juno: 3 large solar panels + body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), bodyMat);
    group.add(body);
    for (let i = 0; i < 3; i++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.06), panelMat);
      const angle = (i * 120 * Math.PI) / 180;
      panel.position.set(Math.cos(angle) * 0.2, 0, Math.sin(angle) * 0.2);
      panel.rotation.y = angle;
      group.add(panel);
    }
  } else {
    // Generic: box + solar panels + dish
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.1), bodyMat);
    group.add(body);
    const panelL = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), panelMat);
    panelL.position.set(-0.16, 0, 0);
    panelL.rotation.y = Math.PI / 2;
    group.add(panelL);
    const panelR = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), panelMat);
    panelR.position.set(0.16, 0, 0);
    panelR.rotation.y = Math.PI / 2;
    group.add(panelR);
    // Small dish
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.35),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.2, metalness: 0.7, side: THREE.DoubleSide }),
    );
    dish.rotation.x = Math.PI;
    dish.position.y = 0.05;
    group.add(dish);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const JarvisScene = forwardRef<JarvisSceneHandle, JarvisSceneProps>(
  function JarvisScene({ width, height, issData, onSelectObject }, ref) {

    const containerRef = useRef<HTMLDivElement>(null);
    const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
    const issDataRef = useRef(issData);
    issDataRef.current = issData;

    const internals = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      animId: number;
      clock: THREE.Clock;
      paused: boolean;
      flyTarget: THREE.Vector3 | null;
      flyLook: THREE.Vector3 | null;
      flyDist: number;
      objectMap: Map<string, THREE.Object3D>;
      selectedId: string | null;
      prevSelectedId: string | null;
      issMesh: THREE.Mesh;
      moonMesh: THREE.Mesh;
      asteroidAnims: { mesh: THREE.Mesh; speed: number; angle: number; dist: number; approachAngle: number; trail: THREE.Points; initScale: THREE.Vector3; ghostMesh: THREE.Mesh; ghostLabels: THREE.Sprite[]; trajPts: THREE.Vector3[]; simActive: boolean }[];
      planetAnims: { mesh: THREE.Mesh; angle: number; speed: number; dist: number; tilt: number; selfRotSpeed: number }[];
      scanBand: THREE.Mesh;
      sunCorona: THREE.Mesh;
      sunCoronaOuter: THREE.Mesh;
      sunMesh: THREE.Mesh;
      earthCore: THREE.Mesh;
    } | null>(null);

    // Expose focusOn via ref — now also emits onSelectObject
    useImperativeHandle(ref, () => ({
      focusOn: (target: FocusTarget) => {
        if (!internals.current) return;
        const { objectMap } = internals.current;

        if (target.type === "reset" || target.type === "earth") {
          internals.current.flyLook = EARTH_POS.clone();
          internals.current.flyTarget = new THREE.Vector3(0, 3, 8);
          internals.current.flyDist = 8;
          internals.current.selectedId = null;
          onSelectObject?.(null);
          return;
        }

        const key = target.id || target.type;
        const obj = objectMap.get(key);
        if (obj) {
          const pos = new THREE.Vector3();
          obj.getWorldPosition(pos);

          // Emit object data so HUD shows immediately
          const objData = getObjectData(key, issDataRef.current);
          if (objData) onSelectObject?.(objData);

          const { flyTarget, flyLook, dist } = computeFlyTo(key, objData?.type || "object", pos);
          internals.current.flyTarget = flyTarget;
          internals.current.flyLook = flyLook;
          internals.current.flyDist = dist;
          internals.current.selectedId = key;
        }
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const isMobile = window.innerWidth < 768;
      const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2);

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 500);
      camera.position.set(0, 3, 8);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.12;
      controls.minDistance = 1;
      controls.maxDistance = 150;
      controls.zoomSpeed = 2.5;
      controls.rotateSpeed = 1.5;
      controls.target.copy(EARTH_POS);

      // Lighting
      scene.add(new THREE.AmbientLight(0x889aab, 2.5));
      scene.add(new THREE.HemisphereLight(0xffffff, 0x222244, 0.8));
      const sunLight = new THREE.PointLight(0xffffff, 2, 300);
      sunLight.position.copy(SUN_POS);
      scene.add(sunLight);
      const fillLight = new THREE.PointLight(0x0066ff, 0.5, 100);
      fillLight.position.set(30, 10, 20);
      scene.add(fillLight);

      // Starfield
      const starPos = new Float32Array(3000 * 3);
      for (let i = 0; i < 3000; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 150 + Math.random() * 80;
        starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPos[i * 3 + 2] = r * Math.cos(phi);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, sizeAttenuation: true })));

      const objectMap = new Map<string, THREE.Object3D>();

      // ===== TEXTURE LOADER =====
      const texLoader = new THREE.TextureLoader();

      // ===== EARTH =====
      const earthDayTex = texLoader.load("/textures/earth_day.jpg");
      const earthBumpTex = texLoader.load("/textures/earth_bump.jpg");
      const earthCore = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS, 64, 64),
        new THREE.MeshStandardMaterial({
          map: earthDayTex, bumpMap: earthBumpTex, bumpScale: 0.03,
          roughness: 0.45, metalness: 0.1,
          emissive: new THREE.Color(0x112244), emissiveIntensity: 0.15,
        }),
      );
      earthCore.position.copy(EARTH_POS);
      scene.add(earthCore);
      objectMap.set("earth", earthCore);

      // Atmosphere
      const atmosMesh = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS * 1.08, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.06 }),
      );
      atmosMesh.position.copy(EARTH_POS);
      scene.add(atmosMesh);

      // Scan band
      const scanCanvas = document.createElement("canvas");
      scanCanvas.width = 512; scanCanvas.height = 256;
      const scanCtx = scanCanvas.getContext("2d")!;
      const scanTex = new THREE.CanvasTexture(scanCanvas);
      const scanBand = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS * 1.03, 48, 48),
        new THREE.MeshBasicMaterial({ map: scanTex, transparent: true, opacity: 0.12, depthWrite: false }),
      );
      scanBand.position.copy(EARTH_POS);
      scene.add(scanBand);

      // Earth label
      const earthLabel = createLabel("EARTH", "#00D4FF", 2);
      earthLabel.position.set(EARTH_POS.x, EARTH_POS.y + EARTH_RADIUS + 0.8, EARTH_POS.z);
      scene.add(earthLabel);

      // LD rings
      [1, 5, 10, 20].forEach((ld) => {
        const ring = createDashedRing(ld * LD_SCALE, 0x00d4ff, 0.06);
        ring.position.copy(EARTH_POS); scene.add(ring);
        const lbl = createLabel(`${ld} LD`, "#00D4FF", 1.2);
        lbl.material.opacity = 0.3;
        lbl.position.set(EARTH_POS.x + ld * LD_SCALE + 0.5, EARTH_POS.y + 0.3, EARTH_POS.z);
        scene.add(lbl);
      });

      // ===== DSN STATIONS =====
      DSN_GROUND_STATIONS.forEach((station) => {
        if (!station.lat || !station.lon) return;
        const pos = latLonToSphere(station.lat, station.lon, EARTH_RADIUS * 1.02, new THREE.Vector3(0, 0, 0));
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0x34d399 }));
        dot.position.copy(pos); earthCore.add(dot);
        objectMap.set(station.id, dot);
        const lbl = createLabel(station.name, "#34D399", 1);
        lbl.position.copy(pos).add(new THREE.Vector3(0, 0.3, 0));
        earthCore.add(lbl);
      });

      // ===== ISS — placed at actual lat/lon =====
      const issMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08, 0),
        new THREE.MeshBasicMaterial({ color: 0x00d4ff }),
      );
      // Position from actual telemetry data
      const issPos3d = latLonToSphere(issData.lat, issData.lon, EARTH_RADIUS + 0.5, EARTH_POS);
      issMesh.position.copy(issPos3d);
      scene.add(issMesh);
      objectMap.set("iss", issMesh);

      // ISS orbit ring
      const issOrbitGroup = new THREE.Group();
      issOrbitGroup.add(createDashedRing(EARTH_RADIUS + 0.5, 0x00d4ff, 0.15));
      issOrbitGroup.rotation.x = (ISS_INCLINATION * Math.PI) / 180;
      issOrbitGroup.position.copy(EARTH_POS);
      scene.add(issOrbitGroup);

      const issLabel = createLabel("ISS", "#00D4FF", 1.2);
      issLabel.position.y = 0.3;
      issMesh.add(issLabel);

      // ===== MOON =====
      const moonTex = texLoader.load("/textures/moon.jpg");
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(MOON_RADIUS, 32, 32),
        new THREE.MeshStandardMaterial({
          map: moonTex, roughness: 0.9, metalness: 0.05,
          emissive: new THREE.Color(0x222222), emissiveIntensity: 0.1,
        }),
      );
      // Initial position
      moonMesh.position.set(EARTH_POS.x + MOON_DIST, EARTH_POS.y, EARTH_POS.z);
      scene.add(moonMesh);
      objectMap.set("moon", moonMesh);

      // Moon orbit ring
      const moonOrbitRing = createDashedRing(MOON_DIST, 0x888888, 0.08);
      moonOrbitRing.position.copy(EARTH_POS);
      moonOrbitRing.rotation.x = (MOON_INCLINATION * Math.PI) / 180;
      scene.add(moonOrbitRing);

      const moonLabel = createLabel("MOON", "#AAAAAA", 1);
      moonLabel.position.y = MOON_RADIUS + 0.3;
      moonMesh.add(moonLabel);

      // ===== ASTEROIDS =====
      const asteroidAnims: NonNullable<typeof internals.current>["asteroidAnims"] = [];
      NEO_DATASET.entries.forEach((asteroid) => {
        const scaledDist = asteroid.distanceLD * LD_SCALE;
        const angle = (asteroid.approachAngle * Math.PI) / 180;
        const size = Math.max(0.08, Math.min(asteroid.diameterM / 300, 0.35));

        const aGeo = new THREE.IcosahedronGeometry(size, 2);
        const posAttr = aGeo.getAttribute("position");
        for (let vi = 0; vi < posAttr.count; vi++) {
          const nx = posAttr.getX(vi), ny = posAttr.getY(vi), nz = posAttr.getZ(vi);
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const large = (Math.sin(nx * 7.3 + ny * 5.1) * Math.cos(nz * 6.8 + nx * 3.2)) * 0.35;
          const small = (Math.sin(nx * 19 + nz * 13) * Math.cos(ny * 17 + nx * 11)) * 0.15;
          const displace = 1 + large + small + (Math.random() * 0.12 - 0.06);
          posAttr.setXYZ(vi, (nx / len) * size * displace, (ny / len) * size * displace, (nz / len) * size * displace);
        }
        posAttr.needsUpdate = true;
        aGeo.computeVertexNormals();
        aGeo.computeBoundingSphere();

        const rockyColors = [0x6b6560, 0x7a6e5e, 0x5c5550, 0x8a7d6b, 0x4e4845];
        const baseColor = asteroid.hazardous ? 0xb03030 : rockyColors[Math.floor(Math.random() * rockyColors.length)];
        const aMesh = new THREE.Mesh(aGeo, new THREE.MeshStandardMaterial({
          color: baseColor, roughness: 0.95, metalness: 0.05,
          emissive: asteroid.hazardous ? 0x661111 : 0x221100, emissiveIntensity: 0.3, flatShading: true,
        }));
        aMesh.scale.set(0.6 + Math.random() * 0.8, 0.5 + Math.random() * 0.5, 0.6 + Math.random() * 0.8);
        aMesh.position.set(
          EARTH_POS.x + Math.cos(angle) * scaledDist,
          EARTH_POS.y + Math.sin(angle * 0.3) * 0.5,
          EARTH_POS.z + Math.sin(angle) * scaledDist,
        );
        scene.add(aMesh);
        objectMap.set(asteroid.id, aMesh);

        // Wireframe overlay
        aMesh.add(new THREE.Mesh(
          new THREE.IcosahedronGeometry(size * 1.05, 1),
          new THREE.MeshBasicMaterial({ color: asteroid.hazardous ? 0xef4444 : 0x99887766, wireframe: true, transparent: true, opacity: 0.15 }),
        ));

        // Trail
        const trailPositions = new Float32Array(9);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
        trailGeo.setAttribute("size", new THREE.BufferAttribute(new Float32Array([3, 2, 1]), 1));
        const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({
          color: asteroid.hazardous ? 0xef4444 : 0xffcf6e, size: 0.04, transparent: true, opacity: 0.4, sizeAttenuation: true,
        }));
        scene.add(trail);

        // Flyby trajectory — SOLID line, brighter, thicker feel
        const trajPts: THREE.Vector3[] = [];
        const periapsis = scaledDist;
        const deflection = 0.4 + Math.random() * 0.5;
        const incomingAngle = angle + Math.PI;
        for (let i = 0; i <= 80; i++) {
          const t = (i / 80 - 0.5) * 2;
          const curveAngle = incomingAngle + t * (0.8 + deflection);
          const d = periapsis + Math.abs(t) * periapsis * 1.2;
          trajPts.push(new THREE.Vector3(
            EARTH_POS.x + Math.cos(curveAngle) * d,
            EARTH_POS.y + Math.sin(t * Math.PI * 0.15) * 0.4,
            EARTH_POS.z + Math.sin(curveAngle) * d,
          ));
        }
        const trajGeo = new THREE.BufferGeometry().setFromPoints(trajPts);
        const trajLine = new THREE.Line(trajGeo,
          new THREE.LineBasicMaterial({ color: asteroid.hazardous ? 0xef4444 : 0xffcf6e, transparent: true, opacity: 0.5 }),
        );
        scene.add(trajLine);

        // Ghost mesh for flyby simulation (hidden by default)
        const ghostGeo = new THREE.IcosahedronGeometry(size * 0.8, 1);
        const ghostMesh = new THREE.Mesh(ghostGeo, new THREE.MeshBasicMaterial({
          color: asteroid.hazardous ? 0xef4444 : 0xffcf6e, transparent: true, opacity: 0.3, wireframe: true,
        }));
        ghostMesh.visible = false;
        scene.add(ghostMesh);

        // Ghost timestamp labels along trajectory
        const ghostLabels: THREE.Sprite[] = [];
        const approachDate = new Date(asteroid.closestApproach);
        const labelIndices = [10, 25, 40, 55, 70]; // positions along trajectory
        for (const idx of labelIndices) {
          const hoursOffset = ((idx - 40) / 40) * 48; // ±48h range
          const labelDate = new Date(approachDate.getTime() + hoursOffset * 3600000);
          const timeStr = `${labelDate.getDate()}.${labelDate.getMonth() + 1}. ${labelDate.getHours().toString().padStart(2, "0")}:${labelDate.getMinutes().toString().padStart(2, "0")}`;
          const lbl = createLabel(timeStr, asteroid.hazardous ? "#EF4444" : "#FFCF6E", 0.8);
          lbl.position.copy(trajPts[idx]).add(new THREE.Vector3(0, 0.5, 0));
          lbl.visible = false;
          scene.add(lbl);
          ghostLabels.push(lbl);
        }

        // Name label only (no duplicate HUD)
        const lbl = createLabel(asteroid.name, asteroid.hazardous ? "#EF4444" : "#FFCF6E", 1.2);
        lbl.position.y = size + 0.4;
        aMesh.add(lbl);

        asteroidAnims.push({
          mesh: aMesh, speed: asteroid.speedKmH * 0.000001,
          angle, dist: scaledDist, approachAngle: asteroid.approachAngle,
          trail, initScale: aMesh.scale.clone(),
          ghostMesh, ghostLabels, trajPts, simActive: false,
        });
      });

      // ===== SUN =====
      const sunGeo = new THREE.SphereGeometry(3, 32, 32);
      // Try real texture, fallback to procedural
      const sunFallback = generatePlanetTexture("sun");
      const sunFallbackTex = new THREE.CanvasTexture(sunFallback);
      const sunMat = new THREE.MeshStandardMaterial({
        map: sunFallbackTex, emissive: 0xffaa00, emissiveIntensity: 1.5, roughness: 1, metalness: 0,
      });
      texLoader.load("/textures/sun.jpg", (tex) => { sunMat.map = tex; sunMat.needsUpdate = true; });
      const sunMesh = new THREE.Mesh(sunGeo, sunMat);
      sunMesh.position.copy(SUN_POS);
      scene.add(sunMesh);
      objectMap.set("sun", sunMesh);

      const sunCorona = new THREE.Mesh(
        new THREE.SphereGeometry(4, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.1 }),
      );
      sunCorona.position.copy(SUN_POS);
      scene.add(sunCorona);
      const sunCoronaOuter = new THREE.Mesh(
        new THREE.SphereGeometry(6, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.04 }),
      );
      sunCoronaOuter.position.copy(SUN_POS);
      scene.add(sunCoronaOuter);
      const sunLabel = createLabel("SUN", "#FFDD44", 3);
      sunLabel.position.set(SUN_POS.x, SUN_POS.y + 5, SUN_POS.z);
      scene.add(sunLabel);

      // ===== PLANETS — real photo textures with procedural fallback =====
      const planetAnims: NonNullable<typeof internals.current>["planetAnims"] = [];
      const planetTexFiles: Record<string, string> = {
        mercury: "/textures/mercury.jpg", venus: "/textures/venus.jpg",
        mars: "/textures/mars.jpg", jupiter: "/textures/jupiter.jpg",
        saturn: "/textures/saturn.jpg", neptune: "/textures/neptune.jpg",
      };

      PLANET_DATA.forEach((p) => {
        const orbitRing = createDashedRing(p.dist, 0x00d4ff, 0.06);
        orbitRing.position.copy(SUN_POS);
        scene.add(orbitRing);

        const pGeo = new THREE.SphereGeometry(p.radius, 32, 32);

        // Start with procedural fallback
        const fallbackCanvas = generatePlanetTexture(p.name);
        const fallbackTex = new THREE.CanvasTexture(fallbackCanvas);
        const pMat = new THREE.MeshStandardMaterial({
          map: fallbackTex,
          roughness: p.gasGiant ? 0.5 : 0.65,
          metalness: p.gasGiant ? 0.1 : 0.15,
          emissive: new THREE.Color(p.color),
          emissiveIntensity: p.gasGiant ? 0.2 : 0.12,
        });

        // Try loading real texture
        const texFile = planetTexFiles[p.name.toLowerCase()];
        if (texFile) {
          texLoader.load(texFile, (tex) => {
            pMat.map = tex;
            pMat.needsUpdate = true;
          });
        }

        const pMesh = new THREE.Mesh(pGeo, pMat);
        const startAngle = Math.random() * Math.PI * 2;
        pMesh.position.set(SUN_POS.x + Math.cos(startAngle) * p.dist, 0, SUN_POS.z + Math.sin(startAngle) * p.dist);
        pMesh.rotation.z = (p.tilt * Math.PI) / 180;
        scene.add(pMesh);
        objectMap.set(`planet-${p.name.toLowerCase()}`, pMesh);

        // Saturn rings
        if (p.ring) {
          const ringInner = new THREE.Mesh(
            new THREE.RingGeometry(p.radius * 1.3, p.radius * 1.7, 64),
            new THREE.MeshBasicMaterial({ color: 0xe8d5a3, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
          );
          ringInner.rotation.x = Math.PI / 2;
          pMesh.add(ringInner);
          const ringGap = new THREE.Mesh(
            new THREE.RingGeometry(p.radius * 1.7, p.radius * 1.75, 64),
            new THREE.MeshBasicMaterial({ color: 0x050710, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
          );
          ringGap.rotation.x = Math.PI / 2;
          pMesh.add(ringGap);
          const ringOuter = new THREE.Mesh(
            new THREE.RingGeometry(p.radius * 1.75, p.radius * 2.3, 64),
            new THREE.MeshBasicMaterial({ color: 0xd4c090, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
          );
          ringOuter.rotation.x = Math.PI / 2;
          pMesh.add(ringOuter);
        }

        // Single name label only
        const lbl = createLabel(p.name.toUpperCase(), p.color, 1.5);
        lbl.position.y = p.radius + 0.5;
        pMesh.add(lbl);

        planetAnims.push({ mesh: pMesh, angle: startAngle, speed: p.speed, dist: p.dist, tilt: p.tilt, selfRotSpeed: p.selfRot });
      });

      // ===== PROBES — detailed per-type models =====
      PROBES_DATASET.entries.forEach((probe) => {
        const scaledDist = probe.distanceAU > 10
          ? 60 + Math.log10(probe.distanceAU / 10) * 30
          : SUN_POS.length() + (probe.distanceAU / 5.5) * 70;
        const angle = (probe.positionAngle * Math.PI) / 180;
        const px = SUN_POS.x + Math.cos(angle) * scaledDist;
        const pz = SUN_POS.z + Math.sin(angle) * scaledDist;

        const probeGroup = buildProbeModel(probe.name);
        probeGroup.position.set(px, 0.2, pz);
        scene.add(probeGroup);
        objectMap.set(probe.id, probeGroup);

        // Trajectory
        const trajPts: THREE.Vector3[] = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const d = t * scaledDist;
          const curveAngle = angle + Math.sin(t * Math.PI) * 0.1;
          trajPts.push(new THREE.Vector3(SUN_POS.x + Math.cos(curveAngle) * d, Math.sin(t * Math.PI) * 0.2, SUN_POS.z + Math.sin(curveAngle) * d));
        }
        const trajLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(trajPts),
          new THREE.LineDashedMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.12, dashSize: 0.5, gapSize: 0.3 }),
        );
        trajLine.computeLineDistances();
        scene.add(trajLine);

        // Single name label only (no duplicate distance HUD)
        const lbl = createLabel(probe.name, "#00D4FF", 1.5);
        lbl.position.y = 0.6;
        probeGroup.add(lbl);
      });

      // ===== GRID =====
      const gridHelper = new THREE.GridHelper(200, 100, 0x00d4ff, 0x00d4ff);
      (gridHelper.material as THREE.Material).transparent = true;
      (gridHelper.material as THREE.Material).opacity = 0.03;
      gridHelper.position.y = -0.5;
      scene.add(gridHelper);

      // ===== ANIMATION =====
      const clock = new THREE.Clock();
      let animId = 0;
      let idleTime = 0;

      const state = {
        renderer, scene, camera, controls, animId, clock, paused: false,
        flyTarget: null as THREE.Vector3 | null,
        flyLook: null as THREE.Vector3 | null,
        flyDist: 8,
        objectMap, selectedId: null as string | null,
        prevSelectedId: null as string | null,
        issMesh, moonMesh, asteroidAnims, planetAnims,
        scanBand, sunCorona, sunCoronaOuter, sunMesh, earthCore,
      };
      internals.current = state;

      const raycaster = new THREE.Raycaster();
      const mouseVec = new THREE.Vector2();

      function onPointerDown(e: PointerEvent) {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
      }

      function onPointerUp(e: PointerEvent) {
        if (pointerDownPos.current) {
          const dx = e.clientX - pointerDownPos.current.x;
          const dy = e.clientY - pointerDownPos.current.y;
          if (Math.sqrt(dx * dx + dy * dy) > 5) { pointerDownPos.current = null; return; }
        }
        pointerDownPos.current = null;

        const rect = renderer.domElement.getBoundingClientRect();
        mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseVec, camera);

        const clickables = Array.from(objectMap.values()).filter((o) => o instanceof THREE.Mesh || o instanceof THREE.Group);
        const intersects = raycaster.intersectObjects(clickables, true);
        if (intersects.length > 0) {
          let hitObj = intersects[0].object;
          let foundId: string | null = null;
          while (hitObj) {
            for (const [id, obj] of objectMap.entries()) {
              if (obj === hitObj) { foundId = id; break; }
            }
            if (foundId) break;
            hitObj = hitObj.parent as THREE.Object3D;
          }

          if (foundId) {
            const id = foundId;
            const objData = getObjectData(id, issDataRef.current);
            if (objData) {
              onSelectObject?.(objData);

              const pos = new THREE.Vector3();
              objectMap.get(id)!.getWorldPosition(pos);
              const { flyTarget, flyLook, dist } = computeFlyTo(id, objData.type, pos);
              state.flyTarget = flyTarget;
              state.flyLook = flyLook;
              state.flyDist = dist;
              state.selectedId = id;
            }
          }
          idleTime = 0;
        }
      }
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);

      let interacting = false;
      function onInteractStart() { interacting = true; idleTime = 0; }
      function onInteractEnd() { interacting = false; }
      renderer.domElement.addEventListener("pointerdown", onInteractStart);
      renderer.domElement.addEventListener("pointerup", onInteractEnd);
      renderer.domElement.addEventListener("wheel", () => { idleTime = 0; });

      const trailHistory: THREE.Vector3[][] = asteroidAnims.map(() => []);

      function animate() {
        animId = requestAnimationFrame(animate);
        if (state.paused) return;

        const delta = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.getElapsedTime();

        // ISS — slow orbit using real inclination, ~92 min period scaled to scene time
        // Much slower: full orbit in ~60s scene time
        const issAngle = elapsed * 0.1; // very slow, visible orbit
        const issOrbitR = EARTH_RADIUS + 0.5;
        const issX = Math.cos(issAngle) * issOrbitR;
        const issZ = Math.sin(issAngle) * issOrbitR;
        const incRad = (ISS_INCLINATION * Math.PI) / 180;
        issMesh.position.set(
          EARTH_POS.x + issX,
          EARTH_POS.y + issZ * Math.sin(incRad),
          EARTH_POS.z + issZ * Math.cos(incRad),
        );
        issMesh.rotation.y += delta * 0.5;

        // Moon orbit — slow, tilted
        const moonAngle = elapsed * (2 * Math.PI) / (MOON_ORBITAL_PERIOD / 365.25 * YEAR_SCENE_SECONDS);
        const moonIncRad = (MOON_INCLINATION * Math.PI) / 180;
        const moonX = Math.cos(moonAngle) * MOON_DIST;
        const moonZ = Math.sin(moonAngle) * MOON_DIST;
        moonMesh.position.set(
          EARTH_POS.x + moonX,
          EARTH_POS.y + moonZ * Math.sin(moonIncRad),
          EARTH_POS.z + moonZ * Math.cos(moonIncRad),
        );
        moonMesh.rotation.y += delta * 0.02;

        // Earth rotation
        earthCore.rotation.y += delta * 0.05;
        scanBand.rotation.y += delta * 0.05;

        // Scan band texture
        scanCtx.clearRect(0, 0, 512, 256);
        const bandY = ((elapsed * 30) % 256);
        const gradient = scanCtx.createLinearGradient(0, bandY - 20, 0, bandY + 20);
        gradient.addColorStop(0, "rgba(0, 212, 255, 0)");
        gradient.addColorStop(0.5, "rgba(0, 212, 255, 0.6)");
        gradient.addColorStop(1, "rgba(0, 212, 255, 0)");
        scanCtx.fillStyle = gradient;
        scanCtx.fillRect(0, bandY - 20, 512, 40);
        scanTex.needsUpdate = true;

        // Asteroids
        for (let ai = 0; ai < asteroidAnims.length; ai++) {
          const aa = asteroidAnims[ai];
          aa.angle += aa.speed * delta;
          const d = aa.dist + Math.sin(elapsed * 0.1 + aa.approachAngle) * 0.3;
          const approachRad = (aa.approachAngle * Math.PI) / 180;
          const newX = EARTH_POS.x + Math.cos(approachRad + aa.angle * 0.01) * d;
          const newY = EARTH_POS.y + Math.sin(elapsed * 0.3 + aa.approachAngle) * 0.2;
          const newZ = EARTH_POS.z + Math.sin(approachRad + aa.angle * 0.01) * d;

          const hist = trailHistory[ai];
          hist.unshift(new THREE.Vector3(newX, newY, newZ));
          if (hist.length > 4) hist.length = 4;

          const trailPos = aa.trail.geometry.attributes.position.array as Float32Array;
          for (let t = 0; t < 3; t++) {
            const src = hist[Math.min(t + 1, hist.length - 1)];
            trailPos[t * 3] = src.x; trailPos[t * 3 + 1] = src.y; trailPos[t * 3 + 2] = src.z;
          }
          aa.trail.geometry.attributes.position.needsUpdate = true;
          aa.mesh.position.set(newX, newY, newZ);
          aa.mesh.rotation.x += delta * 0.5;
          aa.mesh.rotation.z += delta * 0.3;

          // Ghost simulation
          if (aa.simActive) {
            const ghostT = ((elapsed * 0.5) % 1); // loop 0→1
            const ghostIdx = Math.floor(ghostT * (aa.trajPts.length - 1));
            const pt = aa.trajPts[Math.min(ghostIdx, aa.trajPts.length - 1)];
            aa.ghostMesh.position.copy(pt);
            aa.ghostMesh.visible = true;
            aa.ghostMesh.rotation.y += delta * 2;
            for (const gl of aa.ghostLabels) gl.visible = true;
          } else {
            aa.ghostMesh.visible = false;
            for (const gl of aa.ghostLabels) gl.visible = false;
          }
        }

        // Planets
        const orbitActive = !interacting || idleTime > 10;
        for (const pa of planetAnims) {
          if (orbitActive) {
            pa.angle += pa.speed * delta;
            pa.mesh.position.set(SUN_POS.x + Math.cos(pa.angle) * pa.dist, 0, SUN_POS.z + Math.sin(pa.angle) * pa.dist);
          }
          pa.mesh.rotation.y += Math.min(pa.selfRotSpeed * delta, delta * 2);
        }

        // Sun
        const coronaOpacity = 0.08 + Math.sin(elapsed * 1.5) * 0.03;
        (sunCorona.material as THREE.MeshBasicMaterial).opacity = coronaOpacity;
        sunCorona.scale.setScalar(1 + Math.sin(elapsed * 0.8) * 0.05);
        sunCoronaOuter.scale.setScalar(1 + Math.sin(elapsed * 0.5) * 0.08);
        (sunCoronaOuter.material as THREE.MeshBasicMaterial).opacity = 0.03 + Math.sin(elapsed * 1.2) * 0.015;
        sunMesh.rotation.y += delta * 0.02;

        // Pulse selected (only asteroids/probes)
        if (state.selectedId) {
          if (state.prevSelectedId && state.prevSelectedId !== state.selectedId) {
            const prev = objectMap.get(state.prevSelectedId);
            if (prev) {
              const prevAnim = asteroidAnims.find(a => a.mesh === prev);
              if (prevAnim) prev.scale.copy(prevAnim.initScale);
              else prev.scale.set(1, 1, 1);
            }
            state.prevSelectedId = state.selectedId;
          }
          if (!state.prevSelectedId) state.prevSelectedId = state.selectedId;

          const skipPulse = state.selectedId === "earth" || state.selectedId === "sun" || state.selectedId === "iss"
            || state.selectedId === "moon"
            || state.selectedId.startsWith("planet-") || state.selectedId.startsWith("dsn-");
          if (!skipPulse) {
            const sel = objectMap.get(state.selectedId);
            if (sel) {
              const s = 1 + Math.sin(elapsed * 5) * 0.1;
              const anim = asteroidAnims.find(a => a.mesh === sel);
              if (anim) sel.scale.copy(anim.initScale).multiplyScalar(s);
              else sel.scale.setScalar(s);
            }
          }
        }

        // Camera fly-to
        if (state.flyLook) {
          controls.target.lerp(state.flyLook, 0.06);
          if (controls.target.distanceTo(state.flyLook) < 0.05) state.flyLook = null;
        }
        if (state.flyTarget) {
          camera.position.lerp(state.flyTarget, 0.04);
          if (camera.position.distanceTo(state.flyTarget) < 0.05) state.flyTarget = null;
        }

        // Auto-rotate: 10s idle delay, very slow speed
        if (!interacting && !state.flyTarget) {
          idleTime += delta;
          if (idleTime > 10) {
            const autoSpeed = Math.min((idleTime - 10) * 0.0005, 0.0015);
            const camDir = camera.position.clone().sub(controls.target);
            const camDist = camDir.length();
            camDir.normalize();
            camDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), autoSpeed * 0.15);
            camera.position.copy(controls.target).add(camDir.multiplyScalar(camDist));
          }
        }

        controls.update();
        renderer.render(scene, camera);
      }

      state.animId = requestAnimationFrame(animate);

      function handleVisibility() {
        state.paused = document.hidden;
        if (!state.paused) clock.getDelta();
      }
      document.addEventListener("visibilitychange", handleVisibility);

      return () => {
        cancelAnimationFrame(state.animId);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        renderer.domElement.removeEventListener("pointerdown", onInteractStart);
        renderer.domElement.removeEventListener("pointerup", onInteractEnd);
        document.removeEventListener("visibilitychange", handleVisibility);
        renderer.dispose();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        internals.current = null;
      };
    }, [width, height, onSelectObject, issData]);

    return <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
  },
);

export default JarvisScene;
