"use client";

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
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
// Near-Earth zone: asteroids at 1 LD = 3 units from Earth
const LD_SCALE = 1.5;
// Planet distances (scaled, not realistic)
// Real orbital period ratios (Earth=365.25d baseline → 120s scene time)
// speed = (2π) / (orbitalDays / 365.25 * 120) rad/s
const YEAR_SCENE_SECONDS = 120;
function orbitalSpeed(periodDays: number) {
  return (2 * Math.PI) / ((periodDays / 365.25) * YEAR_SCENE_SECONDS);
}
// Self-rotation: Earth 24h = 0.33s → speed = 2π / 0.33
function selfRotSpeed(rotationHours: number) {
  const earthRotScene = YEAR_SCENE_SECONDS / 365.25; // ~0.33s per day
  return (2 * Math.PI) / ((rotationHours / 24) * earthRotScene);
}

const PLANET_DATA: {
  name: string; radius: number; dist: number; color: string;
  speed: number; ring?: boolean; tilt: number; selfRot: number;
  gasGiant?: boolean; texture?: string;
}[] = [
  { name: "Mercury", radius: 0.12, dist: 12, color: "#A0826D", speed: orbitalSpeed(88), tilt: 0.03, selfRot: selfRotSpeed(1407.6) },
  { name: "Venus", radius: 0.22, dist: 16, color: "#E8CDA0", speed: orbitalSpeed(225), tilt: 2.64, selfRot: selfRotSpeed(5832.5) },
  { name: "Mars", radius: 0.18, dist: 22, color: "#C1440E", speed: orbitalSpeed(687), tilt: 25.2, selfRot: selfRotSpeed(24.6) },
  { name: "Jupiter", radius: 0.7, dist: 32, color: "#C88B3A", speed: orbitalSpeed(4333), tilt: 3.13, selfRot: selfRotSpeed(9.93), gasGiant: true, texture: "jupiter" },
  { name: "Saturn", radius: 0.55, dist: 42, color: "#E8D5A3", speed: orbitalSpeed(10759), ring: true, tilt: 26.7, selfRot: selfRotSpeed(10.7), gasGiant: true },
  { name: "Uranus", radius: 0.35, dist: 52, color: "#73C2C6", speed: orbitalSpeed(30687), tilt: 97.8, selfRot: selfRotSpeed(17.2), gasGiant: true },
  { name: "Neptune", radius: 0.33, dist: 60, color: "#4B70DD", speed: orbitalSpeed(60190), tilt: 28.3, selfRot: selfRotSpeed(16.1), gasGiant: true },
];
// Sun at origin of solar system — offset from Earth
const SUN_POS = new THREE.Vector3(-70, 0, 0);

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

