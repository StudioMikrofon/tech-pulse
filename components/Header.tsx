"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Volume2, VolumeX, Telescope } from "lucide-react";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { playSound, isSoundEnabled, setSoundEnabled } from "@/lib/sounds";
import dynamic from "next/dynamic";

const SpaceProDrawer = dynamic(() => import("./SpaceProDrawer"), { ssr: false });

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [spaceProOpen, setSpaceProOpen] = useState(false);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playSound("click");
  };

  return (
    <header className="sticky top-0 z-50 glass-card !rounded-none !border-x-0 !border-t-0">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <img
            src="/logo.jpg"
            alt="TECH & SPACE"
            className="w-9 h-9 rounded-md object-cover group-hover:brightness-125 transition-all"
          />
          <span className="font-heading text-xl font-bold text-text-primary">
            TECH & SPACE
          </span>
          <span className="live-dot ml-1" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/category/${cat}`}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
              onMouseEnter={() => playSound("hover")}
              onClick={() => playSound("click")}
            >
              {CATEGORY_LABELS[cat]}
            </Link>
          ))}
          <button
            onClick={() => {
              playSound("click");
              setSpaceProOpen(true);
            }}
            onMouseEnter={() => playSound("hover")}
            className="px-3 py-1.5 text-sm text-accent-cyan hover:text-text-primary hover:bg-accent-cyan/10 rounded-lg transition-colors border border-accent-cyan/20 hover:border-accent-cyan/40 flex items-center gap-1.5 ml-2"
          >
            <Telescope className="w-3.5 h-3.5" />
            Space Pro
          </button>
        </nav>

        <div className="flex items-center gap-1">
          {/* Sound toggle */}
          <button
            className="p-2 text-text-secondary hover:text-accent-cyan transition-colors"
            onClick={toggleSound}
            aria-label={soundOn ? "Mute sounds" : "Enable sounds"}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav className="md:hidden glass-card !rounded-t-none !border-t-0 px-4 pb-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/category/${cat}`}
              className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {CATEGORY_LABELS[cat]}
            </Link>
          ))}
        </nav>
      )}
      <SpaceProDrawer open={spaceProOpen} onClose={() => setSpaceProOpen(false)} />
    </header>
  );
}
