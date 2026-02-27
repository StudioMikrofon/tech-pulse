"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ---------------------------------------------------------------------------
// Planet data
// ---------------------------------------------------------------------------

interface PlanetInfo {
  name: string;
  radius: number; // visual radius
  distance: number; // orbital distance from sun
  color: string;
  speed: number; // orbital speed multiplier
  info: {
    realDistance: string;
    realDiameter: string;
    temperature: string;
  };
  ring?: { inner: number; outer: number; color: string };
}

const PLANETS: PlanetInfo[] = [
  {
    name: "Mercury",
    radius: 0.3,
    distance: 4,
    color: "#A0826D",
    speed: 4.15,
    info: { realDistance: "57.9M km", realDiameter: "4,879 km", temperature: "167°C" },
  },
  {
    name: "Venus",
    radius: 0.5,
    distance: 6,
    color: "#E8CDA0",
    speed: 1.62,
    info: { realDistance: "108.2M km", realDiameter: "12,104 km", temperature: "464°C" },
  },
  {
    name: "Earth",
    radius: 0.5,
    distance: 8,
    color: "#4A90D9",
    speed: 1.0,
    info: { realDistance: "149.6M km", realDiameter: "12,742 km", temperature: "15°C" },
  },
  {
    name: "Mars",
    radius: 0.35,
    distance: 10.5,
    color: "#C1440E",
    speed: 0.53,
    info: { realDistance: "227.9M km", realDiameter: "6,779 km", temperature: "-65°C" },
  },
  {
    name: "Jupiter",
    radius: 1.2,
    distance: 14,
    color: "#C88B3A",
    speed: 0.084,
    info: { realDistance: "778.5M km", realDiameter: "139,820 km", temperature: "-110°C" },
  },
  {
    name: "Saturn",
    radius: 1.0,
    distance: 18,
    color: "#E8D5A3",
    speed: 0.034,
    info: { realDistance: "1.43B km", realDiameter: "116,460 km", temperature: "-140°C" },
    ring: { inner: 1.3, outer: 2.0, color: "#D4C490" },
  },
  {
    name: "Uranus",
    radius: 0.7,
    distance: 22,
    color: "#73C2C6",
    speed: 0.012,
    info: { realDistance: "2.87B km", realDiameter: "50,724 km", temperature: "-195°C" },
    ring: { inner: 1.2, outer: 1.5, color: "#5AA0A4" },
  },
  {
    name: "Neptune",
    radius: 0.65,
    distance: 26,
    color: "#4B70DD",
    speed: 0.006,
    info: { realDistance: "4.5B km", realDiameter: "49,244 km", temperature: "-200°C" },
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SolarSystemWebGL() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    name: string;
    realDistance: string;
    realDiameter: string;
    temperature: string;
    x: number;
    y: number;
  }>({ visible: false, name: "", realDistance: "", realDiameter: "", temperature: "", x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // DPR cap
    const isMobile = window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(dpr);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050710");

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(15, 20, 30);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 80;
    controls.enablePan = false;

    // Ambient light
    scene.add(new THREE.AmbientLight(0x222233, 0.5));

    // Sun
    const sunGeometry = new THREE.SphereGeometry(1.8, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // Sun glow
    const sunGlowGeometry = new THREE.SphereGeometry(2.5, 32, 32);
    const sunGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.15,
    });
    scene.add(new THREE.Mesh(sunGlowGeometry, sunGlowMaterial));

    // Sun point light
    const sunLight = new THREE.PointLight(0xffffff, 2, 100);
    scene.add(sunLight);

    // Starfield
    const starCount = 3000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 150 + Math.random() * 50;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
    scene.add(new THREE.Points(starGeometry, starMaterial));

    // Create planets
    const planetMeshes: THREE.Mesh[] = [];
    const planetAngles: number[] = [];

    PLANETS.forEach((p, i) => {
      // Orbit line
      const orbitPoints: THREE.Vector3[] = [];
      for (let a = 0; a <= 360; a += 2) {
        const rad = (a * Math.PI) / 180;
        orbitPoints.push(new THREE.Vector3(Math.cos(rad) * p.distance, 0, Math.sin(rad) * p.distance));
      }
      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitLine = new THREE.Line(
        orbitGeometry,
        new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.3 })
      );
      scene.add(orbitLine);

      // Planet sphere
      const geo = new THREE.SphereGeometry(p.radius, 24, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(p.color),
        roughness: 0.7,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { planetIndex: i };
      scene.add(mesh);
      planetMeshes.push(mesh);
      planetAngles.push(Math.random() * Math.PI * 2);

      // Ring
      if (p.ring) {
        const ringGeo = new THREE.RingGeometry(
          p.radius * p.ring.inner,
          p.radius * p.ring.outer,
          48
        );
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(p.ring.color),
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2.5;
        mesh.add(ringMesh);
      }
    });

    // Raycaster for clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onPointerDown(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(planetMeshes);

      if (intersects.length > 0) {
        const idx = intersects[0].object.userData.planetIndex;
        const planet = PLANETS[idx];
        setTooltip({
          visible: true,
          name: planet.name,
          realDistance: planet.info.realDistance,
          realDiameter: planet.info.realDiameter,
          temperature: planet.info.temperature,
          x: e.clientX,
          y: e.clientY,
        });
      } else {
        setTooltip((prev) => ({ ...prev, visible: false }));
      }
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    // Animation
    let animId = 0;
    let paused = false;
    const clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      if (paused) return;

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Rotate sun
      sun.rotation.y = elapsed * 0.1;

      // Move planets
      PLANETS.forEach((p, i) => {
        planetAngles[i] += p.speed * delta * 0.3;
        const a = planetAngles[i];
        planetMeshes[i].position.set(
          Math.cos(a) * p.distance,
          0,
          Math.sin(a) * p.distance
        );
        planetMeshes[i].rotation.y += delta * 0.5;
      });

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    // Page Visibility pause
    function handleVisibility() {
      paused = document.hidden;
      if (!paused) clock.getDelta(); // reset delta
    }
    document.addEventListener("visibilitychange", handleVisibility);

    // Resize
    function handleResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-[#050710]">
      <div ref={containerRef} className="w-full h-full" />

      {/* Planet tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 glass-card px-4 py-3 space-y-1 pointer-events-none"
          style={{
            left: Math.min(tooltip.x + 16, window.innerWidth - 240),
            top: Math.min(tooltip.y - 10, window.innerHeight - 140),
          }}
        >
          <h3 className="font-heading text-sm font-bold text-cyan-400">
            {tooltip.name}
          </h3>
          <div className="text-xs space-y-0.5">
            <p className="text-text-secondary">
              Udaljenost: <span className="text-text-primary font-mono">{tooltip.realDistance}</span>
            </p>
            <p className="text-text-secondary">
              Promjer: <span className="text-text-primary font-mono">{tooltip.realDiameter}</span>
            </p>
            <p className="text-text-secondary">
              Temperatura: <span className="text-text-primary font-mono">{tooltip.temperature}</span>
            </p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-mono text-text-secondary/50 pointer-events-none">
        Drag to rotate / Scroll to zoom / Click planet for info
      </div>
    </div>
  );
}
