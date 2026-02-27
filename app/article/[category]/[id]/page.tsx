import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { ArrowLeft, ExternalLink, Clock, Tag, MapPin } from "lucide-react";
import Link from "next/link";
import {
  getAllArticles,
  getArticleBySlug,
} from "@/lib/content";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from "@/lib/types";
import { formatDistanceToNow } from "@/lib/utils";
import GlobeWidget from "@/components/GlobeWidget";
import ArticleGlobeBackground from "@/components/ArticleGlobeBackground";
import SolarSystemBackground from "@/components/SolarSystemBackground";
import Comments from "@/components/Comments";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import GlobeModal from "@/components/GlobeModal";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ category: string; id: string }>;
}

export async function generateStaticParams() {
  const articles = getAllArticles();
  return articles.map((a) => ({
    category: a.category,
    id: a.id,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category, id } = await params;
  const article = getArticleBySlug(category, id);
  if (!article) return { title: "Article Not Found" };

  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      publishedTime: article.date,
      tags: article.tags,
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { category, id } = await params;
  const article = getArticleBySlug(category, id);

  if (!article) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.date,
    author: {
      "@type": "Organization",
      name: article.source.name,
      url: article.source.url,
    },
    publisher: {
      "@type": "Organization",
      name: "TECH & SPACE",
    },
  };

  // Determine which celestial body to highlight for space articles
  const spaceHighlight = (() => {
    if (article.category !== "space") return undefined;
    const text = (article.title + " " + article.excerpt + " " + article.content).toLowerCase();
    const bodies = ["moon", "mars", "jupiter", "saturn", "venus", "mercury", "earth", "sun"];
    return bodies.find((b) => text.includes(b));
  })();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Background: Solar system for space articles, globe for others */}
      {article.category === "space" ? (
        <SolarSystemBackground highlightPlanet={spaceHighlight} />
      ) : (
        article.geo && (
          <ArticleGlobeBackground
            geo={article.geo}
            categoryColor={CATEGORY_COLORS[article.category]}
          />
        )
      )}
      <article className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Back link */}
        <div className="article-enter">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent-cyan transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Main content */}
          <div>
            {/* Header */}
            <div className="article-enter-delay-1">
              <span
                className={`category-badge category-badge-${article.category} mb-4 inline-block`}
              >
                {CATEGORY_LABELS[article.category]}
              </span>

              <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary leading-tight mb-4">
                {article.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-text-secondary">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <time dateTime={article.date}>
                    {new Date(article.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                  <span className="ml-1 opacity-60">
                    ({formatDistanceToNow(article.date)})
                  </span>
                </div>
                {article.geo && (
                  <div className="flex items-center gap-1 text-accent-cyan/70">
                    <MapPin className="w-3 h-3" />
                    <span>{article.geo.name}</span>
                  </div>
                )}
                <a
                  href={article.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-accent-cyan transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {article.source.name}
                </a>
              </div>
            </div>

            {/* Article image */}
            <div className="article-enter-delay-2">
              {article.image?.url && (
                <div className="glass-card overflow-hidden mb-8 !hover:transform-none">
                  <img
                    src={article.image.url}
                    alt={article.image.alt}
                    className="w-full h-auto max-h-[400px] object-cover"
                  />
                </div>
              )}
            </div>

            {/* MDX content */}
            <div className="article-enter-delay-3 article-prose max-w-none">
              <MDXRemote source={article.content} components={{ YouTubeEmbed }} />
            </div>

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className="article-enter-delay-3 mt-8 pt-6 border-t border-white/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-text-secondary" />
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-3 py-1 rounded-full bg-white/5 text-text-secondary border border-white/10 hover:border-accent-cyan/30 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <Comments term={`${article.category}/${article.id}`} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 article-enter-delay-2">
            {/* Globe widget */}
            {article.geo && (
              <GlobeWidget
                geo={article.geo}
                categoryColor={CATEGORY_COLORS[article.category]}
              />
            )}

            {/* Source info */}
            <div className="glass-card p-4 !hover:transform-none">
              <h3 className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wider font-mono">
                // Source
              </h3>
              <a
                href={article.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-accent-cyan hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                {article.source.name}
              </a>
            </div>
          </aside>
        </div>
      </article>
      {article.geo && (
        <GlobeModal
          pins={[
            {
              lat: article.geo.lat,
              lng: article.geo.lon,
              label: article.geo.name,
              color: CATEGORY_COLORS[article.category],
              id: "article-location",
            },
          ]}
          initialGeo={article.geo}
        />
      )}
    </>
  );
}
