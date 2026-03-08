import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getArticlesByCategoryHr } from "@/lib/content";
import {
  CATEGORIES,
  CATEGORY_LABELS_HR,
  type Category,
} from "@/lib/types";
import ArticleGrid from "@/components/ArticleGrid";
import CategoryBanner from "@/components/CategoryBanner";
import CategoryLoadingTerminal from "@/components/CategoryLoadingTerminal";
import LangSwitcher from "@/components/LangSwitcher";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return CATEGORIES.map((cat) => ({ slug: cat }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!CATEGORIES.includes(slug as Category)) {
    return { title: "Kategorija nije pronađena" };
  }
  const label = CATEGORY_LABELS_HR[slug as Category];
  return {
    title: `${label} – Vijesti`,
    description: `Najnovije vijesti i članci iz kategorije ${label} na TECH & SPACE.`,
  };
}

export default async function CategoryPageHr({ params }: PageProps) {
  const { slug } = await params;

  if (!CATEGORIES.includes(slug as Category)) {
    notFound();
  }

  const category = slug as Category;
  const articles = getArticlesByCategoryHr(category);
  const label = CATEGORY_LABELS_HR[category];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/hr"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent-cyan transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Povratak
        </Link>
        <LangSwitcher lang="hr" href={`/category/${category}`} />
      </div>

      <CategoryBanner category={category} />
      <CategoryLoadingTerminal category={category} />

      <div className="mb-8">
        <span className={`category-badge category-badge-${category} mb-2 inline-block`}>
          {label}
        </span>
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-text-primary">
          {label}
        </h1>
        <p className="text-text-secondary mt-2">
          {articles.length} {articles.length === 1 ? "članak" : articles.length >= 2 && articles.length <= 4 ? "članka" : "članaka"}
        </p>
      </div>

      <ArticleGrid articles={articles} basePath="/hr" />
    </div>
  );
}
