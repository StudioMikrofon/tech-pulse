"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PROBES_DATASET } from "@/lib/space-tracker-data";
import type { ProbeData } from "@/lib/space-tracker-data";

// ---------------------------------------------------------------------------
// Planet data for solar system view
// ---------------------------------------------------------------------------

interface PlanetDef {
  name: string;
  radius: number;
  distance: number; // AU scaled
  color: string;
  speed: number;
  emissive?: string;
  ring?: { inner: number; outer: number; color: string };
}

const PLANETS: PlanetDef[] = [
  { name: "Mercury", radius: 0.15, distance: 2.5, color: "#A0826D", speed: 4.15 },
  { name: "Venus", radius: 0.3, distance: 4, color: "#E8CDA0", speed: 1.62 },
  { name: "Earth", radius: 0.32, distance: 5.5, color: "#4A90D9", speed: 1.0 },
  { name: "Mars", radius: 0.2, distance: 7.5, color: "#C1440E", speed: 0.53 },
  { name: "Jupiter", radius: 0.9, distance: 11, color: "#C88B3A", speed: 0.084 },
  { name: "Saturn", radius: 0.75, distance: 15, color: "#E8D5A3", speed: 0.034, ring: { inner: 1.3, outer: 2.2, color: "#D4C490" } },
  { name: "Uranus", radius: 0.5, distance: 19, color: "#73C2C6", speed: 0.012, ring: { inner: 1.2, outer: 1.5, color: "#5AA0A4" } },
  { name: "Neptune", radius: 0.48, distance: 23, color: "#4B70DD", speed: 0.006 },
];

interface SolarSystemTrackerProps {
  width: number;
  height: number;
  onSelectObject?: (obj: { type: string; name: string; data: Record<string, string> } | null) => void;
}

