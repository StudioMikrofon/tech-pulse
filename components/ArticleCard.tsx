"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, ArrowUpRight } from "lucide-react";
import type { Article } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { formatDistanceToNow } from "@/lib/utils";
import { playSound } from "@/lib/sounds";

interface ArticleCardProps {
  article: Article;
  onGeoClick?: (article: Article) => void;
}

const LOADING_LINES = [
  "> ACCESSING ORBITAL DATABASE...",
  "> DECRYPTING FEED...",
  "> LOADING ARTICLE",
];

export default function ArticleCard({ article, onGeoClick }: ArticleCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isWarping, setIsWarping] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setRipplePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    setIsWarping(true);
    setLoadingLine(0);
    playSound("click");

    // Cycle through loading lines
    setTimeout(() => setLoadingLine(1), 200);
    setTimeout(() => setLoadingLine(2), 400);

    // Navigate after animation
    setTimeout(() => {
      router.push(`/article/${article.category}/${article.id}`);
    }, 600);
  };

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseEnter={(e) => {
        setIsHovered(true);
        playSound("hover");
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setMousePos(null);
      }}
      onMouseMove={(e) => {
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect) {
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
      }}
      className={`glass-card overflow-hidden flex flex-col group cursor-pointer relative ${
        isWarping ? "article-warp-out" : ""
      }`}
    >
      {/* Warp ripple effect */}
      {isWarping && (
        <div
          className="absolute z-20 rounded-full bg-accent-cyan/30 animate-warp-ripple"
          style={{
            left: ripplePos.x,
            top: ripplePos.y,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {/* Terminal loading overlay */}
      {isWarping && (
        <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="text-left px-4">
            {LOADING_LINES.slice(0, loadingLine + 1).map((line, i) => (
              <div
                key={i}
                className="text-[#00ff41] font-mono text-xs whitespace-pre"
                style={{ textShadow: "0 0 6px rgba(0,255,65,0.5)" }}
              >
                {line}
                {i === loadingLine && (
                  <span className="inline-block w-2 h-3 bg-[#00ff41] ml-1 animate-pulse align-middle" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-white/5">
        {article.image?.url ? (
          <img
            src={article.image.url}
            alt={article.image.alt}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-full opacity-20"
              style={{
                background: `radial-gradient(circle, var(--color-category-${article.category}) 0%, transparent 70%)`,
              }}
            />
          </div>
        )}

        {/* Category badge */}
        <span
          className={`absolute top-3 left-3 category-badge category-badge-${article.category}`}
        >
          {CATEGORY_LABELS[article.category]}
        </span>

        {/* Hover scan line */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="card-scan-line" />
        </div>

        {/* Arrow indicator */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
          <ArrowUpRight className="w-5 h-5 text-white drop-shadow-lg" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-heading font-bold text-text-primary text-base sm:text-lg leading-snug mb-2 line-clamp-2 group-hover:text-accent-cyan transition-colors duration-300">
          {article.title}
        </h3>
        <p className="text-sm sm:text-[0.9rem] text-text-secondary line-clamp-3 mb-3 flex-1 leading-relaxed">
          {article.excerpt}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDistanceToNow(article.date)}</span>
          </div>
          {article.geo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onGeoClick?.(article);
              }}
              className="flex items-center gap-1 hover:text-accent-cyan transition-colors"
            >
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[120px]">
                {article.geo.name}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Holographic shimmer on hover */}
      {isHovered && mousePos && (
        <div
          className="absolute inset-0 opacity-20 pointer-events-none z-10 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 180px at ${mousePos.x}px ${mousePos.y}px, rgba(255,0,128,0.3), rgba(0,255,128,0.2) 30%, rgba(0,128,255,0.2) 60%, transparent 70%)`,
          }}
        />
      )}

      {/* Bottom glow on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent-cyan/0 to-transparent group-hover:via-accent-cyan/50 transition-all duration-500" />
    </div>
  );
}
