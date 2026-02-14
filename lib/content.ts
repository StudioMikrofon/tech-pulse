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
      title: data.title,
      category: data.category as Category,
      date: data.date,
      excerpt: data.excerpt,
      source: data.source,
      image: data.image,
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

    const files = fs.readdirSync(categoryDir).filter((f) => f.endsWith(".mdx"));
    for (const file of files) {
      const article = parseMdxFile(path.join(categoryDir, file));
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
  const filePath = path.join(CONTENT_DIR, category, `${id}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  return parseMdxFile(filePath);
}

export function getArticlesByCategory(category: Category): Article[] {
  return getAllArticles().filter((a) => a.category === category);
}

export function getFeaturedArticle(): Article | null {
  const articles = getAllArticles();
  return articles.find((a) => a.featured) || articles[0] || null;
}

export function getGeoArticles(): Article[] {
  return getAllArticles().filter(
    (a) => a.geo && a.geo.lat !== undefined && a.geo.lon !== undefined
  );
}
