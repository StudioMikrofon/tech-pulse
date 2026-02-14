"use client";

import ArticleCard from "./ArticleCard";
import type { Article } from "@/lib/types";

interface ArticleGridProps {
  articles: Article[];
  onGeoClick?: (article: Article) => void;
}

export default function ArticleGrid({ articles, onGeoClick }: ArticleGridProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary text-lg font-mono">
          // No articles found in database
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {articles.map((article, index) => (
        <div
          key={article.id}
          className="grid-card-animate"
          style={{ animationDelay: `${index * 0.08}s` }}
        >
          <ArticleCard
            article={article}
            onGeoClick={onGeoClick}
          />
        </div>
      ))}
    </div>
  );
}
