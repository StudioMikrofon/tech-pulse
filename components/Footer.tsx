import Link from "next/link";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/types";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img
                src="/logo.jpg"
                alt="TECH AND SPACE"
                className="w-8 h-8 rounded-md object-cover"
              />
              <span className="font-heading text-lg font-bold text-text-primary">
                TECH AND SPACE
              </span>
            </div>
            <p className="text-sm text-text-secondary">
              Your portal to the future. Tech &amp; space news from around the globe.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">
              Categories
            </h3>
            <div className="grid grid-cols-2 gap-1">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat}
                  href={`/category/${cat}`}
                  className="text-sm text-text-secondary hover:text-accent-cyan transition-colors"
                >
                  {CATEGORY_LABELS[cat]}
                </Link>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">
              About
            </h3>
            <p className="text-sm text-text-secondary">
              Automated tech news aggregation powered by OpenClaw. Content is
              curated and published via Git-based automation pipeline.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-xs text-text-secondary">
            &copy; {new Date().getFullYear()} TECH AND SPACE. Built with Next.js.
          </p>
        </div>
      </div>
    </footer>
  );
}
