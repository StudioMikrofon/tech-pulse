"use client";

import Link from "next/link";

interface LangSwitcherProps {
  lang: "en" | "hr";
  href: string;
}

export default function LangSwitcher({ lang, href }: LangSwitcherProps) {
  return (
    <div className="flex justify-end px-4 pt-2 pb-1">
      <Link
        href={href}
        className="flex items-center gap-1.5 text-xs font-mono text-text-secondary/60 hover:text-accent-cyan border border-white/10 hover:border-accent-cyan/30 rounded-lg px-3 py-1.5 transition-all"
        title={lang === "hr" ? "Switch to English" : "Prebaci na hrvatski"}
      >
        {lang === "hr" ? (
          <><span>🇬🇧</span> <span>EN</span></>
        ) : (
          <><span>🇭🇷</span> <span>HR</span></>
        )}
      </Link>
    </div>
  );
}
