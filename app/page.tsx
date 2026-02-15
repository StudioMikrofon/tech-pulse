import {
  getAllArticles,
  getFeaturedArticle,
  getGeoArticles,
  getLatestPerCategory,
} from "@/lib/content";
import HeroSection from "@/components/HeroSection";
import Ticker from "@/components/Ticker";
import ArticleGrid from "@/components/ArticleGrid";
import SolarSystem from "@/components/SolarSystem";

export default function HomePage() {
  const articles = getAllArticles();
  const featured = getFeaturedArticle();
  const geoArticles = getGeoArticles();
  const latestPerCategory = getLatestPerCategory();

  if (!featured) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <img src="/logo.jpg" alt="Tech Pulse" className="w-20 h-20 mx-auto mb-6 rounded-xl" />
        <h1 className="font-heading text-4xl font-bold mb-4">Tech Pulse</h1>
        <p className="text-text-secondary text-lg font-mono">
          // No articles in database. Awaiting first transmission...
        </p>
      </div>
    );
  }

  const gridArticles = articles.filter((a) => a.id !== featured.id);

  return (
    <>
      {/* Subtle solar system ambient background behind starfield */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.08] z-0">
        <SolarSystem />
      </div>
      <HeroSection featured={featured} geoArticles={geoArticles} latestPerCategory={latestPerCategory} />
      <Ticker articles={articles} />
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <h2 className="section-header font-heading text-2xl font-bold text-text-primary mb-6">
          Latest News
        </h2>
        <ArticleGrid articles={gridArticles} />
      </section>
    </>
  );
}
