"use client";

import dynamic from "next/dynamic";
import { forwardRef, useState, useEffect } from "react";
import GlobeFallback from "./GlobeFallback";
import type { GlobeHandle } from "./GlobeWrapper";

const GlobeWrapper = dynamic(() => import("./GlobeWrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full">
      <div className="globe-loading-ring" />
    </div>
  ),
});

interface GlobeProps {
  pins?: Array<{
    lat: number;
    lng: number;
    label: string;
    color: string;
    id: string;
  }>;
  width?: number;
  height?: number;
  onPinClick?: (pin: any) => void;
  autoRotate?: boolean;
  enableZoom?: boolean;
  initialAltitude?: number;
}

function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

const GlobeComponent = forwardRef<GlobeHandle, GlobeProps>(
  function GlobeComponent(props, ref) {
    const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);

    useEffect(() => {
      setWebGLSupported(hasWebGL());
    }, []);

    if (webGLSupported === null) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <div className="globe-loading-ring" />
        </div>
      );
    }

    if (!webGLSupported) {
      return <GlobeFallback />;
    }

    return <GlobeWrapper ref={ref} {...props} />;
  }
);

export default GlobeComponent;
