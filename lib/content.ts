import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { Article, Category, CATEGORIES } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content");

function parseMdxFile(filePath: string): Article | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);

    if (!data.approved) return null;

    return {
      id: data.id,
      dbId: data.db_id ? Number(data.db_id) : undefined,
      title: data.title,
      category: data.category as Category,
      date: data.date,
      excerpt: data.excerpt,
      source: data.source,
      image: data.image,
      subtitle: data.subtitle,
      subtitleImage: data.subtitleImage,
      tags: data.tags || [],
      geo: data.geo,
      featured: data.featured || false,
      approved: data.approved,
      content,
    };
  } catch {
    return null;
  }
}

export function getAllArticles(): Article[] {
  const articles: Article[] = [];

  for (const category of CATEGORIES) {
    const categoryDir = path.join(CONTENT_DIR, category);
    if (!fs.existsSync(categoryDir)) continue;

    const entries = fs.readdirSync(categoryDir, { withFileTypes: true });
    for (const entry of entries) {
      let filePath: string;
      if (entry.isDirectory()) {
        // New format: content/{category}/{slug}/index.mdx
        const indexPath = path.join(categoryDir, entry.name, "index.mdx");
        if (!fs.existsSync(indexPath)) continue;
        filePath = indexPath;
      } else if (entry.name.endsWith(".mdx")) {
        // Old format: content/{category}/{slug}.mdx
        filePath = path.join(categoryDir, entry.name);
      } else {
        continue;
      }
      const article = parseMdxFile(filePath);
      if (article) articles.push(article);
    }
  }

  // Sort by date descending
  return articles.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getArticleBySlug(
  category: string,
  id: string
): Article | null {
  // Try new folder format first: content/{category}/{id}/index.mdx
  const folderPath = path.join(CONTENT_DIR, category, id, "index.mdx");
  if (fs.existsSync(folderPath)) return parseMdxFile(folderPath);
  // Fallback: old flat format content/{category}/{id}.mdx
  const filePath = path.join(CONTENT_DIR, category, `${id}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  return parseMdxFile(filePath);
}

// ── Croatian (HR) versions ────────────────────────────────────

export function getArticleBySlugHr(
  category: string,
  id: string
): Article | null {
  // Try HR file: content/{category}/{id}/index.hr.mdx
  const hrPath = path.join(CONTENT_DIR, category, id, "index.hr.mdx");
  if (fs.existsSync(hrPath)) return parseMdxFile(hrPath);
  // Fallback to EN version
  return getArticleBySlug(category, id);
}

export function getAllArticlesHr(): Article[] {
  const articles: Article[] = [];

  for (const category of CATEGORIES) {
    const categoryDir = path.join(CONTENT_DIR, category);
    if (!fs.existsSync(categoryDir)) continue;

    const entries = fs.readdirSync(categoryDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const hrPath = path.join(categoryDir, entry.name, "index.hr.mdx");
      const enPath = path.join(categoryDir, entry.name, "index.mdx");
      // Prefer HR file, fall back to EN
      const filePath = fs.existsSync(hrPath) ? hrPath : (fs.existsSync(enPath) ? enPath : null);
      if (!filePath) continue;
      const article = parseMdxFile(filePath);
      if (article) articles.push(article);
    }
  }

  return articles.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getArticlesByCategory(category: Category): Article[] {
  return getAllArticles().filter((a) => a.category === category);
}

export function getArticlesByCategoryHr(category: Category): Article[] {
  return getAllArticlesHr().filter((a) => a.category === category);
}

export function getRelatedArticles(
  currentId: string,
  category: Category,
  tags: string[],
  limit = 4
): Article[] {
  const all = getAllArticles();
  const tagSet = new Set(tags);

  const scored = all
    .filter((a) => a.id !== currentId)
    .map((a) => {
      const sameCategory = a.category === category ? 2 : 0;
      const sharedTags = a.tags.filter((t) => tagSet.has(t)).length;
      return { article: a, score: sameCategory + sharedTags };
    })
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.article.date).getTime() - new Date(a.article.date).getTime()
    );

  return scored.slice(0, limit).map((x) => x.article);
}

export function getFeaturedArticle(): Article | null {
  const articles = getAllArticles();
  // Always show the newest article as featured (hero)
  return articles[0] || null;
}

export function getGeoArticles(): Article[] {
  return getAllArticles().filter(
    (a) => a.geo && a.geo.lat !== undefined && a.geo.lon !== undefined
  );
}

/**
 * Returns the latest article for each category (for the Global Feed sidebar).
 * Each category is represented by at most one article (the newest).
 */
export function getLatestPerCategory(): Article[] {
  const articles = getAllArticles();
  const seen = new Set<string>();
  const result: Article[] = [];

  for (const article of articles) {
    if (!seen.has(article.category)) {
      seen.add(article.category);
      result.push(article);
    }
  }
  return result;
}
