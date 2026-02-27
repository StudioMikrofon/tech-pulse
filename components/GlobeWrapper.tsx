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
        controls.minDistance = 50;
        controls.maxDistance = 1500;
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

          // Parse label — may be JSON array (grouped pins) or plain string
          let isGrouped = false;
          let groupItems: { title: string; id: string; category: string; color: string }[] = [];
          try {
            const parsed = JSON.parse(d.label);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
              isGrouped = true;
              groupItems = parsed;
            }
          } catch {
            // plain text label
          }

          // Tooltip
          const tooltip = document.createElement("div");
          tooltip.style.cssText = `
            position: absolute;
            bottom: 14px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(5, 7, 13, 0.9);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(143, 211, 255, 0.2);
            color: #EAF0FF;
            font-size: 12px;
            font-family: sans-serif;
            padding: 8px 12px;
            border-radius: 8px;
            white-space: normal;
            max-width: 320px;
            min-width: 180px;
            pointer-events: auto;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 10;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          `;

          if (isGrouped) {
            tooltip.innerHTML = groupItems
              .map(
                (item) =>
                  `<a href="/article/${item.category}/${item.id}" style="display:flex;align-items:center;gap:6px;padding:4px 0;color:#EAF0FF;text-decoration:none;border-bottom:1px solid rgba(255,255,255,0.06);transition:color 0.2s;" onmouseover="this.style.color='#8FD3FF'" onmouseout="this.style.color='#EAF0FF'"><span style="width:6px;height:6px;border-radius:50%;background:${item.color};flex-shrink:0;"></span><span style="line-height:1.3;">${item.title}</span></a>`
              )
              .join("");
          } else {
            const singleLink = document.createElement("a");
            singleLink.href = `/article/${d.id}`;
            singleLink.textContent = d.label;
            singleLink.style.cssText = `color: #EAF0FF; text-decoration: none; line-height: 1.3;`;
            singleLink.addEventListener("mouseover", () => { singleLink.style.color = "#8FD3FF"; });
            singleLink.addEventListener("mouseout", () => { singleLink.style.color = "#EAF0FF"; });
            tooltip.appendChild(singleLink);
          }

          el.appendChild(tooltip);

          // Desktop hover
          el.addEventListener("mouseenter", () => {
            tooltip.style.opacity = "1";
            dot.style.transform = "scale(1.5)";
          });
          el.addEventListener("mouseleave", () => {
            tooltip.style.opacity = "0";
            dot.style.transform = "scale(1)";
          });

          // Mobile tap toggle
          let tooltipVisible = false;
          el.addEventListener("touchstart", (e) => {
            e.stopPropagation();
            tooltipVisible = !tooltipVisible;
            tooltip.style.opacity = tooltipVisible ? "1" : "0";
            dot.style.transform = tooltipVisible ? "scale(1.5)" : "scale(1)";
          }, { passive: true });

          return el;
        }}
        animateIn={true}
      />
    );
  }
);

export default GlobeWrapper;
