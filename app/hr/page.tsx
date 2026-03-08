import { getAllArticlesHr } from "@/lib/content";
import HeroSection from "@/components/HeroSection";
import ArticleGrid from "@/components/ArticleGrid";
import SpaceBar from "@/components/SpaceBar";
import SolarSystem from "@/components/SolarSystem";
import LangSwitcher from "@/components/LangSwitcher";

export default function HomePageHr() {
  const articles = getAllArticlesHr();
  const featured = articles[0] ?? null;

  if (!featured) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <img src="/logo.jpg" alt="TECH & SPACE" className="w-20 h-20 mx-auto mb-6 rounded-xl" />
        <h1 className="font-heading text-4xl font-bold mb-4">TECH & SPACE</h1>
        <p className="text-text-secondary text-lg font-mono">
          // Nema članaka u bazi. Čekamo prvu transmisiju...
        </p>
      </div>
    );
  }

  const gridArticles = articles.filter((a) => a.id !== featured.id);
  const latestPerCategory = articles.reduce<typeof articles>((acc, a) => {
    if (!acc.find((x) => x.category === a.category)) acc.push(a);
    return acc;
  }, []);

  return (
    <>
      <LangSwitcher lang="hr" href="/" />
      <div className="fixed inset-0 pointer-events-none opacity-[0.15] z-0">
        <SolarSystem interactive />
      </div>
      <HeroSection featured={featured} latestPerCategory={latestPerCategory} />
      <SpaceBar />
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <h2 className="section-header font-heading text-2xl font-bold text-text-primary mb-6">
          Najnovije vijesti
        </h2>
        <ArticleGrid articles={gridArticles} basePath="/hr" />
      </section>
    </>
  );
}
