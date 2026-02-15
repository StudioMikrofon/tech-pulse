"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Clock, Satellite } from "lucide-react";
import Globe from "./Globe";
import type { GlobeHandle } from "./GlobeWrapper";
import type { Article } from "@/lib/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types";
import { formatDistanceToNow } from "@/lib/utils";

interface HeroSectionProps {
  featured: Article;
  geoArticles: Article[];
  latestPerCategory?: Article[];
}

export default function HeroSection({
  featured,
  geoArticles,
  latestPerCategory = [],
}: HeroSectionProps) {
  const globeRef = useRef<GlobeHandle>(null);
  const [globeSize, setGlobeSize] = useState({ w: 800, h: 800 });
  const [activePin, setActivePin] = useState<string | null>(null);
  const [globeInteracting, setGlobeInteracting] = useState(false);
  const interactTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function updateSize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Globe fills most of the viewport
      const size = Math.max(w, h) * 0.95;
      setGlobeSize({ w: Math.min(size, 1400), h: Math.min(size, 1400) });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const pins = geoArticles.map((a) => ({
    lat: a.geo.lat,
    lng: a.geo.lon,
    label: a.title.length > 30 ? a.title.slice(0, 30) + "..." : a.title,
    color: CATEGORY_COLORS[a.category],
    id: a.id,
  }));

  const handlePinHover = (articleId: string) => {
    setActivePin(articleId);
    const article = geoArticles.find((a) => a.id === articleId);
    if (article?.geo) {
      globeRef.current?.focusOn(article.geo);
    }
  };

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Massive globe as background */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-auto opacity-30 lg:opacity-40"
        style={{ opacity: globeInteracting ? 0.55 : undefined }}
        onMouseDown={() => {
          setGlobeInteracting(true);
          if (interactTimeoutRef.current) clearTimeout(interactTimeoutRef.current);
        }}
        onMouseUp={() => {
          interactTimeoutRef.current = setTimeout(() => setGlobeInteracting(false), 2000);
        }}
        onTouchStart={() => {
          setGlobeInteracting(true);
          if (interactTimeoutRef.current) clearTimeout(interactTimeoutRef.current);
        }}
        onTouchEnd={() => {
          interactTimeoutRef.current = setTimeout(() => setGlobeInteracting(false), 2000);
        }}
      >
        <div className={`globe-glow ${globeInteracting ? "globe-interacting" : ""}`}>
          <Globe
            ref={globeRef}
            pins={pins}
            width={globeSize.w}
            height={globeSize.h}
            autoRotate={true}
            enableZoom={true}
            initialAltitude={2.0}
          />
        </div>
      </div>

      {/* Content overlay */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-16 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
          {/* Featured article - takes 3 cols */}
          <div className="lg:col-span-3 space-y-6">
            {/* Terminal-style status line */}
            <div className="flex items-center gap-2 text-xs font-mono text-accent-cyan/70">
              <Satellite className="w-3 h-3 animate-pulse" />
              <span className="terminal-text">LIVE FEED // ORBITAL NETWORK</span>
              <span className="live-dot" />
            </div>

            <span
              className={`category-badge category-badge-${featured.category} inline-block`}
            >
              {CATEGORY_LABELS[featured.category]}
            </span>

            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary leading-[1.1] drop-shadow-lg">
              {featured.title}
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-text-secondary leading-relaxed max-w-2xl drop-shadow-md">
              {featured.excerpt}
            </p>

            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{formatDistanceToNow(featured.date)}</span>
              </div>
              {featured.geo && (
                <button
                  onClick={() => globeRef.current?.focusOn(featured.geo)}
                  className="flex items-center gap-1 hover:text-accent-cyan transition-colors group"
                >
                  <MapPin className="w-4 h-4 group-hover:animate-bounce" />
                  <span>{featured.geo.name}</span>
                </button>
              )}
            </div>

            <Link
              href={`/article/${featured.category}/${featured.id}`}
              className="article-link-cta inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-accent-cyan/10 border border-accent-cyan/30 rounded-xl text-accent-cyan font-semibold text-base sm:text-lg hover:bg-accent-cyan/20 hover:border-accent-cyan/50 hover:shadow-[0_0_30px_rgba(143,211,255,0.15)] transition-all duration-300"
            >
              Read Article
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Side panel - latest article per category */}
          <div className="lg:col-span-2 hidden lg:block">
            <div className="glass-card p-4 space-y-3 !hover:transform-none">
              <h3 className="text-xs font-mono text-accent-cyan/60 uppercase tracking-widest mb-3">
                // Global Feed — Latest per Category
              </h3>
              {(latestPerCategory.length > 0 ? latestPerCategory : geoArticles).slice(0, 7).map((article) => (
                <Link
                  key={article.id}
                  href={`/article/${article.category}/${article.id}`}
                  className={`block p-3 rounded-lg transition-all duration-300 border border-transparent hover:border-accent-cyan/20 hover:bg-white/5 ${
                    activePin === article.id ? "bg-white/8 border-accent-cyan/30" : ""
                  }`}
                  onMouseEnter={() => handlePinHover(article.id)}
                  onMouseLeave={() => setActivePin(null)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2 h-2 rounded-full mt-2 shrink-0 animate-pulse"
                      style={{ backgroundColor: CATEGORY_COLORS[article.category] }}
                    />
                    <div>
                      <p className="text-sm font-medium text-text-primary line-clamp-2 leading-tight">
                        {article.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                        <span>{CATEGORY_LABELS[article.category]}</span>
                        {article.geo && (
                          <>
                            <span className="opacity-30">|</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {article.geo.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-space-bg to-transparent z-10" />
    </section>
  );
}
