"use client";

import { useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import type { Article } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

interface TickerProps {
  articles: Article[];
  compact?: boolean;
}

/** Filter to last 24h; fallback to latest 20 if fewer than 5 match */
function filterRecent(articles: Article[]): Article[] {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const recent = articles.filter((a) => now - new Date(a.date).getTime() < DAY);
  if (recent.length >= 5) return recent;
  return articles.slice(0, 20);
}

/** Round-robin interleave by category so no two consecutive items share a category */
function interleaveByCategory(articles: Article[]): Article[] {
  const groups = new Map<string, Article[]>();
  for (const a of articles) {
    if (!groups.has(a.category)) groups.set(a.category, []);
    groups.get(a.category)!.push(a);
  }

  const result: Article[] = [];
  const categoryQueues = Array.from(groups.values());
  let lastCategory = "";

  while (categoryQueues.some((q) => q.length > 0)) {
    let picked = false;
    for (let i = 0; i < categoryQueues.length; i++) {
      const q = categoryQueues[i];
      if (q.length > 0 && q[0].category !== lastCategory) {
        const item = q.shift()!;
        result.push(item);
        lastCategory = item.category;
        picked = true;
        break;
      }
    }
    // If all remaining are same category, just take one
    if (!picked) {
      for (const q of categoryQueues) {
        if (q.length > 0) {
          const item = q.shift()!;
          result.push(item);
          lastCategory = item.category;
          break;
        }
      }
    }
  }

  return result;
}

export default function Ticker({ articles, compact = false }: TickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Filter + interleave
  const displayArticles = useMemo(() => {
    const recent = filterRecent(articles);
    return interleaveByCategory(recent);
  }, [articles]);

  useEffect(() => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;

    function calcDuration() {
      const scrollW = track!.scrollWidth;
      const pxPerSec = window.innerWidth < 768 ? 50 : 60;
      const duration = scrollW / pxPerSec;
      container!.style.setProperty("--ticker-duration", duration + "s");
    }

    requestAnimationFrame(calcDuration);
    window.addEventListener("resize", calcDuration);
    return () => window.removeEventListener("resize", calcDuration);
  }, [displayArticles]);

  if (displayArticles.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...displayArticles, ...displayArticles];

  if (compact) {
    return (
      <div
        ref={containerRef}
        className="fixed bottom-0 left-0 right-0 z-[30] bg-space-bg/85 backdrop-blur-md border-t border-white/5 overflow-hidden py-1.5"
      >
        <div ref={trackRef} className="ticker-track">
          {items.map((article, i) => (
            <Link
              key={`${article.id}-${i}`}
              href={`/article/${article.category}/${article.id}`}
              className="flex items-center gap-2 px-4 whitespace-nowrap text-xs group transition-transform hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(143,211,255,0.3)]"
            >
              <Zap className="w-2.5 h-2.5 text-accent-amber flex-shrink-0" />
              <span
                className={`category-badge category-badge-${article.category} !text-[0.55rem] !py-0`}
              >
                {CATEGORY_LABELS[article.category]}
              </span>
              <span className="text-text-secondary group-hover:text-text-primary transition-colors">
                {article.title}
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="ticker-container border-y border-white/5 overflow-hidden py-3 my-8">
      <div ref={trackRef} className="ticker-track">
        {items.map((article, i) => (
          <Link
            key={`${article.id}-${i}`}
            href={`/article/${article.category}/${article.id}`}
            className="flex items-center gap-2 px-6 whitespace-nowrap text-sm group transition-transform hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(143,211,255,0.3)]"
          >
            <Zap className="w-3 h-3 text-accent-amber flex-shrink-0" />
            <span
              className={`category-badge category-badge-${article.category} !text-[0.6rem] !py-0`}
            >
              {CATEGORY_LABELS[article.category]}
            </span>
            <span className="text-text-secondary group-hover:text-text-primary transition-colors">
              {article.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