// ---------------------------------------------------------------------------
// Procedural planet texture generator
// ---------------------------------------------------------------------------
function generatePlanetTexture(name: string, w = 512, h = 256): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  switch (name.toLowerCase()) {
    case "mercury": {
      // Gray surface with dark crater spots
      ctx.fillStyle = "#8a8278";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 80; i++) {
        const cx = Math.random() * w;
        const cy = Math.random() * h;
        const r = 2 + Math.random() * 12;
        const shade = 60 + Math.floor(Math.random() * 40);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${shade},${shade - 5},${shade - 10})`;
        ctx.fill();
      }
      // Lighter highlands
      for (let i = 0; i < 30; i++) {
        const cx = Math.random() * w;
        const cy = Math.random() * h;
        const r = 5 + Math.random() * 20;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,170,160,0.15)`;
        ctx.fill();
      }
      break;
    }
    case "venus": {
      // Yellow-white cloud bands with swirl patterns
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, "#e8d8a0");
      gradient.addColorStop(0.3, "#f0e0b0");
      gradient.addColorStop(0.5, "#e0c880");
      gradient.addColorStop(0.7, "#f0dfa0");
      gradient.addColorStop(1, "#e8d090");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      // Cloud swirls
      for (let y = 0; y < h; y += 4) {
        const offset = Math.sin(y * 0.04) * 20 + Math.sin(y * 0.1) * 8;
        ctx.strokeStyle = `rgba(255,240,200,${0.08 + Math.random() * 0.06})`;
        ctx.lineWidth = 2 + Math.random() * 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < w; x += 10) {
          ctx.lineTo(x, y + Math.sin((x + offset) * 0.02) * 6);
        }
        ctx.stroke();
      }
      break;
    }
    case "mars": {
      // Rust-red base with terrain patches + polar caps
      ctx.fillStyle = "#b04820";
      ctx.fillRect(0, 0, w, h);
      // Darker terrain
      for (let i = 0; i < 40; i++) {
        const cx = Math.random() * w;
        const cy = h * 0.15 + Math.random() * h * 0.7;
        const rx = 20 + Math.random() * 60;
        const ry = 10 + Math.random() * 30;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${80 + Math.random() * 40},${20 + Math.random() * 20},${10},${0.2 + Math.random() * 0.15})`;
        ctx.fill();
      }
      // Lighter highlands
      for (let i = 0; i < 25; i++) {
        const cx = Math.random() * w;
        const cy = h * 0.2 + Math.random() * h * 0.6;
        const r = 10 + Math.random() * 30;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,140,100,0.12)`;
        ctx.fill();
      }
      // Polar caps
      const capGrad = ctx.createLinearGradient(0, 0, 0, 20);
      capGrad.addColorStop(0, "rgba(255,255,255,0.7)");
      capGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = capGrad;
      ctx.fillRect(0, 0, w, 20);
      const capGrad2 = ctx.createLinearGradient(0, h - 20, 0, h);
      capGrad2.addColorStop(0, "rgba(255,255,255,0)");
      capGrad2.addColorStop(1, "rgba(255,255,255,0.7)");
      ctx.fillStyle = capGrad2;
      ctx.fillRect(0, h - 20, w, 20);
      break;
    }
    case "jupiter": {
      // Enhanced bands with Great Red Spot
      const bandColors = ["#c88b3a", "#a67228", "#d4a050", "#8a5e1e", "#c88b3a", "#b8802e", "#d4a050", "#a67228", "#c88b3a", "#9a6e28", "#d0a048", "#b88830"];
      const bandH = h / bandColors.length;
      bandColors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, i * bandH, w, bandH + 1);
      });
      // Soft blending between bands
      for (let y = 0; y < h; y++) {
        const noise = Math.sin(y * 0.05) * 10 + Math.sin(y * 0.13) * 5;
        ctx.strokeStyle = `rgba(${180 + noise},${120 + noise * 0.5},${50},0.04)`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < w; x += 5) {
          ctx.lineTo(x, y + Math.sin(x * 0.01 + y * 0.03) * 2);
        }
        ctx.stroke();
      }
      // Great Red Spot
      ctx.save();
      ctx.translate(w * 0.6, h * 0.58);
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 16, 0, 0, Math.PI * 2);
      const grsGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
      grsGrad.addColorStop(0, "rgba(200,80,40,0.7)");
      grsGrad.addColorStop(0.5, "rgba(180,70,35,0.5)");
      grsGrad.addColorStop(1, "rgba(160,60,30,0)");
      ctx.fillStyle = grsGrad;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "saturn": {
      // Pale gold bands with subtle variations
      const satBands = ["#e8d5a3", "#d4c090", "#e0c888", "#c8b478", "#e8d0a0", "#d8c498", "#e0cc90", "#d0b880"];
      const bandHs = h / satBands.length;
      satBands.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, i * bandHs, w, bandHs + 1);
      });
      for (let y = 0; y < h; y += 3) {
        ctx.strokeStyle = `rgba(255,240,200,0.05)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < w; x += 8) {
          ctx.lineTo(x, y + Math.sin(x * 0.015 + y * 0.02) * 2);
        }
        ctx.stroke();
      }
      break;
    }
    case "uranus": {
      // Blue-green with faint bands
      const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
      baseGrad.addColorStop(0, "#73c2c6");
      baseGrad.addColorStop(0.3, "#6ab8be");
      baseGrad.addColorStop(0.5, "#80ccd0");
      baseGrad.addColorStop(0.7, "#68b0b8");
      baseGrad.addColorStop(1, "#75c4c8");
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, w, h);
      // Faint band structure
      for (let y = 0; y < h; y += 8) {
        ctx.strokeStyle = `rgba(100,200,210,0.08)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + Math.sin(y * 0.1) * 2);
        ctx.stroke();
      }
      break;
    }
    case "neptune": {
      // Deep blue with white storm streaks
      const nepGrad = ctx.createLinearGradient(0, 0, 0, h);
      nepGrad.addColorStop(0, "#3058c8");
      nepGrad.addColorStop(0.3, "#4060d0");
      nepGrad.addColorStop(0.5, "#3850c0");
      nepGrad.addColorStop(0.7, "#4868d8");
      nepGrad.addColorStop(1, "#3550c0");
      ctx.fillStyle = nepGrad;
      ctx.fillRect(0, 0, w, h);
      // Band structure
      for (let y = 0; y < h; y += 6) {
        ctx.strokeStyle = `rgba(60,80,180,0.1)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + Math.sin(y * 0.08) * 3);
        ctx.stroke();
      }
      // White storm streaks
      for (let i = 0; i < 8; i++) {
        const sx = Math.random() * w;
        const sy = h * 0.2 + Math.random() * h * 0.6;
        ctx.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.15})`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 20 + Math.random() * 40, sy + (Math.random() - 0.5) * 6);
        ctx.stroke();
      }
      break;
    }
    case "sun": {
      // Orange-yellow plasma-like noise
      ctx.fillStyle = "#ff8800";
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          const n = Math.sin(x * 0.05 + y * 0.07) * Math.cos(x * 0.03 - y * 0.04);
          const r = 220 + n * 35;
          const g = 140 + n * 50;
          const b = 30 + n * 20;
          ctx.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
      // Bright hotspots
      for (let i = 0; i < 15; i++) {
        const cx = Math.random() * w;
        const cy = Math.random() * h;
        const r = 10 + Math.random() * 30;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, "rgba(255,255,200,0.3)");
        grad.addColorStop(1, "rgba(255,200,100,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  return canvas;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FocusTarget {
  type: "earth" | "iss" | "dsn" | "asteroid" | "probe" | "planet" | "sun" | "reset";
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
function createWireframeSphere(radius: number, color: number, opacity: number, segments: number = 32): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, segments, segments);
  const mat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity });
  return new THREE.Mesh(geo, mat);
}

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

