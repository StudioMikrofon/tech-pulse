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
          internals.current.flyLook = pos.clone();

          // Camera offset based on type
          let dist = 6;
          if (target.type === "planet" || target.type === "sun") dist = 10;
          if (target.type === "probe") dist = 8;
          if (target.type === "dsn") dist = 4;

          // ASTEROID PERSPECTIVE: camera BEHIND asteroid, Earth visible ahead
          if (target.type === "asteroid") {
            dist = 4;
            const dirToEarth = EARTH_POS.clone().sub(pos).normalize();
            // Camera behind asteroid (opposite side from Earth), look at midpoint
            internals.current.flyTarget = pos.clone().sub(dirToEarth.clone().multiplyScalar(dist));
            internals.current.flyTarget.y = Math.max(internals.current.flyTarget.y, pos.y + dist * 0.3);
            // Look at midpoint between asteroid and Earth so Earth fills background
            internals.current.flyLook = pos.clone().add(dirToEarth.clone().multiplyScalar(pos.distanceTo(EARTH_POS) * 0.3));
          } else {
            const dir = camera.position.clone().sub(pos).normalize();
            internals.current.flyTarget = pos.clone().add(dir.multiplyScalar(dist));
            internals.current.flyTarget.y = Math.max(internals.current.flyTarget.y, pos.y + dist * 0.3);
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
      scene.add(new THREE.AmbientLight(0x334466, 1.2));
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
          roughness: 0.7,
          metalness: 0.1,
        }),
      );
      earthCore.position.copy(EARTH_POS);
      scene.add(earthCore);

      // Subtle cyan wireframe overlay for Jarvis feel
      const earthWire = createWireframeSphere(EARTH_RADIUS * 1.005, 0x00d4ff, 0.08, 36);
      earthWire.position.copy(EARTH_POS);
      scene.add(earthWire);
      objectMap.set("earth", earthWire);

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
      const scanMat = new THREE.MeshBasicMaterial({ map: scanTex, transparent: true, opacity: 0.3, depthWrite: false });
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

      // ===== DSN STATIONS on Earth surface =====
      DSN_GROUND_STATIONS.forEach((station) => {
        if (!station.lat || !station.lon) return;
        const pos = latLonToSphere(station.lat, station.lon, EARTH_RADIUS * 1.02, EARTH_POS);
        const dotGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(pos);
        scene.add(dot);
        objectMap.set(station.id, dot);
        const lbl = createLabel(station.name, "#34D399", 1);
        lbl.position.copy(pos).add(new THREE.Vector3(0, 0.3, 0));
        scene.add(lbl);
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

        // Trajectory line
        const trajPts: THREE.Vector3[] = [];
        for (let i = 0; i <= 60; i++) {
          const t = (i / 60 - 0.5) * 2;
          const d = scaledDist + t * scaledDist * 0.6;
          const ta = angle + t * 0.08;
          trajPts.push(new THREE.Vector3(
            EARTH_POS.x + Math.cos(ta) * d,
            EARTH_POS.y + Math.sin(t * Math.PI * 0.2) * 0.3,
            EARTH_POS.z + Math.sin(ta) * d,
          ));
        }
        const trajGeo = new THREE.BufferGeometry().setFromPoints(trajPts);
        const trajLine = new THREE.Line(
          trajGeo,
          new THREE.LineDashedMaterial({
            color: asteroid.hazardous ? 0xef4444 : 0xffcf6e,
            transparent: true, opacity: 0.2, dashSize: 0.3, gapSize: 0.2,
          }),
        );
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

      // ===== SUN — animated pulsing corona =====
      const sunGeo = new THREE.SphereGeometry(3, 24, 24);
      const sunMat = new THREE.MeshStandardMaterial({
        color: 0xffdd44,
        emissive: 0xffaa00,
        emissiveIntensity: 1.5,
        roughness: 1,
        metalness: 0,
      });
      const sunMesh = new THREE.Mesh(sunGeo, sunMat);
      sunMesh.position.copy(SUN_POS);
      scene.add(sunMesh);
      objectMap.set("sun", sunMesh);
      // Sun corona (pulsing)
      const sunCorona = new THREE.Mesh(
        new THREE.SphereGeometry(5, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.08 }),
      );
      sunCorona.position.copy(SUN_POS);
      scene.add(sunCorona);
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

        // Jupiter: canvas-drawn band texture
        let pMat: THREE.MeshStandardMaterial;
        if (p.texture === "jupiter") {
          const jupCanvas = document.createElement("canvas");
          jupCanvas.width = 256;
          jupCanvas.height = 128;
          const jCtx = jupCanvas.getContext("2d")!;
          const bandColors = ["#c88b3a", "#a67228", "#d4a050", "#8a5e1e", "#c88b3a", "#b8802e", "#d4a050", "#a67228"];
          const bandH = jupCanvas.height / bandColors.length;
          bandColors.forEach((c, i) => {
            jCtx.fillStyle = c;
            jCtx.fillRect(0, i * bandH, jupCanvas.width, bandH + 1);
          });
          const jupTex = new THREE.CanvasTexture(jupCanvas);
          jupTex.needsUpdate = true;
          pMat = new THREE.MeshStandardMaterial({
            map: jupTex,
            roughness: 0.5,
            metalness: 0.1,
            emissive: new THREE.Color(p.color),
            emissiveIntensity: p.gasGiant ? 0.25 : 0.15,
          });
        } else {
          pMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(p.color),
            roughness: 0.5,
            metalness: 0.15,
            emissive: new THREE.Color(p.color),
            emissiveIntensity: p.gasGiant ? 0.25 : 0.15,
          });
        }

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

        // Wireframe overlay for Jarvis feel
        const wireOverlay = new THREE.Mesh(
          new THREE.SphereGeometry(p.radius * 1.05, 32, 32),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color), wireframe: true, transparent: true, opacity: 0.2 }),
        );
        pMesh.add(wireOverlay);

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
                data["Antena"] = station.meta.primaryDish as string;
                data["Misije"] = station.meta.activeMissions as string;
              }
            } else if (id === "iss") {
              type = "ISS";
              data["Visina"] = `${issData.altitude} km`;
              data["Brzina"] = `${issData.speed.toLocaleString()} km/h`;
              data["Pozicija"] = `${issData.lat.toFixed(2)}°, ${issData.lon.toFixed(2)}°`;
            } else if (id.startsWith("planet-")) {
              type = "Planet";
              const pName = id.replace("planet-", "");
              const pData = PLANET_DATA.find((p) => p.name.toLowerCase() === pName);
              if (pData) {
                data["Boja"] = pData.color;
                data["Orbit radius"] = `${pData.dist} AU (scaled)`;
              }
            } else if (id === "sun") {
              type = "Zvijezda";
              data["Tip"] = "G2V Main Sequence";
              data["Temperatura"] = "5,778 K";
              data["Masa"] = "1.989 × 10³⁰ kg";
            } else {
              const neo = NEO_DATASET.entries.find((a) => a.id === id);
              if (neo) {
                type = "Asteroid";
                data["Udaljenost"] = `${neo.distanceLD} LD (${neo.distanceKm.toLocaleString()} km)`;
                data["Promjer"] = `${neo.diameterM}m`;
                data["Brzina"] = `${neo.speedKmH.toLocaleString()} km/h`;
                data["Opasan"] = neo.hazardous ? "DA" : "NE";
                data["Najbliži prolaz"] = new Date(neo.closestApproach).toLocaleString();
              }
              const probe = PROBES_DATASET.entries.find((p) => p.id === id);
              if (probe) {
                type = "Sonda";
                data["Udaljenost"] = probe.distanceFromSun;
                data["Brzina"] = probe.speed;
                data["Misija"] = probe.mission;
                data["Lansiranje"] = String(probe.launchYear);
                data["Status"] = probe.status;
              }
            }

            const displayName = id.startsWith("planet-")
              ? id.replace("planet-", "").charAt(0).toUpperCase() + id.replace("planet-", "").slice(1)
              : (DSN_GROUND_STATIONS.find(s => s.id === id)?.name
                || NEO_DATASET.entries.find(a => a.id === id)?.name
                || PROBES_DATASET.entries.find(p => p.id === id)?.name
                || id.toUpperCase());

            onSelectObject?.({ type, name: displayName, data });

            // Fly to
            const pos = new THREE.Vector3();
            const obj = objectMap.get(id)!;
            obj.getWorldPosition(pos);
            state.flyLook = pos.clone();
            let dist = 5;
            if (type === "Planet" || type === "Zvijezda") dist = 8;
            if (type === "Sonda") dist = 6;

            // Asteroid perspective: camera behind, Earth visible ahead
            if (type === "Asteroid") {
              const dirToEarth = EARTH_POS.clone().sub(pos).normalize();
              state.flyTarget = pos.clone().sub(dirToEarth.clone().multiplyScalar(dist));
              state.flyTarget.y = Math.max(state.flyTarget.y, pos.y + dist * 0.3);
              state.flyLook = pos.clone().add(dirToEarth.clone().multiplyScalar(pos.distanceTo(EARTH_POS) * 0.3));
            } else {
              const dir = camera.position.clone().sub(pos).normalize();
              state.flyTarget = pos.clone().add(dir.multiplyScalar(dist));
              state.flyTarget.y = Math.max(state.flyTarget.y, pos.y + dist * 0.25);
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
        earthWire.rotation.y += delta * 0.05;
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

        // Pulse sun corona
        const coronaOpacity = 0.07 + Math.sin(elapsed * 1.5) * 0.025;
        (sunCorona.material as THREE.MeshBasicMaterial).opacity = coronaOpacity;
        const coronaScale = 1 + Math.sin(elapsed * 0.8) * 0.05;
        sunCorona.scale.setScalar(coronaScale);

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
