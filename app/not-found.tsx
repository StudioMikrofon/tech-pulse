import Link from "next/link";
import { ArrowLeft, Orbit } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <Orbit className="w-16 h-16 text-accent-cyan/40 mx-auto mb-6" />
      <h1 className="font-heading text-6xl font-bold text-text-primary mb-4">
        404
      </h1>
      <p className="text-xl text-text-secondary mb-8">
        Lost in space. This page doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg text-accent-cyan font-semibold hover:bg-accent-cyan/20 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>
    </div>
  );
}
