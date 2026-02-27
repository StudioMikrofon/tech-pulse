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
const PLANET_DATA = [
  { name: "Mercury", radius: 0.12, dist: 12, color: "#A0826D", speed: 4.15 },
  { name: "Venus", radius: 0.22, dist: 16, color: "#E8CDA0", speed: 1.62 },
  { name: "Mars", radius: 0.18, dist: 22, color: "#C1440E", speed: 0.53 },
  { name: "Jupiter", radius: 0.7, dist: 32, color: "#C88B3A", speed: 0.084 },
  { name: "Saturn", radius: 0.55, dist: 42, color: "#E8D5A3", speed: 0.034, ring: true },
  { name: "Uranus", radius: 0.35, dist: 52, color: "#73C2C6", speed: 0.012 },
  { name: "Neptune", radius: 0.33, dist: 60, color: "#4B70DD", speed: 0.006 },
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
    const internals = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      animId: number;
      clock: THREE.Clock;
      paused: boolean;
      // Targets for fly-to
      flyTarget: THREE.Vector3 | null;
      flyLook: THREE.Vector3 | null;
      flyDist: number;
      // Object maps for selection
      objectMap: Map<string, THREE.Object3D>;
      selectedId: string | null;
      // ISS mesh for live update
      issMesh: THREE.Mesh;
      issOrbitGroup: THREE.Group;
      // Asteroid meshes for animation
      asteroidAnims: { mesh: THREE.Mesh; speed: number; angle: number; dist: number; approachAngle: number }[];
      // Planet meshes
      planetAnims: { mesh: THREE.Mesh; angle: number; speed: number; dist: number }[];
    } | null>(null);

    // Expose focusOn via ref
    useImperativeHandle(ref, () => ({
      focusOn: (target: FocusTarget) => {
        if (!internals.current) return;
        const { objectMap, controls, camera } = internals.current;

        if (target.type === "reset" || target.type === "earth") {
          internals.current.flyLook = EARTH_POS.clone();
          internals.current.flyTarget = new THREE.Vector3(5, 4, 6);
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
          if (target.type === "asteroid") dist = 5;
          if (target.type === "dsn") dist = 4;
          internals.current.flyDist = dist;
          const dir = camera.position.clone().sub(pos).normalize();
          internals.current.flyTarget = pos.clone().add(dir.multiplyScalar(dist));
          internals.current.flyTarget.y = Math.max(internals.current.flyTarget.y, pos.y + dist * 0.3);
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

      // Camera
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 500);
      camera.position.set(5, 4, 6);

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 1;
      controls.maxDistance = 150;
      controls.zoomSpeed = 2.5;
      controls.rotateSpeed = 0.8;
      controls.target.copy(EARTH_POS);

      // Lighting
      scene.add(new THREE.AmbientLight(0x334466, 0.8));
      const sunLight = new THREE.PointLight(0xffffff, 2, 300);
      sunLight.position.copy(SUN_POS);
      scene.add(sunLight);

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

      // ===== EARTH =====
      // Solid core (dark)
      const earthCore = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS * 0.98, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x050710 }),
      );
      earthCore.position.copy(EARTH_POS);
      scene.add(earthCore);

      // Wireframe sphere
      const earthWire = createWireframeSphere(EARTH_RADIUS, 0x00d4ff, 0.2, 36);
      earthWire.position.copy(EARTH_POS);
      scene.add(earthWire);
      objectMap.set("earth", earthWire);

      // Atmosphere glow
      const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.08, 32, 32);
      const atmosMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.06 });
      const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
      atmosMesh.position.copy(EARTH_POS);
      scene.add(atmosMesh);

      // Earth label
      const earthLabel = createLabel("EARTH", "#00D4FF", 2);
      earthLabel.position.set(EARTH_POS.x, EARTH_POS.y + EARTH_RADIUS + 0.8, EARTH_POS.z);
      scene.add(earthLabel);

      // LD distance rings around Earth
      [1, 5, 10, 20].forEach((ld) => {
        const ring = createDashedRing(ld * LD_SCALE, 0x00d4ff, 0.06);
        ring.position.copy(EARTH_POS);
        scene.add(ring);
        // LD label
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
        // Label
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

      // ISS orbit ring (inclined)
      const issOrbitGroup = new THREE.Group();
      const issOrbitRing = createDashedRing(EARTH_RADIUS + 0.5, 0x00d4ff, 0.15);
      issOrbitGroup.add(issOrbitRing);
      issOrbitGroup.rotation.x = (ISS_INCLINATION * Math.PI) / 180;
      issOrbitGroup.position.copy(EARTH_POS);
      scene.add(issOrbitGroup);

      // ISS label
      const issLabel = createLabel("ISS", "#00D4FF", 1.2);
      issLabel.position.y = 0.3;
      issMesh.add(issLabel);

      // ===== ASTEROIDS (near Earth zone) =====
      const asteroidAnims: typeof internals.current extends null ? never : NonNullable<typeof internals.current>["asteroidAnims"] = [];
      NEO_DATASET.entries.forEach((asteroid) => {
        const scaledDist = asteroid.distanceLD * LD_SCALE;
        const angle = (asteroid.approachAngle * Math.PI) / 180;
        const size = Math.max(0.08, Math.min(asteroid.diameterM / 300, 0.35));

        const aGeo = new THREE.IcosahedronGeometry(size, 0);
        const aMat = new THREE.MeshBasicMaterial({
          color: asteroid.hazardous ? 0xef4444 : 0xffcf6e,
          wireframe: true,
          transparent: true,
          opacity: 0.8,
        });
        const aMesh = new THREE.Mesh(aGeo, aMat);
        aMesh.position.set(
          EARTH_POS.x + Math.cos(angle) * scaledDist,
          EARTH_POS.y + Math.sin(angle * 0.3) * 0.5,
          EARTH_POS.z + Math.sin(angle) * scaledDist,
        );
        scene.add(aMesh);
        objectMap.set(asteroid.id, aMesh);

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

        // Label
        const lbl = createLabel(asteroid.name, asteroid.hazardous ? "#EF4444" : "#FFCF6E", 1.2);
        lbl.position.y = size + 0.4;
        aMesh.add(lbl);

        asteroidAnims.push({
          mesh: aMesh, speed: asteroid.speedKmH * 0.000001,
          angle, dist: scaledDist, approachAngle: asteroid.approachAngle,
        });
      });

      // ===== SUN =====
      const sunGeo = new THREE.SphereGeometry(3, 24, 24);
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
      const sunMesh = new THREE.Mesh(sunGeo, sunMat);
      sunMesh.position.copy(SUN_POS);
      scene.add(sunMesh);
      objectMap.set("sun", sunMesh);
      // Sun glow
      const sunGlow = new THREE.Mesh(
        new THREE.SphereGeometry(5, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.08 }),
      );
      sunGlow.position.copy(SUN_POS);
      scene.add(sunGlow);
      const sunLabel = createLabel("SUN", "#FFDD44", 3);
      sunLabel.position.set(SUN_POS.x, SUN_POS.y + 5, SUN_POS.z);
      scene.add(sunLabel);

      // ===== PLANETS (orbiting Sun) =====
      const planetAnims: { mesh: THREE.Mesh; angle: number; speed: number; dist: number }[] = [];
      PLANET_DATA.forEach((p) => {
        // Orbit ring around Sun
        const orbitRing = createDashedRing(p.dist, 0x00d4ff, 0.06);
        orbitRing.position.copy(SUN_POS);
        scene.add(orbitRing);

        // Planet wireframe sphere
        const pGeo = new THREE.SphereGeometry(p.radius, 16, 16);
        const pMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(p.color), wireframe: true, transparent: true, opacity: 0.7,
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        const startAngle = Math.random() * Math.PI * 2;
        pMesh.position.set(
          SUN_POS.x + Math.cos(startAngle) * p.dist,
          0,
          SUN_POS.z + Math.sin(startAngle) * p.dist,
        );
        scene.add(pMesh);
        objectMap.set(`planet-${p.name.toLowerCase()}`, pMesh);

        // Solid core
        const coreGeo = new THREE.SphereGeometry(p.radius * 0.85, 16, 16);
        const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color), transparent: true, opacity: 0.15 });
        pMesh.add(new THREE.Mesh(coreGeo, coreMat));

        // Ring for Saturn
        if (p.ring) {
          const ringGeo = new THREE.RingGeometry(p.radius * 1.3, p.radius * 2.2, 48);
          const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(p.color), transparent: true, opacity: 0.3, side: THREE.DoubleSide,
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.rotation.x = Math.PI / 2.5;
          pMesh.add(ringMesh);
        }

        // Label
        const lbl = createLabel(p.name.toUpperCase(), p.color, 1.5);
        lbl.position.y = p.radius + 0.5;
        pMesh.add(lbl);

        planetAnims.push({ mesh: pMesh, angle: startAngle, speed: p.speed, dist: p.dist });
      });

      // ===== PROBES (in deep space, scaled positions) =====
      PROBES_DATASET.entries.forEach((probe) => {
        const scaledDist = probe.distanceAU > 10
          ? 60 + Math.log10(probe.distanceAU / 10) * 30
          : SUN_POS.length() + (probe.distanceAU / 5.5) * 70; // relative to Sun-Earth distance
        const angle = (probe.positionAngle * Math.PI) / 180;
        const px = SUN_POS.x + Math.cos(angle) * scaledDist;
        const pz = SUN_POS.z + Math.sin(angle) * scaledDist;

        const probeGeo = new THREE.OctahedronGeometry(0.15, 0);
        const probeMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, wireframe: true });
        const probeMesh = new THREE.Mesh(probeGeo, probeMat);
        probeMesh.position.set(px, 0.2, pz);
        scene.add(probeMesh);
        objectMap.set(probe.id, probeMesh);

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

        // Label
        const lbl = createLabel(probe.name, "#00D4FF", 1.5);
        lbl.position.y = 0.6;
        probeMesh.add(lbl);
      });

      // ===== GRID PLANE (blueprint feel) =====
      const gridHelper = new THREE.GridHelper(200, 100, 0x00d4ff, 0x00d4ff);
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.03;
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
        issMesh, issOrbitGroup,
        asteroidAnims, planetAnims,
      };
      internals.current = state;

      // Raycaster for direct clicks on 3D objects
      const raycaster = new THREE.Raycaster();
      const mouseVec = new THREE.Vector2();

      function onPointerDown(e: PointerEvent) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseVec, camera);

        const clickables = Array.from(objectMap.values()).filter((o) => o instanceof THREE.Mesh) as THREE.Mesh[];
        const intersects = raycaster.intersectObjects(clickables, false);
        if (intersects.length > 0) {
          const hit = intersects[0].object;
          // Find the id
          for (const [id, obj] of objectMap.entries()) {
            if (obj === hit) {
              // Determine type and build HUD data
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
                // Asteroid or probe
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

              onSelectObject?.({ type, name: id.startsWith("planet-") ? id.replace("planet-", "").charAt(0).toUpperCase() + id.replace("planet-", "").slice(1) : objectMap.get(id) ? (DSN_GROUND_STATIONS.find(s => s.id === id)?.name || NEO_DATASET.entries.find(a => a.id === id)?.name || PROBES_DATASET.entries.find(p => p.id === id)?.name || id.toUpperCase()) : id, data });

              // Fly to
              const pos = new THREE.Vector3();
              hit.getWorldPosition(pos);
              state.flyLook = pos.clone();
              let dist = 5;
              if (type === "Planet" || type === "Zvijezda") dist = 8;
              if (type === "Sonda") dist = 6;
              state.flyDist = dist;
              const dir = camera.position.clone().sub(pos).normalize();
              state.flyTarget = pos.clone().add(dir.multiplyScalar(dist));
              state.flyTarget.y = Math.max(state.flyTarget.y, pos.y + dist * 0.25);
              state.selectedId = id;
              break;
            }
          }
          idleTime = 0;
        }
      }
      renderer.domElement.addEventListener("pointerdown", onPointerDown);

      // Interaction detection for auto-rotate pause
      let interacting = false;
      function onInteractStart() { interacting = true; idleTime = 0; }
      function onInteractEnd() { interacting = false; }
      renderer.domElement.addEventListener("pointerdown", onInteractStart);
      renderer.domElement.addEventListener("pointerup", onInteractEnd);
      renderer.domElement.addEventListener("wheel", () => { idleTime = 0; });

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
        // Apply inclination rotation
        const incRad = (ISS_INCLINATION * Math.PI) / 180;
        issMesh.position.set(
          EARTH_POS.x + issX,
          EARTH_POS.y + issZ * Math.sin(incRad),
          EARTH_POS.z + issZ * Math.cos(incRad),
        );
        issMesh.rotation.y += delta * 2;

        // Rotate Earth wireframe slowly
        earthWire.rotation.y += delta * 0.05;
        earthCore.rotation.y += delta * 0.05;

        // Animate asteroids — slow movement along approach angle
        for (const aa of asteroidAnims) {
          aa.angle += aa.speed * delta;
          const d = aa.dist + Math.sin(elapsed * 0.1 + aa.approachAngle) * 0.3;
          const approachRad = (aa.approachAngle * Math.PI) / 180;
          aa.mesh.position.set(
            EARTH_POS.x + Math.cos(approachRad + aa.angle * 0.01) * d,
            EARTH_POS.y + Math.sin(elapsed * 0.3 + aa.approachAngle) * 0.2,
            EARTH_POS.z + Math.sin(approachRad + aa.angle * 0.01) * d,
          );
          aa.mesh.rotation.x += delta * 0.5;
          aa.mesh.rotation.z += delta * 0.3;
        }

        // Animate planets
        for (const pa of planetAnims) {
          pa.angle += pa.speed * delta * 0.15;
          pa.mesh.position.set(
            SUN_POS.x + Math.cos(pa.angle) * pa.dist,
            0,
            SUN_POS.z + Math.sin(pa.angle) * pa.dist,
          );
          pa.mesh.rotation.y += delta * 0.3;
        }

        // Pulse selected object
        if (state.selectedId) {
          const sel = objectMap.get(state.selectedId);
          if (sel && sel instanceof THREE.Mesh) {
            const s = 1 + Math.sin(elapsed * 5) * 0.15;
            sel.scale.setScalar(s);
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

        // Auto-rotate when idle
        if (!interacting && !state.flyTarget) {
          idleTime += delta;
          if (idleTime > 3) {
            const autoSpeed = Math.min((idleTime - 3) * 0.003, 0.008);
            controls.target.x += Math.sin(elapsed * 0.02) * autoSpeed;
            // Very subtle orbit around target
            const camAngle = elapsed * 0.015;
            const camDist = camera.position.distanceTo(controls.target);
            const camDir = camera.position.clone().sub(controls.target).normalize();
            camDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), autoSpeed * 0.3);
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
