"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { NEO_DATASET } from "@/lib/space-tracker-data";
import type { NEOAsteroid } from "@/lib/space-tracker-data";

interface NEOTrackerProps {
  width: number;
  height: number;
  onSelectObject?: (obj: { type: string; name: string; data: Record<string, string> } | null) => void;
}

export default function NEOTracker({ width, height, onSelectObject }: NEOTrackerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((asteroid: NEOAsteroid | null) => {
    if (!asteroid) {
      onSelectObject?.(null);
      return;
    }
    onSelectObject?.({
      type: "asteroid",
      name: asteroid.name,
      data: {
        "Udaljenost": `${asteroid.distanceLD} LD (${asteroid.distanceKm.toLocaleString()} km)`,
        "Promjer": `${asteroid.diameterM}m`,
        "Brzina": `${asteroid.speedKmH.toLocaleString()} km/h`,
        "Opasan": asteroid.hazardous ? "DA" : "NE",
        "Najbliži prolaz": new Date(asteroid.closestApproach).toLocaleString(),
        "Energija udara": `${(asteroid.diameterM * asteroid.speedKmH * 0.001).toFixed(1)} kt`,
        "Approach Vector": `${asteroid.approachAngle}°`,
      },
    });
  }, [onSelectObject]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2);

    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    camera.position.set(0, 12, 20);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 5;
    controls.maxDistance = 60;
    controls.zoomSpeed = 2.0;

    // Lighting
    scene.add(new THREE.AmbientLight(0x334466, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 10, 5);
    scene.add(dirLight);

    // Starfield
    const starCount = 1500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 80 + Math.random() * 30;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, sizeAttenuation: true })));

    // Earth — center reference
    const earthGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x4a90d9,
      roughness: 0.5,
      metalness: 0.2,
      emissive: 0x1a3a6a,
      emissiveIntensity: 0.3,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Earth wireframe overlay
    const wireGeo = new THREE.SphereGeometry(1.52, 24, 24);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      wireframe: true,
      transparent: true,
      opacity: 0.1,
    });
    scene.add(new THREE.Mesh(wireGeo, wireMat));

    // Earth label
    const earthLabel = document.createElement("canvas");
    earthLabel.width = 128;
    earthLabel.height = 48;
    const ectx = earthLabel.getContext("2d")!;
    ectx.font = "bold 24px monospace";
    ectx.fillStyle = "#4A90D9";
    ectx.textAlign = "center";
    ectx.fillText("EARTH", 64, 32);
    const eTex = new THREE.CanvasTexture(earthLabel);
    const eSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: eTex, transparent: true, opacity: 0.7 }));
    eSprite.scale.set(2, 0.75, 1);
    eSprite.position.y = 2.5;
    earth.add(eSprite);

    // Moon orbit ring
    const moonDist = 3;
    const moonOrbitPts: THREE.Vector3[] = [];
    for (let a = 0; a <= 360; a += 3) {
      const rad = (a * Math.PI) / 180;
      moonOrbitPts.push(new THREE.Vector3(Math.cos(rad) * moonDist, 0, Math.sin(rad) * moonDist));
    }
    const moonOrbitGeo = new THREE.BufferGeometry().setFromPoints(moonOrbitPts);
    const moonOrbitLine = new THREE.Line(
      moonOrbitGeo,
      new THREE.LineDashedMaterial({ color: 0xffcf6e, transparent: true, opacity: 0.2, dashSize: 0.3, gapSize: 0.2 })
    );
    moonOrbitLine.computeLineDistances();
    scene.add(moonOrbitLine);

    // LD distance rings (1 LD, 5 LD, 10 LD)
    [1, 5, 10, 20].forEach((ld) => {
      const ringRadius = ld * 1.5; // scale: 1 LD = 1.5 units
      const ringPts: THREE.Vector3[] = [];
      for (let a = 0; a <= 360; a += 3) {
        const rad = (a * Math.PI) / 180;
        ringPts.push(new THREE.Vector3(Math.cos(rad) * ringRadius, 0, Math.sin(rad) * ringRadius));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      const ringLine = new THREE.Line(
        ringGeo,
        new THREE.LineDashedMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.08, dashSize: 0.5, gapSize: 0.3 })
      );
      ringLine.computeLineDistances();
      scene.add(ringLine);

      // LD label
      const lc = document.createElement("canvas");
      lc.width = 128;
      lc.height = 48;
      const lctx = lc.getContext("2d")!;
      lctx.font = "18px monospace";
      lctx.fillStyle = "rgba(0, 212, 255, 0.4)";
      lctx.textAlign = "center";
      lctx.fillText(`${ld} LD`, 64, 30);
      const tex = new THREE.CanvasTexture(lc);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sprite.scale.set(2, 0.75, 1);
      sprite.position.set(ringRadius + 0.5, 0.3, 0);
      scene.add(sprite);
    });

    // Asteroids
    const asteroidMeshes: THREE.Mesh[] = [];
    const trajectoryLines: THREE.Line[] = [];

    NEO_DATASET.entries.forEach((asteroid) => {
      const scaledDist = asteroid.distanceLD * 1.5;
      const angle = (asteroid.approachAngle * Math.PI) / 180;
      const ax = Math.cos(angle) * scaledDist;
      const az = Math.sin(angle) * scaledDist;
      const ay = Math.sin(angle * 0.5) * 0.5;

      // Asteroid mesh — irregular shape
      const size = Math.max(0.15, Math.min(asteroid.diameterM / 200, 0.5));
      const aGeo = new THREE.IcosahedronGeometry(size, 0);
      const aMat = new THREE.MeshStandardMaterial({
        color: asteroid.hazardous ? 0xef4444 : 0xffcf6e,
        roughness: 0.8,
        metalness: 0.2,
        emissive: asteroid.hazardous ? 0x991111 : 0x665500,
        emissiveIntensity: 0.3,
      });
      const aMesh = new THREE.Mesh(aGeo, aMat);
      aMesh.position.set(ax, ay, az);
      aMesh.userData = { type: "asteroid", asteroid };
      scene.add(aMesh);
      asteroidMeshes.push(aMesh);

      // Trajectory line
      const trajPts: THREE.Vector3[] = [];
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps - 0.5) * 2; // -1 to 1
        const dist = scaledDist + t * scaledDist * 0.8;
        const ta = angle + t * 0.1;
        trajPts.push(new THREE.Vector3(
          Math.cos(ta) * dist,
          Math.sin(t * Math.PI * 0.3) * 0.4,
          Math.sin(ta) * dist,
        ));
      }
      const trajGeo = new THREE.BufferGeometry().setFromPoints(trajPts);
      const trajLine = new THREE.Line(
        trajGeo,
        new THREE.LineDashedMaterial({
          color: asteroid.hazardous ? 0xef4444 : 0xffcf6e,
          transparent: true,
          opacity: 0.0,
          dashSize: 0.3,
          gapSize: 0.2,
        })
      );
      trajLine.computeLineDistances();
      trajLine.userData = { asteroidId: asteroid.id };
      scene.add(trajLine);
      trajectoryLines.push(trajLine);

      // Name label
      const lc = document.createElement("canvas");
      lc.width = 256;
      lc.height = 48;
      const lctx = lc.getContext("2d")!;
      lctx.font = "bold 20px monospace";
      lctx.fillStyle = asteroid.hazardous ? "#EF4444" : "#FFCF6E";
      lctx.textAlign = "center";
      lctx.fillText(asteroid.name, 128, 32);
      const tex = new THREE.CanvasTexture(lc);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7 }));
      sprite.scale.set(2.5, 0.5, 1);
      sprite.position.y = size + 0.5;
      aMesh.add(sprite);
    });

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2();
    let flyTarget: THREE.Vector3 | null = null;
    let selectedMesh: THREE.Mesh | null = null;

    function onPointerDown(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseVec, camera);
      const intersects = raycaster.intersectObjects(asteroidMeshes);

      // Reset trajectories
      trajectoryLines.forEach((l) => {
        (l.material as THREE.LineDashedMaterial).opacity = 0;
      });

      if (intersects.length > 0) {
        const obj = intersects[0].object as THREE.Mesh;
        const asteroid = obj.userData.asteroid as NEOAsteroid;
        handleSelect(asteroid);
        flyTarget = obj.position.clone();
        selectedMesh = obj;

        // Show trajectory
        const tl = trajectoryLines.find(l => l.userData.asteroidId === asteroid.id);
        if (tl) (tl.material as THREE.LineDashedMaterial).opacity = 0.5;
      } else {
        handleSelect(null);
        flyTarget = null;
        selectedMesh = null;
      }
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    // Animation
    const clock = new THREE.Clock();
    let animId = 0;
    let paused = false;

    function animate() {
      animId = requestAnimationFrame(animate);
      if (paused) return;

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Rotate earth slowly
      earth.rotation.y += delta * 0.2;

      // Wobble asteroids
      asteroidMeshes.forEach((m, i) => {
        m.rotation.x += delta * (0.3 + i * 0.1);
        m.rotation.z += delta * (0.2 + i * 0.05);
      });

      // Pulse selected
      if (selectedMesh) {
        const s = 1 + Math.sin(elapsed * 5) * 0.2;
        selectedMesh.scale.setScalar(s);
      }

      // Fly-to
      if (flyTarget) {
        controls.target.lerp(flyTarget, 0.06);
        const dir = camera.position.clone().sub(flyTarget).normalize();
        const idealDist = 6;
        const idealPos = flyTarget.clone().add(dir.multiplyScalar(idealDist));
        idealPos.y = Math.max(idealPos.y, 2);
        camera.position.lerp(idealPos, 0.03);
        if (controls.target.distanceTo(flyTarget) < 0.1) flyTarget = null;
      }

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    function handleVisibility() {
      paused = document.hidden;
      if (!paused) clock.getDelta();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [width, height, handleSelect]);

  return <div ref={containerRef} className="w-full h-full" />;
}
