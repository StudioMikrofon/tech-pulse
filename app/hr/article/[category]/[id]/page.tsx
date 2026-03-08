import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { ArrowLeft, ExternalLink, Clock, Tag, MapPin } from "lucide-react";
import Link from "next/link";
import { getAllArticlesHr, getArticleBySlugHr, getRelatedArticles } from "@/lib/content";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types";
import { formatDistanceToNow } from "@/lib/utils";
import GlobeWidget from "@/components/GlobeWidget";
import ArticleGlobeBackground from "@/components/ArticleGlobeBackground";
import SolarSystemBackground from "@/components/SolarSystemBackground";
import Comments from "@/components/Comments";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import LangSwitcher from "@/components/LangSwitcher";
import RelatedArticles from "@/components/RelatedArticles";
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://techand.space";

interface PageProps {
  params: Promise<{ category: string; id: string }>;
}

export async function generateStaticParams() {
  const articles = getAllArticlesHr();
  return articles.map((a) => ({ category: a.category, id: a.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, id } = await params;
  const article = getArticleBySlugHr(category, id);
  if (!article) return { title: "Članak nije pronađen" };

  const canonicalUrl = `${SITE_URL}/article/${category}/${id}`;
  const hrUrl = `${SITE_URL}/hr/article/${category}/${id}`;
  const ogImage = article.image?.url?.startsWith("http")
    ? article.image.url
    : article.image?.url
    ? `${SITE_URL}${article.image.url}`
    : `${SITE_URL}/logo.jpg`;

  return {
    title: article.title,
    description: article.excerpt,
    keywords: article.tags.join(", "),
    alternates: {
      canonical: canonicalUrl,
      languages: { "hr": hrUrl, "en": canonicalUrl },
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      url: hrUrl,
      publishedTime: article.date,
      tags: article.tags,
      siteName: "TECH & SPACE",
      images: [{ url: ogImage, width: 1200, height: 630, alt: article.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [ogImage],
    },
  };
}

export default async function ArticlePageHr({ params }: PageProps) {
  const { category, id } = await params;
  const article = getArticleBySlugHr(category, id);
  if (!article) notFound();

  const related = getRelatedArticles(article.id, article.category, article.tags);

  const canonicalUrl = `${SITE_URL}/article/${category}/${id}`;
  const ogImage = article.image?.url?.startsWith("http")
    ? article.image.url
    : article.image?.url
    ? `${SITE_URL}${article.image.url}`
    : `${SITE_URL}/logo.jpg`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    image: ogImage,
    datePublished: article.date,
    dateModified: article.date,
    author: { "@type": "Organization", name: article.source.name, url: article.source.url },
    publisher: {
      "@type": "Organization",
      name: "TECH & SPACE",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.jpg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    inLanguage: "hr",
    articleSection: article.category,
    keywords: article.tags.join(", "),
  };

  const spaceHighlight = (() => {
    if (article.category !== "space") return undefined;
    const text = (article.title + " " + article.content).toLowerCase();
    return ["moon", "mars", "jupiter", "saturn", "venus", "mercury", "earth", "sun"].find(
      (b) => text.includes(b)
    );
  })();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/hr"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent-cyan transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Povratak
          </Link>
          <LangSwitcher lang="hr" href={`/article/${category}/${id}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          <div>
            <span className={`category-badge category-badge-${article.category} mb-4 inline-block`}>
              {CATEGORY_LABELS[article.category]}
            </span>
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary leading-tight mb-4">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-text-secondary">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <time dateTime={article.date}>
                  {new Date(article.date).toLocaleDateString("hr-HR", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </time>
                <span className="ml-1 opacity-60">({formatDistanceToNow(article.date)})</span>
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

            {article.image?.url && (
              <div className="glass-card overflow-hidden mb-8 !hover:transform-none">
                <img
                  src={article.image.url}
                  alt={article.image.alt}
                  className="w-full h-auto max-h-[400px] object-cover"
                />
              </div>
            )}

            {article.videoUrl && (() => {
              const match = article.videoUrl!.match(
                /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/
              );
              const videoId = match?.[1];
              return videoId ? <YouTubeEmbed id={videoId} title={article.title} /> : null;
            })()}

            <div className="article-prose max-w-none">
              <MDXRemote
                source={article.content}
                components={{
                  YouTubeEmbed,
                  ArticleBreak: () => (
                    <div className="not-prose my-8 pt-6 border-t border-white/10">
                      {article.subtitleImage?.url && (
                        <div className="glass-card overflow-hidden mb-4 !hover:transform-none">
                          <img
                            src={article.subtitleImage.url}
                            alt={article.subtitleImage?.alt}
                            className="w-full h-auto max-h-[400px] object-cover"
                          />
                        </div>
                      )}
                      {article.subtitle && (
                        <p className="text-text-secondary italic text-lg leading-relaxed font-medium">
                          {article.subtitle}
                        </p>
                      )}
                    </div>
                  ),
                }}
              />
            </div>

            {article.tags.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-text-secondary" />
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-3 py-1 rounded-full bg-white/5 text-text-secondary border border-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Comments term={`${article.category}/${article.id}`} />
          </div>

          <aside className="space-y-6">
            {article.geo && (
              <GlobeWidget geo={article.geo} categoryColor={CATEGORY_COLORS[article.category]} />
            )}
            <div className="glass-card p-4 !hover:transform-none">
              <h3 className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wider font-mono">
                // Izvor
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

            {related.length > 0 && <RelatedArticles articles={related} basePath="/hr" />}
          </aside>
        </div>
      </article>
    </>
  );
}
