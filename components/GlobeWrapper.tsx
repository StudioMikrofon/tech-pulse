"use client";

import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import Globe from "react-globe.gl";
import type { GeoLocation } from "@/lib/types";

interface GlobePin {
  lat: number;
  lng: number;
  label: string;
  color: string;
  id: string;
}

export interface GlobeHandle {
  focusOn: (geo: GeoLocation) => void;
  resetView: () => void;
}

interface GlobeWrapperProps {
  pins?: GlobePin[];
  width?: number;
  height?: number;
  onPinClick?: (pin: GlobePin) => void;
  autoRotate?: boolean;
  backgroundColor?: string;
  enableZoom?: boolean;
  initialAltitude?: number;
}

const GlobeWrapper = forwardRef<GlobeHandle, GlobeWrapperProps>(
  function GlobeWrapper(
    {
      pins = [],
      width = 500,
      height = 500,
      onPinClick,
      autoRotate = true,
      backgroundColor = "rgba(0,0,0,0)",
      enableZoom = true,
      initialAltitude = 2.2,
    },
    ref
  ) {
    const globeRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
      if (!globeRef.current) return;

      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 0.3;
        controls.enableZoom = enableZoom;
        controls.minDistance = 100;
        controls.maxDistance = 600;
        controls.zoomSpeed = 0.8;
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;

        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        if (prefersReducedMotion) {
          controls.autoRotate = false;
        }
      }

      globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: initialAltitude });
      setIsReady(true);
    }, [autoRotate, enableZoom, initialAltitude]);

    useImperativeHandle(ref, () => ({
      focusOn: (geo: GeoLocation) => {
        if (!globeRef.current) return;
        globeRef.current.pointOfView(
          { lat: geo.lat, lng: geo.lon, altitude: 1.5 },
          1200
        );
        const controls = globeRef.current.controls();
        if (controls) {
          controls.autoRotate = false;
          setTimeout(() => {
            if (controls) controls.autoRotate = autoRotate;
          }, 5000);
        }
      },
      resetView: () => {
        if (!globeRef.current) return;
        globeRef.current.pointOfView(
          { lat: 20, lng: 0, altitude: initialAltitude },
          1000
        );
      },
    }));

    const handlePinClick = useCallback(
      (point: object) => {
        const pin = point as GlobePin;
        if (onPinClick) onPinClick(pin);
      },
      [onPinClick]
    );

    const htmlElementsData = pins.map((pin) => ({
      lat: pin.lat,
      lng: pin.lng,
      label: pin.label,
      color: pin.color,
      id: pin.id,
    }));

    return (
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        backgroundColor={backgroundColor}
        globeImageUrl="/textures/earth_day.jpg"
        bumpImageUrl="/textures/earth_bump.jpg"
        atmosphereColor="#8FD3FF"
        atmosphereAltitude={0.18}
        pointsData={pins}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0.02}
        pointRadius={0.8}
        onPointClick={handlePinClick}
        htmlElementsData={htmlElementsData}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.03}
        htmlElement={(d: any) => {
          const el = document.createElement("div");
          el.style.cssText = `
            position: relative;
            cursor: pointer;
          `;

          // Dot
          const dot = document.createElement("div");
          dot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${d.color};
            box-shadow: 0 0 6px ${d.color};
            transition: transform 0.2s;
          `;
          el.appendChild(dot);

          // Tooltip (hidden by default)
          const tooltip = document.createElement("div");
          tooltip.textContent = d.label;
          tooltip.style.cssText = `
            position: absolute;
            bottom: 14px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(5, 7, 13, 0.85);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #EAF0FF;
            font-size: 11px;
            font-family: sans-serif;
            padding: 4px 8px;
            border-radius: 6px;
            white-space: nowrap;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 10;
          `;
          el.appendChild(tooltip);

          el.addEventListener("mouseenter", () => {
            tooltip.style.opacity = "1";
            dot.style.transform = "scale(1.5)";
          });
          el.addEventListener("mouseleave", () => {
            tooltip.style.opacity = "0";
            dot.style.transform = "scale(1)";
          });

          return el;
        }}
        animateIn={true}
      />
    );
  }
);

export default GlobeWrapper;