/** Create a multi-line HUD label sprite for inline data */
function createHUDLabel(lines: string[], color: string, scale: number = 2.5): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 24px monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const lineHeight = 30;
  const startY = (256 - lines.length * lineHeight) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 256, startY + i * lineHeight);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale * 0.5, 1);
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const JarvisScene = forwardRef<JarvisSceneHandle, JarvisSceneProps>(
  function JarvisScene({ width, height, issData, onSelectObject }, ref) {

    const containerRef = useRef<HTMLDivElement>(null);
    const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
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
      issOrbitGroup: THREE.Group;
      asteroidAnims: { mesh: THREE.Mesh; speed: number; angle: number; dist: number; approachAngle: number; trail: THREE.Points; initScale: THREE.Vector3 }[];
      planetAnims: { mesh: THREE.Mesh; angle: number; speed: number; dist: number; tilt: number; selfRotSpeed: number }[];
      hudSprites: { sprite: THREE.Sprite; parent: THREE.Object3D }[];
      scanBand: THREE.Mesh;
      sunCorona: THREE.Mesh;
    } | null>(null);

    // Expose focusOn via ref
    useImperativeHandle(ref, () => ({
      focusOn: (target: FocusTarget) => {
        if (!internals.current) return;
        const { objectMap, camera } = internals.current;

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

          // Distance per type
          let dist = 6;
          if (target.type === "asteroid") dist = 4;
          else if (target.type === "probe") dist = 4;
          else if (target.type === "dsn") dist = 4;
          else if (target.type === "sun") dist = 12;
          else if (target.type === "planet") {
            const pName = (target.id || "").replace("planet-", "");
            const pData = PLANET_DATA.find((p) => p.name.toLowerCase() === pName);
            dist = pData ? pData.radius * 5 + 2 : 6;
          }

          // For ISS/Earth: slightly above, looking down
          if (target.type === "iss") {
            internals.current.flyTarget = pos.clone().add(new THREE.Vector3(0, 2, 3));
            internals.current.flyLook = pos.clone();
          } else {
            // ALL objects: camera BEHIND object, Earth/origin visible ahead
            const dirToEarth = EARTH_POS.clone().sub(pos).normalize();
            internals.current.flyTarget = pos.clone().sub(dirToEarth.clone().multiplyScalar(dist));
            internals.current.flyTarget.y = Math.max(internals.current.flyTarget.y, pos.y + dist * 0.25);
            internals.current.flyLook = pos.clone().add(dirToEarth.clone().multiplyScalar(pos.distanceTo(EARTH_POS) * 0.3));
          }

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

      // Scene
      const scene = new THREE.Scene();

      // Camera — default view toward Earth (front-center)
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 500);
      camera.position.set(0, 3, 8);

      // Controls — easier rotation
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
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222244, 0.8);
      scene.add(hemiLight);
      const sunLight = new THREE.PointLight(0xffffff, 2, 300);
      sunLight.position.copy(SUN_POS);
      scene.add(sunLight);
      // Fill light from opposite side
      const fillLight = new THREE.PointLight(0x0066ff, 0.5, 100);
      fillLight.position.set(30, 10, 20);
      scene.add(fillLight);

      // Starfield
      const starCount = 3000;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
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

      // Object registry
      const objectMap = new Map<string, THREE.Object3D>();
      const hudSprites: { sprite: THREE.Sprite; parent: THREE.Object3D }[] = [];

      // ===== EARTH (realistic textured) =====
      const texLoader = new THREE.TextureLoader();
      const earthDayTex = texLoader.load("/textures/earth_day.jpg");
      const earthBumpTex = texLoader.load("/textures/earth_bump.jpg");
      const earthCore = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS, 64, 64),
        new THREE.MeshStandardMaterial({
          map: earthDayTex,
          bumpMap: earthBumpTex,
          bumpScale: 0.03,
          roughness: 0.45,
          metalness: 0.1,
          emissive: new THREE.Color(0x112244),
          emissiveIntensity: 0.15,
        }),
      );
      earthCore.position.copy(EARTH_POS);
      scene.add(earthCore);

      objectMap.set("earth", earthCore);

      // Atmosphere glow
      const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.08, 32, 32);
      const atmosMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.06 });
      const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
      atmosMesh.position.copy(EARTH_POS);
      scene.add(atmosMesh);

      // Blueprint scan line sphere
      const scanGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.03, 48, 48);
      const scanCanvas = document.createElement("canvas");
      scanCanvas.width = 512;
      scanCanvas.height = 256;
      const scanCtx = scanCanvas.getContext("2d")!;
      const scanTex = new THREE.CanvasTexture(scanCanvas);
      const scanMat = new THREE.MeshBasicMaterial({ map: scanTex, transparent: true, opacity: 0.12, depthWrite: false });
      const scanBand = new THREE.Mesh(scanGeo, scanMat);
      scanBand.position.copy(EARTH_POS);
      scene.add(scanBand);

      // Earth label
      const earthLabel = createLabel("EARTH", "#00D4FF", 2);
      earthLabel.position.set(EARTH_POS.x, EARTH_POS.y + EARTH_RADIUS + 0.8, EARTH_POS.z);
      scene.add(earthLabel);

      // LD distance rings around Earth
      [1, 5, 10, 20].forEach((ld) => {
        const ring = createDashedRing(ld * LD_SCALE, 0x00d4ff, 0.06);
        ring.position.copy(EARTH_POS);
        scene.add(ring);
        const lbl = createLabel(`${ld} LD`, "#00D4FF", 1.2);
        lbl.material.opacity = 0.3;
        lbl.position.set(EARTH_POS.x + ld * LD_SCALE + 0.5, EARTH_POS.y + 0.3, EARTH_POS.z);
        scene.add(lbl);
      });

      // ===== DSN STATIONS on Earth surface (children of earthCore so they rotate) =====
      DSN_GROUND_STATIONS.forEach((station) => {
        if (!station.lat || !station.lon) return;
        const pos = latLonToSphere(station.lat, station.lon, EARTH_RADIUS * 1.02, new THREE.Vector3(0, 0, 0));
        const dotGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(pos);
        earthCore.add(dot);
        objectMap.set(station.id, dot);
        const lbl = createLabel(station.name, "#34D399", 1);
        lbl.position.copy(pos).add(new THREE.Vector3(0, 0.3, 0));
        earthCore.add(lbl);
      });

      // ===== ISS =====
      const issGeo = new THREE.OctahedronGeometry(0.08, 0);
      const issMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
      const issMesh = new THREE.Mesh(issGeo, issMat);
      scene.add(issMesh);
      objectMap.set("iss", issMesh);

      const issOrbitGroup = new THREE.Group();
      const issOrbitRing = createDashedRing(EARTH_RADIUS + 0.5, 0x00d4ff, 0.15);
      issOrbitGroup.add(issOrbitRing);
      issOrbitGroup.rotation.x = (ISS_INCLINATION * Math.PI) / 180;
      issOrbitGroup.position.copy(EARTH_POS);
      scene.add(issOrbitGroup);

      const issLabel = createLabel("ISS", "#00D4FF", 1.2);
      issLabel.position.y = 0.3;
      issMesh.add(issLabel);

      // ===== ASTEROIDS (near Earth zone) — more realistic =====
      const asteroidAnims: NonNullable<typeof internals.current>["asteroidAnims"] = [];
      NEO_DATASET.entries.forEach((asteroid) => {
        const scaledDist = asteroid.distanceLD * LD_SCALE;
        const angle = (asteroid.approachAngle * Math.PI) / 180;
        const size = Math.max(0.08, Math.min(asteroid.diameterM / 300, 0.35));

        // Rocky irregular asteroid: subdivided icosahedron with aggressive vertex noise
        const aGeo = new THREE.IcosahedronGeometry(size, 2);
        const posAttr = aGeo.getAttribute("position");
        // Use seeded noise per-vertex for craters and ridges
        for (let vi = 0; vi < posAttr.count; vi++) {
          const nx = posAttr.getX(vi);
          const ny = posAttr.getY(vi);
          const nz = posAttr.getZ(vi);
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          // Multi-octave displacement: large bumps + small craters
          const large = (Math.sin(nx * 7.3 + ny * 5.1) * Math.cos(nz * 6.8 + nx * 3.2)) * 0.35;
          const small = (Math.sin(nx * 19 + nz * 13) * Math.cos(ny * 17 + nx * 11)) * 0.15;
          const displace = 1 + large + small + (Math.random() * 0.12 - 0.06);
          posAttr.setXYZ(vi, (nx / len) * size * displace, (ny / len) * size * displace, (nz / len) * size * displace);
        }
        posAttr.needsUpdate = true;
        aGeo.computeVertexNormals();
        aGeo.computeBoundingSphere();

        // Rocky colors: grays/browns with per-face variation
        const rockyColors = [0x6b6560, 0x7a6e5e, 0x5c5550, 0x8a7d6b, 0x4e4845];
        const baseColor = asteroid.hazardous ? 0xb03030 : rockyColors[Math.floor(Math.random() * rockyColors.length)];
        const aMat = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.95,
          metalness: 0.05,
          emissive: asteroid.hazardous ? 0x661111 : 0x221100,
          emissiveIntensity: 0.3,
          flatShading: true,
        });
        const aMesh = new THREE.Mesh(aGeo, aMat);
        // Non-uniform scale for elongated shapes
        aMesh.scale.set(
          0.6 + Math.random() * 0.8,
          0.5 + Math.random() * 0.5,
          0.6 + Math.random() * 0.8,
        );
        aMesh.position.set(
          EARTH_POS.x + Math.cos(angle) * scaledDist,
          EARTH_POS.y + Math.sin(angle * 0.3) * 0.5,
          EARTH_POS.z + Math.sin(angle) * scaledDist,
        );
        scene.add(aMesh);
        objectMap.set(asteroid.id, aMesh);

        // Wireframe overlay for Jarvis feel (low-poly for visible edges)
        const aWireGeo = new THREE.IcosahedronGeometry(size * 1.05, 1);
        const aWireMat = new THREE.MeshBasicMaterial({
          color: asteroid.hazardous ? 0xef4444 : 0x99887766,
          wireframe: true,
          transparent: true,
          opacity: 0.15,
        });
        aMesh.add(new THREE.Mesh(aWireGeo, aWireMat));

        // Particle trail (3 fading dots behind)
        const trailPositions = new Float32Array(9); // 3 points x 3
        const trailSizes = new Float32Array([3, 2, 1]);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
        trailGeo.setAttribute("size", new THREE.BufferAttribute(trailSizes, 1));
        const trailMat = new THREE.PointsMaterial({
          color: asteroid.hazardous ? 0xef4444 : 0xffcf6e,
          size: 0.04,
          transparent: true,
          opacity: 0.4,
          sizeAttenuation: true,
        });
        const trail = new THREE.Points(trailGeo, trailMat);
        scene.add(trail);

        // Flyby trajectory arc — hyperbolic curve around Earth
        const trajPts: THREE.Vector3[] = [];
        const periapsis = scaledDist; // closest approach = current distance
        const deflection = 0.4 + Math.random() * 0.5; // curvature varies per asteroid
        const incomingAngle = angle + Math.PI; // approach from opposite side
        for (let i = 0; i <= 60; i++) {
          const t = (i / 60 - 0.5) * 2; // -1 to +1
          const curveAngle = incomingAngle + t * (0.8 + deflection);
          // Distance grows away from periapsis on both sides
          const d = periapsis + Math.abs(t) * periapsis * 1.2;
          trajPts.push(new THREE.Vector3(
            EARTH_POS.x + Math.cos(curveAngle) * d,
            EARTH_POS.y + Math.sin(t * Math.PI * 0.15) * 0.4,
            EARTH_POS.z + Math.sin(curveAngle) * d,
          ));
        }
        const trajGeo = new THREE.BufferGeometry().setFromPoints(trajPts);
        const trajMat = new THREE.LineDashedMaterial({
          color: asteroid.hazardous ? 0xef4444 : 0xffcf6e,
          transparent: true, opacity: 0.3, dashSize: 0.3, gapSize: 0.2,
        });
        const trajLine = new THREE.Line(trajGeo, trajMat);
        trajLine.computeLineDistances();
        scene.add(trajLine);

        // Name label
        const lbl = createLabel(asteroid.name, asteroid.hazardous ? "#EF4444" : "#FFCF6E", 1.2);
        lbl.position.y = size + 0.4;
        aMesh.add(lbl);

        // Inline HUD label: velocity + distance
        const hudLabel = createHUDLabel(
          [`${(asteroid.speedKmH / 1000).toFixed(1)}k km/h`, `${asteroid.distanceLD} LD`],
          asteroid.hazardous ? "#EF4444" : "#FFCF6E",
          1.8,
        );
        hudLabel.position.y = size + 0.9;
        aMesh.add(hudLabel);
        hudSprites.push({ sprite: hudLabel, parent: aMesh });

        asteroidAnims.push({
          mesh: aMesh, speed: asteroid.speedKmH * 0.000001,
          angle, dist: scaledDist, approachAngle: asteroid.approachAngle,
          trail, initScale: aMesh.scale.clone(),
        });
      });

      // ===== SUN — procedural texture + animated corona =====
      const sunGeo = new THREE.SphereGeometry(3, 32, 32);
      const sunTexCanvas = generatePlanetTexture("sun");
      const sunCanvasTex = new THREE.CanvasTexture(sunTexCanvas);
      sunCanvasTex.needsUpdate = true;
      const sunMat = new THREE.MeshStandardMaterial({
        map: sunCanvasTex,
        emissive: 0xffaa00,
        emissiveIntensity: 1.5,
        roughness: 1,
        metalness: 0,
      });
      const sunMesh = new THREE.Mesh(sunGeo, sunMat);
      sunMesh.position.copy(SUN_POS);
      scene.add(sunMesh);
      objectMap.set("sun", sunMesh);
      // Inner corona
      const sunCorona = new THREE.Mesh(
        new THREE.SphereGeometry(4, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.1 }),
      );
      sunCorona.position.copy(SUN_POS);
      scene.add(sunCorona);
      // Outer corona
      const sunCoronaOuter = new THREE.Mesh(
        new THREE.SphereGeometry(6, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.04 }),
      );
      sunCoronaOuter.position.copy(SUN_POS);
      scene.add(sunCoronaOuter);
      const sunLabel = createLabel("SUN", "#FFDD44", 3);
      sunLabel.position.set(SUN_POS.x, SUN_POS.y + 5, SUN_POS.z);
      scene.add(sunLabel);

      // ===== PLANETS (orbiting Sun) — improved visuals + real orbital ratios =====
      const planetAnims: { mesh: THREE.Mesh; angle: number; speed: number; dist: number; tilt: number; selfRotSpeed: number }[] = [];
      PLANET_DATA.forEach((p) => {
        const orbitRing = createDashedRing(p.dist, 0x00d4ff, 0.06);
        orbitRing.position.copy(SUN_POS);
        scene.add(orbitRing);

        // Higher segment count for smoother spheres
        const pGeo = new THREE.SphereGeometry(p.radius, 32, 32);

        // Procedural canvas texture for each planet
        const texCanvas = generatePlanetTexture(p.name);
        const canvasTex = new THREE.CanvasTexture(texCanvas);
        canvasTex.needsUpdate = true;
        const pMat = new THREE.MeshStandardMaterial({
          map: canvasTex,
          roughness: p.gasGiant ? 0.5 : 0.65,
          metalness: p.gasGiant ? 0.1 : 0.15,
          emissive: new THREE.Color(p.color),
          emissiveIntensity: p.gasGiant ? 0.2 : 0.12,
        });

        const pMesh = new THREE.Mesh(pGeo, pMat);
        const startAngle = Math.random() * Math.PI * 2;
        pMesh.position.set(
          SUN_POS.x + Math.cos(startAngle) * p.dist,
          0,
          SUN_POS.z + Math.sin(startAngle) * p.dist,
        );
        // Apply real axial tilt
        pMesh.rotation.z = (p.tilt * Math.PI) / 180;
        scene.add(pMesh);
        objectMap.set(`planet-${p.name.toLowerCase()}`, pMesh);

        // Saturn: gradient rings with Cassini gap
        if (p.ring) {
          // Inner ring
          const ringInner = new THREE.Mesh(
            new THREE.RingGeometry(p.radius * 1.3, p.radius * 1.7, 64),
            new THREE.MeshBasicMaterial({ color: 0xe8d5a3, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
          );
          ringInner.rotation.x = Math.PI / 2;
          pMesh.add(ringInner);
          // Cassini gap (thin dark ring)
          const ringGap = new THREE.Mesh(
            new THREE.RingGeometry(p.radius * 1.7, p.radius * 1.75, 64),
            new THREE.MeshBasicMaterial({ color: 0x050710, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
          );
          ringGap.rotation.x = Math.PI / 2;
          pMesh.add(ringGap);
          // Outer ring
          const ringOuter = new THREE.Mesh(
            new THREE.RingGeometry(p.radius * 1.75, p.radius * 2.3, 64),
            new THREE.MeshBasicMaterial({ color: 0xd4c090, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
          );
          ringOuter.rotation.x = Math.PI / 2;
          pMesh.add(ringOuter);
        }

        // Label
        const lbl = createLabel(p.name.toUpperCase(), p.color, 1.5);
        lbl.position.y = p.radius + 0.5;
        pMesh.add(lbl);

        planetAnims.push({ mesh: pMesh, angle: startAngle, speed: p.speed, dist: p.dist, tilt: p.tilt, selfRotSpeed: p.selfRot });
      });

      // ===== PROBES (compound shape: box body + solar panels) =====
      PROBES_DATASET.entries.forEach((probe) => {
        const scaledDist = probe.distanceAU > 10
          ? 60 + Math.log10(probe.distanceAU / 10) * 30
          : SUN_POS.length() + (probe.distanceAU / 5.5) * 70;
        const angle = (probe.positionAngle * Math.PI) / 180;
        const px = SUN_POS.x + Math.cos(angle) * scaledDist;
        const pz = SUN_POS.z + Math.sin(angle) * scaledDist;

        // Compound probe shape
        const probeGroup = new THREE.Group();
        // Body
        const bodyGeo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x00d4ff,
          emissive: 0x006688,
          emissiveIntensity: 0.6,
          roughness: 0.4,
          metalness: 0.6,
        });
        probeGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

        // Solar panels (two flat quads)
        const panelGeo = new THREE.PlaneGeometry(0.25, 0.08);
        const panelMat = new THREE.MeshStandardMaterial({
          color: 0x2288cc,
          emissive: 0x00aaff,
          emissiveIntensity: 0.3,
          side: THREE.DoubleSide,
          roughness: 0.3,
          metalness: 0.5,
        });
        const panelL = new THREE.Mesh(panelGeo, panelMat);
        panelL.position.set(-0.19, 0, 0);
        panelL.rotation.y = Math.PI / 2;
        probeGroup.add(panelL);
        const panelR = new THREE.Mesh(panelGeo, panelMat);
        panelR.position.set(0.19, 0, 0);
        panelR.rotation.y = Math.PI / 2;
        probeGroup.add(panelR);

        probeGroup.position.set(px, 0.2, pz);
        scene.add(probeGroup);
        objectMap.set(probe.id, probeGroup);

        // Trajectory from Sun
        const trajPts: THREE.Vector3[] = [];
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const d = t * scaledDist;
          const curveAngle = angle + Math.sin(t * Math.PI) * 0.1;
          trajPts.push(new THREE.Vector3(
            SUN_POS.x + Math.cos(curveAngle) * d,
            Math.sin(t * Math.PI) * 0.2,
            SUN_POS.z + Math.sin(curveAngle) * d,
          ));
        }
        const trajGeo = new THREE.BufferGeometry().setFromPoints(trajPts);
        const trajLine = new THREE.Line(trajGeo,
          new THREE.LineDashedMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.12, dashSize: 0.5, gapSize: 0.3 }),
        );
        trajLine.computeLineDistances();
        scene.add(trajLine);

        // Name label
        const lbl = createLabel(probe.name, "#00D4FF", 1.5);
        lbl.position.y = 0.6;
        probeGroup.add(lbl);

        // Inline HUD: mission name + distance
        const hudLabel = createHUDLabel(
          [probe.name, probe.distanceFromSun],
          "#00D4FF",
          2.0,
        );
        hudLabel.position.y = 1.1;
        probeGroup.add(hudLabel);
        hudSprites.push({ sprite: hudLabel, parent: probeGroup });
      });

      // ===== GRID PLANE (blueprint feel) =====
      const gridHelper = new THREE.GridHelper(200, 100, 0x00d4ff, 0x00d4ff);
      (gridHelper.material as THREE.Material).transparent = true;
      (gridHelper.material as THREE.Material).opacity = 0.03;
      gridHelper.position.y = -0.5;
      scene.add(gridHelper);

      // ===== ANIMATION =====
      const clock = new THREE.Clock();
      let animId = 0;
      let paused = false;
      let idleTime = 0;

      const state = {
        renderer, scene, camera, controls, animId, clock, paused,
        flyTarget: null as THREE.Vector3 | null,
        flyLook: null as THREE.Vector3 | null,
        flyDist: 8,
        objectMap, selectedId: null as string | null,
        prevSelectedId: null as string | null,
        issMesh, issOrbitGroup,
        asteroidAnims, planetAnims,
        hudSprites,
        scanBand,
        sunCorona,
      };
      internals.current = state;

      // Raycaster for direct clicks on 3D objects
      const raycaster = new THREE.Raycaster();
      const mouseVec = new THREE.Vector2();

      function onPointerDown(e: PointerEvent) {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
      }

      function onPointerUp(e: PointerEvent) {
        // Drag guard: if moved >5px, treat as drag — don't select
        if (pointerDownPos.current) {
          const dx = e.clientX - pointerDownPos.current.x;
          const dy = e.clientY - pointerDownPos.current.y;
          if (Math.sqrt(dx * dx + dy * dy) > 5) {
            pointerDownPos.current = null;
            return;
          }
        }
        pointerDownPos.current = null;

        const rect = renderer.domElement.getBoundingClientRect();
        mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseVec, camera);

        const clickables = Array.from(objectMap.values()).filter((o) => o instanceof THREE.Mesh || o instanceof THREE.Group);
        const intersects = raycaster.intersectObjects(clickables, true);
        if (intersects.length > 0) {
          // Find root object in objectMap
          let hitObj = intersects[0].object;
          let foundId: string | null = null;
          // Walk up parent chain to find mapped object
          while (hitObj) {
            for (const [id, obj] of objectMap.entries()) {
              if (obj === hitObj) { foundId = id; break; }
            }
            if (foundId) break;
            hitObj = hitObj.parent as THREE.Object3D;
          }

          if (foundId) {
            const id = foundId;
            let type = "object";
            const data: Record<string, string> = {};
            if (id.startsWith("dsn-")) {
              type = "DSN";
              const station = DSN_GROUND_STATIONS.find((s) => s.id === id);
              if (station) {
                data["Lokacija"] = station.meta.country as string;
                data["Antene"] = String(station.meta.antennas);
                data["Primarni dish"] = station.meta.primaryDish as string;
                data["Aktivne misije"] = station.meta.activeMissions as string;
                data["Signal"] = `${station.meta.signalStrength}/5`;
                data["Koordinate"] = `${station.lat?.toFixed(2)}°, ${station.lon?.toFixed(2)}°`;
              }
            } else if (id === "iss") {
              type = "ISS";
              data["Visina"] = `${issData.altitude} km`;
              data["Brzina"] = `${issData.speed.toLocaleString()} km/h`;
              data["Pozicija"] = `${issData.lat.toFixed(2)}°, ${issData.lon.toFixed(2)}°`;
              data["Inklinacija"] = `${ISS_INCLINATION}°`;
              data["Posada"] = `${issData.crew} članova`;
              data["Orbitalni period"] = "92.68 min";
            } else if (id.startsWith("planet-")) {
              type = "Planet";
              const pName = id.replace("planet-", "");
              const info = PLANET_INFO[pName];
              if (info) {
                Object.assign(data, info);
              }
            } else if (id === "sun") {
              type = "Zvijezda";
              Object.assign(data, SUN_INFO);
            } else {
              const neo = NEO_DATASET.entries.find((a) => a.id === id);
              if (neo) {
                type = "Asteroid";
                data["Promjer"] = `${neo.diameterM}m`;
                data["Brzina"] = `${neo.speedKmH.toLocaleString()} km/h`;
                data["Udaljenost"] = `${neo.distanceLD} LD`;
                data["Udaljenost (km)"] = `${neo.distanceKm.toLocaleString()} km`;
                data["Opasan"] = neo.hazardous ? "DA" : "NE";
                data["Najbliži prolaz"] = new Date(neo.closestApproach).toLocaleString();
                data["Energija udara"] = `~${(neo.diameterM * neo.speedKmH * 0.001).toFixed(1)} kt TNT`;
                data["Kut prilaza"] = `${neo.approachAngle}°`;
              }
              const probe = PROBES_DATASET.entries.find((p) => p.id === id);
              if (probe) {
                type = "Sonda";
                data["Misija"] = probe.mission;
                data["Lansiranje"] = String(probe.launchYear);
                data["Status"] = probe.status === "active" ? "Aktivan" : probe.status === "idle" ? "Neaktivan" : "Izgubljen";
                data["Udaljenost"] = probe.distanceFromSun;
                data["Brzina"] = probe.speed;
                data["Zadnji signal"] = new Date(probe.lastSignal).toLocaleString();
              }
            }

            const displayName = id.startsWith("planet-")
              ? id.replace("planet-", "").charAt(0).toUpperCase() + id.replace("planet-", "").slice(1)
              : (DSN_GROUND_STATIONS.find(s => s.id === id)?.name
                || NEO_DATASET.entries.find(a => a.id === id)?.name
                || PROBES_DATASET.entries.find(p => p.id === id)?.name
                || id.toUpperCase());

            onSelectObject?.({ type, name: displayName, data });

            // Fly to — camera BEHIND object, Earth visible ahead
            const pos = new THREE.Vector3();
            const obj = objectMap.get(id)!;
            obj.getWorldPosition(pos);

            let dist = 5;
            if (type === "Asteroid") dist = 4;
            else if (type === "Sonda") dist = 4;
            else if (type === "DSN") dist = 4;
            else if (type === "Zvijezda") dist = 12;
            else if (type === "Planet") {
              const pName = id.replace("planet-", "");
              const pData = PLANET_DATA.find((p) => p.name.toLowerCase() === pName);
              dist = pData ? pData.radius * 5 + 2 : 6;
            }

            if (type === "ISS") {
              state.flyTarget = pos.clone().add(new THREE.Vector3(0, 2, 3));
              state.flyLook = pos.clone();
            } else {
              const dirToEarth = EARTH_POS.clone().sub(pos).normalize();
              state.flyTarget = pos.clone().sub(dirToEarth.clone().multiplyScalar(dist));
              state.flyTarget.y = Math.max(state.flyTarget.y, pos.y + dist * 0.25);
              state.flyLook = pos.clone().add(dirToEarth.clone().multiplyScalar(pos.distanceTo(EARTH_POS) * 0.3));
            }

            state.flyDist = dist;
            state.selectedId = id;
          }
          idleTime = 0;
        }
      }
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);

      // Interaction detection for auto-rotate pause
      let interacting = false;
      function onInteractStart() { interacting = true; idleTime = 0; }
      function onInteractEnd() { interacting = false; }
      renderer.domElement.addEventListener("pointerdown", onInteractStart);
      renderer.domElement.addEventListener("pointerup", onInteractEnd);
      renderer.domElement.addEventListener("wheel", () => { idleTime = 0; });

      // Trail position history for asteroids
      const trailHistory: THREE.Vector3[][] = asteroidAnims.map(() => []);

      function animate() {
        animId = requestAnimationFrame(animate);
        if (paused) return;

        const delta = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.getElapsedTime();

        // ISS position on inclined orbit
        const issAngle = elapsed * 0.15;
        const issOrbitR = EARTH_RADIUS + 0.5;
        const issX = Math.cos(issAngle) * issOrbitR;
        const issZ = Math.sin(issAngle) * issOrbitR;
        const incRad = (ISS_INCLINATION * Math.PI) / 180;
        issMesh.position.set(
          EARTH_POS.x + issX,
          EARTH_POS.y + issZ * Math.sin(incRad),
          EARTH_POS.z + issZ * Math.cos(incRad),
        );
        issMesh.rotation.y += delta * 2;

        // Rotate Earth
        earthCore.rotation.y += delta * 0.05;
        scanBand.rotation.y += delta * 0.05;

        // Animate scan band texture
        scanCtx.clearRect(0, 0, 512, 256);
        const bandY = ((elapsed * 30) % 256);
        const gradient = scanCtx.createLinearGradient(0, bandY - 20, 0, bandY + 20);
        gradient.addColorStop(0, "rgba(0, 212, 255, 0)");
        gradient.addColorStop(0.5, "rgba(0, 212, 255, 0.6)");
        gradient.addColorStop(1, "rgba(0, 212, 255, 0)");
        scanCtx.fillStyle = gradient;
        scanCtx.fillRect(0, bandY - 20, 512, 40);
        scanTex.needsUpdate = true;

        // Animate asteroids
        for (let ai = 0; ai < asteroidAnims.length; ai++) {
          const aa = asteroidAnims[ai];
          aa.angle += aa.speed * delta;
          const d = aa.dist + Math.sin(elapsed * 0.1 + aa.approachAngle) * 0.3;
          const approachRad = (aa.approachAngle * Math.PI) / 180;
          const newX = EARTH_POS.x + Math.cos(approachRad + aa.angle * 0.01) * d;
          const newY = EARTH_POS.y + Math.sin(elapsed * 0.3 + aa.approachAngle) * 0.2;
          const newZ = EARTH_POS.z + Math.sin(approachRad + aa.angle * 0.01) * d;

          // Update trail history
          const hist = trailHistory[ai];
          hist.unshift(new THREE.Vector3(newX, newY, newZ));
          if (hist.length > 4) hist.length = 4;

          // Update trail points
          const trailPositions = aa.trail.geometry.attributes.position.array as Float32Array;
          for (let t = 0; t < 3; t++) {
            const src = hist[Math.min(t + 1, hist.length - 1)];
            trailPositions[t * 3] = src.x;
            trailPositions[t * 3 + 1] = src.y;
            trailPositions[t * 3 + 2] = src.z;
          }
          aa.trail.geometry.attributes.position.needsUpdate = true;

          aa.mesh.position.set(newX, newY, newZ);
          aa.mesh.rotation.x += delta * 0.5;
          aa.mesh.rotation.z += delta * 0.3;
        }

        // Animate planets — real orbital ratios + self-rotation
        // Pause orbital animation during user interaction, resume after 3s idle
        const orbitActive = !interacting || idleTime > 3;
        for (const pa of planetAnims) {
          if (orbitActive) {
            pa.angle += pa.speed * delta;
            pa.mesh.position.set(
              SUN_POS.x + Math.cos(pa.angle) * pa.dist,
              0,
              SUN_POS.z + Math.sin(pa.angle) * pa.dist,
            );
          }
          // Self-rotation (capped to avoid excessive spin in scene)
          pa.mesh.rotation.y += Math.min(pa.selfRotSpeed * delta, delta * 2);
        }

        // Pulse sun corona + animate sun surface
        const coronaOpacity = 0.08 + Math.sin(elapsed * 1.5) * 0.03;
        (sunCorona.material as THREE.MeshBasicMaterial).opacity = coronaOpacity;
        const coronaScale = 1 + Math.sin(elapsed * 0.8) * 0.05;
        sunCorona.scale.setScalar(coronaScale);
        sunCoronaOuter.scale.setScalar(1 + Math.sin(elapsed * 0.5) * 0.08);
        (sunCoronaOuter.material as THREE.MeshBasicMaterial).opacity = 0.03 + Math.sin(elapsed * 1.2) * 0.015;
        // Rotate sun texture for "boiling" surface effect
        sunMesh.rotation.y += delta * 0.02;

        // Fade HUD labels by camera distance
        for (const { sprite, parent } of hudSprites) {
          const parentPos = new THREE.Vector3();
          parent.getWorldPosition(parentPos);
          const camDist = camera.position.distanceTo(parentPos);
          const opacity = Math.max(0.0, Math.min(1.0, 1.0 - (camDist - 3) / 20));
          (sprite.material as THREE.SpriteMaterial).opacity = opacity;
          sprite.visible = opacity > 0.05;
        }

        // Pulse selected object — only asteroids/probes, not earth/planets/sun/DSN
        if (state.selectedId) {
          // Reset previous selected object to its initial scale
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
            || state.selectedId.startsWith("planet-") || state.selectedId.startsWith("dsn-");
          if (!skipPulse) {
            const sel = objectMap.get(state.selectedId);
            if (sel) {
              const s = 1 + Math.sin(elapsed * 5) * 0.1;
              const anim = asteroidAnims.find(a => a.mesh === sel);
              if (anim) {
                sel.scale.copy(anim.initScale).multiplyScalar(s);
              } else {
                sel.scale.setScalar(s);
              }
            }
          }
        }

        // Fly-to camera animation
        if (state.flyLook) {
          controls.target.lerp(state.flyLook, 0.06);
          if (controls.target.distanceTo(state.flyLook) < 0.05) {
            state.flyLook = null;
          }
        }
        if (state.flyTarget) {
          camera.position.lerp(state.flyTarget, 0.04);
          if (camera.position.distanceTo(state.flyTarget) < 0.05) {
            state.flyTarget = null;
          }
        }

        // Auto-rotate when idle — orbit camera around fixed target (no target drift)
        if (!interacting && !state.flyTarget) {
          idleTime += delta;
          if (idleTime > 3) {
            const autoSpeed = Math.min((idleTime - 3) * 0.002, 0.005);
            const camDir = camera.position.clone().sub(controls.target);
            const camDist = camDir.length();
            camDir.normalize();
            camDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), autoSpeed * 0.2);
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
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        internals.current = null;
      };
    }, [width, height, onSelectObject, issData]);

    return <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
  },
);

export default JarvisScene;
