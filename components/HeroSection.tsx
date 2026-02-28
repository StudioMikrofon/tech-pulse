"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Satellite, Globe2 } from "lucide-react";
import Globe from "./Globe";
import GlobeQuiz from "./GlobeQuiz";
import type { GlobeHandle } from "./GlobeWrapper";
import type { Article } from "@/lib/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types";
import { formatDistanceToNow } from "@/lib/utils";
import { playSound } from "@/lib/sounds";

interface HeroSectionProps {
  featured: Article;
  latestPerCategory?: Article[];
}

export default function HeroSection({
  featured,
  latestPerCategory = [],
}: HeroSectionProps) {
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeHandle>(null);
  const [globeSize, setGlobeSize] = useState(600);
  const [quizMode, setQuizMode] = useState(false);
  const [quizPin, setQuizPin] = useState<{ lat: number; lng: number; label: string; color: string; id: string }[]>([]);

  useEffect(() => {
    function updateSize() {
      if (globeContainerRef.current) {
        const w = globeContainerRef.current.clientWidth;
        setGlobeSize(Math.min(w, 900));
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <section className="relative overflow-hidden" ref={globeContainerRef}>
      {/* Globe as decorative background — centered behind featured article */}
      <div className={`absolute inset-0 flex items-center justify-center ${quizMode ? 'opacity-80' : 'opacity-50 pointer-events-none'}`}>
        <div className="globe-glow">
          <Globe
            ref={globeRef}
            pins={quizPin}
            width={globeSize}
            height={typeof window !== "undefined" && window.innerWidth < 768 ? 420 : globeSize}
            autoRotate={true}
            enableZoom={false}
            initialAltitude={1.5}
          />
        </div>
      </div>

      {/* Content overlays globe */}
      <div className="relative z-10 max-w-7xl mx-auto px-4">
        {/* Featured article — centered over globe */}
        <div className="max-w-3xl mx-auto text-center space-y-5 py-20 lg:py-32">
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-accent-cyan/70">
            <Satellite className="w-3 h-3 animate-pulse" />
            <span className="terminal-text">
              LIVE FEED // ORBITAL NETWORK
            </span>
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

          <p className="text-base sm:text-lg md:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto drop-shadow-md">
            {featured.excerpt}
          </p>

          <div className="flex items-center justify-center gap-4 text-sm text-text-secondary">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{formatDistanceToNow(featured.date)}</span>
            </div>
          </div>

          <Link
            href={`/article/${featured.category}/${featured.id}`}
            className="article-link-cta inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-accent-cyan/10 border border-accent-cyan/30 rounded-xl text-accent-cyan font-semibold text-base sm:text-lg hover:bg-accent-cyan/20 hover:border-accent-cyan/50 hover:shadow-[0_0_30px_rgba(143,211,255,0.15)] transition-all duration-300"
          >
            Read Article
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Geography Quiz toggle + quiz panel */}
        <div className="flex justify-center mb-4">
          <button
            onClick={() => {
              playSound("click");
              const next = !quizMode;
              setQuizMode(next);
              if (!next) setQuizPin([]);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-sm font-mono hover:bg-accent-cyan/20 transition-colors cursor-pointer hacker-glow"
          >
            <Globe2 className="w-4 h-4" />
            {quizMode ? "Close Quiz" : "Geography Quiz"}
          </button>
        </div>
        {quizMode && (
          <div className="mb-8">
            <GlobeQuiz
              onFlyTo={(lat, lon) => {
                setQuizPin([{ lat, lng: lon, label: "?", color: "#00D4FF", id: "quiz" }]);
                globeRef.current?.focusOn({ lat, lon, name: "", countryCode: "" });
              }}
              onClose={() => { setQuizMode(false); setQuizPin([]); }}
            />
          </div>
        )}

        {/* Latest per category panel */}
        {latestPerCategory.length > 0 && (
          <div className="pb-8">
            <div className="glass-card p-4 space-y-3 !hover:transform-none">
              <h3 className="text-xs font-mono text-accent-cyan/60 uppercase tracking-widest mb-3">
                // Global Feed — Latest per Category
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {latestPerCategory.slice(0, 8).map((article) => (
                  <Link
                    key={article.id}
                    href={`/article/${article.category}/${article.id}`}
                    className="block p-3 rounded-lg transition-all duration-300 border border-transparent hover:border-accent-cyan/20 hover:bg-white/5"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-2 shrink-0 animate-pulse"
                        style={{
                          backgroundColor: CATEGORY_COLORS[article.category],
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary line-clamp-2 leading-tight">
                          {article.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                          <span>{CATEGORY_LABELS[article.category]}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-space-bg to-transparent z-10" />
    </section>
  );
}
