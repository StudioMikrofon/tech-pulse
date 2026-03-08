import type { MetadataRoute } from "next";
import { getAllArticles, getAllArticlesHr } from "@/lib/content";
import { CATEGORIES } from "@/lib/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://techand.space";

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = getAllArticles();
  const articlesHr = getAllArticlesHr();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), priority: 1.0, changeFrequency: "daily" },
    { url: `${SITE_URL}/hr`, lastModified: new Date(), priority: 0.9, changeFrequency: "daily" },
    ...CATEGORIES.map((cat) => ({
      url: `${SITE_URL}/category/${cat}`,
      lastModified: new Date(),
      priority: 0.8,
      changeFrequency: "daily" as const,
    })),
    ...CATEGORIES.map((cat) => ({
      url: `${SITE_URL}/hr/category/${cat}`,
      lastModified: new Date(),
      priority: 0.7,
      changeFrequency: "daily" as const,
    })),
  ];

  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/article/${a.category}/${a.id}`,
    lastModified: new Date(a.date),
    priority: 0.7,
    changeFrequency: "weekly" as const,
  }));

  const hrArticlePages: MetadataRoute.Sitemap = articlesHr.map((a) => ({
    url: `${SITE_URL}/hr/article/${a.category}/${a.id}`,
    lastModified: new Date(a.date),
    priority: 0.6,
    changeFrequency: "weekly" as const,
  }));

  return [...staticPages, ...articlePages, ...hrArticlePages];
}
