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
        controls.minDistance = 120;
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
        pointRadius={0.6}
        onPointClick={handlePinClick}
        labelsData={pins}
        labelLat="lat"
        labelLng="lng"
        labelText="label"
        labelSize={0.4}
        labelDotRadius={0.15}
        labelColor="color"
        labelAltitude={0.015}
        labelResolution={2}
        animateIn={true}
      />
    );
  }
);

export default GlobeWrapper;