export default function SolarSystemTracker({ width, height, onSelectObject }: SolarSystemTrackerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    planetMeshes: THREE.Mesh[];
    planetAngles: number[];
    probeMeshes: THREE.Mesh[];
    probeTrajectoryLines: THREE.Line[];
    sun: THREE.Mesh;
    clock: THREE.Clock;
    animId: number;
    selectedMesh: THREE.Mesh | null;
    flyTarget: THREE.Vector3 | null;
  } | null>(null);
  const [selectedObj, setSelectedObj] = useState<string | null>(null);

  const handleSelect = useCallback((type: string, name: string, data: Record<string, string>) => {
    setSelectedObj(name);
    onSelectObject?.({ type, name, data });
  }, [onSelectObject]);

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
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
    camera.position.set(12, 18, 25);

    // Controls — fast zoom
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 3;
    controls.maxDistance = 100;
    controls.enablePan = true;
    controls.zoomSpeed = 2.0; // 2x faster zoom
    controls.rotateSpeed = 0.8;

    // Lighting
    scene.add(new THREE.AmbientLight(0x223344, 0.6));
    const sunLight = new THREE.PointLight(0xffffff, 2.5, 200);
    scene.add(sunLight);

    // Starfield
    const starCount = 2000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 120 + Math.random() * 40;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, sizeAttenuation: true })));

    // Sun
    const sunGeo = new THREE.SphereGeometry(1.2, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);
    // Sun glow
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.12 });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(2.0, 32, 32), glowMat));

    // Planets
    const planetMeshes: THREE.Mesh[] = [];
    const planetAngles: number[] = [];

    PLANETS.forEach((p, i) => {
      // Orbit ring — dashed
      const orbitPts: THREE.Vector3[] = [];
      for (let a = 0; a <= 360; a += 2) {
        const rad = (a * Math.PI) / 180;
        orbitPts.push(new THREE.Vector3(Math.cos(rad) * p.distance, 0, Math.sin(rad) * p.distance));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
      const orbitLine = new THREE.Line(
        orbitGeo,
        new THREE.LineDashedMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.15, dashSize: 0.5, gapSize: 0.3 })
      );
      orbitLine.computeLineDistances();
      scene.add(orbitLine);

      // Planet sphere
      const geo = new THREE.SphereGeometry(p.radius, isMobile ? 16 : 24, isMobile ? 16 : 24);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(p.color),
        roughness: 0.6,
        metalness: 0.1,
        emissive: new THREE.Color(p.color),
        emissiveIntensity: 0.08,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { type: "planet", index: i, name: p.name };
      scene.add(mesh);
      planetMeshes.push(mesh);
      planetAngles.push(Math.random() * Math.PI * 2);

      // Ring
      if (p.ring) {
        const ringGeo = new THREE.RingGeometry(p.radius * p.ring.inner, p.radius * p.ring.outer, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(p.ring.color),
          transparent: true, opacity: 0.45, side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2.5;
        mesh.add(ringMesh);
      }

      // Planet label (sprite)
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 256;
      labelCanvas.height = 64;
      const lctx = labelCanvas.getContext("2d")!;
      lctx.font = "bold 28px monospace";
      lctx.fillStyle = "#00D4FF";
      lctx.textAlign = "center";
      lctx.fillText(p.name.toUpperCase(), 128, 40);
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, opacity: 0.7 });
      const sprite = new THREE.Sprite(labelMat);
      sprite.scale.set(2.5, 0.65, 1);
      sprite.position.y = p.radius + 0.6;
      mesh.add(sprite);
    });

    // Probes
    const probeMeshes: THREE.Mesh[] = [];
    const probeTrajectoryLines: THREE.Line[] = [];

    PROBES_DATASET.entries.forEach((probe) => {
      // Scale probe position — probes far from Sun use log scale
      const scaledDist = probe.distanceAU > 10
        ? 23 + Math.log10(probe.distanceAU / 10) * 15
        : (probe.distanceAU / 10) * 23;
      const angle = (probe.positionAngle * Math.PI) / 180;
      const px = Math.cos(angle) * scaledDist;
      const pz = Math.sin(angle) * scaledDist;

      // Probe marker — diamond shape
      const probeGeo = new THREE.OctahedronGeometry(0.2, 0);
      const probeMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.9,
      });
      const probeMesh = new THREE.Mesh(probeGeo, probeMat);
      probeMesh.position.set(px, 0.3, pz);
      probeMesh.userData = { type: "probe", id: probe.id, name: probe.name, probe };
      scene.add(probeMesh);
      probeMeshes.push(probeMesh);

      // Trajectory line from Sun area to probe
      const trajPts: THREE.Vector3[] = [];
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const dist = t * scaledDist;
        // slight curve
        const curveAngle = angle + Math.sin(t * Math.PI) * 0.15;
        trajPts.push(new THREE.Vector3(
          Math.cos(curveAngle) * dist,
          Math.sin(t * Math.PI) * 0.3,
          Math.sin(curveAngle) * dist,
        ));
      }
      const trajGeo = new THREE.BufferGeometry().setFromPoints(trajPts);
      const trajLine = new THREE.Line(
        trajGeo,
        new THREE.LineDashedMaterial({
          color: 0x00d4ff,
          transparent: true,
          opacity: 0.0, // hidden by default
          dashSize: 0.4,
          gapSize: 0.2,
        })
      );
      trajLine.computeLineDistances();
      trajLine.userData = { probeId: probe.id };
      scene.add(trajLine);
      probeTrajectoryLines.push(trajLine);

      // Probe label sprite
      const lc = document.createElement("canvas");
      lc.width = 256;
      lc.height = 64;
      const lctx = lc.getContext("2d")!;
      lctx.font = "bold 22px monospace";
      lctx.fillStyle = "#00D4FF";
      lctx.textAlign = "center";
      lctx.fillText(probe.name, 128, 40);
      const tex = new THREE.CanvasTexture(lc);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.6 });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(2, 0.5, 1);
      sprite.position.y = 0.7;
      probeMesh.add(sprite);
    });

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let flyTarget: THREE.Vector3 | null = null;
    let selectedMeshRef: THREE.Mesh | null = null;

    function onPointerDown(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const allMeshes = [...planetMeshes, ...probeMeshes];
      const intersects = raycaster.intersectObjects(allMeshes);

      if (intersects.length > 0) {
        const obj = intersects[0].object as THREE.Mesh;
        const ud = obj.userData;

        // Hide all trajectory lines
        probeTrajectoryLines.forEach((l) => {
          (l.material as THREE.LineDashedMaterial).opacity = 0;
        });

        if (ud.type === "planet") {
          const planet = PLANETS[ud.index];
          handleSelect("planet", planet.name, {
            "Udaljenost": `${planet.distance} AU (scaled)`,
            "Boja": planet.color,
          });
          flyTarget = obj.position.clone();
          selectedMeshRef = obj;
        } else if (ud.type === "probe") {
          const probe = ud.probe as ProbeData;
          handleSelect("probe", probe.name, {
            "Udaljenost": probe.distanceFromSun,
            "Brzina": probe.speed,
            "Misija": probe.mission,
            "Lansiranje": String(probe.launchYear),
            "Status": probe.status,
            "Zadnji signal": new Date(probe.lastSignal).toLocaleTimeString(),
          });
          flyTarget = obj.position.clone();
          selectedMeshRef = obj;
          // Show this probe's trajectory
          const trajLine = probeTrajectoryLines.find(l => l.userData.probeId === probe.id);
          if (trajLine) {
            (trajLine.material as THREE.LineDashedMaterial).opacity = 0.4;
          }
        }
      } else {
        handleSelect("", "", {});
        flyTarget = null;
        selectedMeshRef = null;
        probeTrajectoryLines.forEach((l) => {
          (l.material as THREE.LineDashedMaterial).opacity = 0;
        });
        onSelectObject?.(null);
      }
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    // Animation
    const clock = new THREE.Clock();
    let animId = 0;
    let paused = false;
    let pulsePhase = 0;

    function animate() {
      animId = requestAnimationFrame(animate);
      if (paused) return;

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      pulsePhase = elapsed;

      // Rotate sun
      sun.rotation.y = elapsed * 0.1;

      // Move planets
      PLANETS.forEach((p, i) => {
        planetAngles[i] += p.speed * delta * 0.3;
        const a = planetAngles[i];
        planetMeshes[i].position.set(Math.cos(a) * p.distance, 0, Math.sin(a) * p.distance);
        planetMeshes[i].rotation.y += delta * 0.5;
      });

      // Rotate probes slightly
      probeMeshes.forEach((pm) => {
        pm.rotation.y += delta * 1.5;
      });

      // Pulse selected object
      if (selectedMeshRef) {
        const scale = 1 + Math.sin(pulsePhase * 4) * 0.15;
        selectedMeshRef.scale.setScalar(scale);
      }

      // Smooth fly-to
      if (flyTarget) {
        const targetLook = flyTarget.clone();
        const currentTarget = controls.target.clone();
        controls.target.lerp(targetLook, 0.06);

        // Move camera closer to target
        const dir = camera.position.clone().sub(targetLook).normalize();
        const idealDist = 8;
        const idealPos = targetLook.clone().add(dir.multiplyScalar(idealDist));
        idealPos.y = Math.max(idealPos.y, 3);
        camera.position.lerp(idealPos, 0.03);

        if (currentTarget.distanceTo(targetLook) < 0.1) {
          flyTarget = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    // Visibility
    function handleVisibility() {
      paused = document.hidden;
      if (!paused) clock.getDelta();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    sceneRef.current = {
      renderer, scene, camera, controls, planetMeshes, planetAngles,
      probeMeshes, probeTrajectoryLines, sun, clock, animId,
      selectedMesh: null, flyTarget: null,
    };

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [width, height, handleSelect, onSelectObject]);

  return <div ref={containerRef} className="w-full h-full" />;
}
