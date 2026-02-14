import Link from "next/link";
import { Zap } from "lucide-react";
import type { Article } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

interface TickerProps {
  articles: Article[];
}

export default function Ticker({ articles }: TickerProps) {
  if (articles.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...articles, ...articles];

  return (
    <div className="border-y border-white/5 overflow-hidden py-3 my-8">
      <div className="ticker-track">
        {items.map((article, i) => (
          <Link
            key={`${article.id}-${i}`}
            href={`/article/${article.category}/${article.id}`}
            className="flex items-center gap-2 px-6 whitespace-nowrap text-sm group"
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
