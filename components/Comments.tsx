"use client";

import Giscus from "@giscus/react";

interface CommentsProps {
  term: string; // article ID or path used to map to a discussion
}

export default function Comments({ term }: CommentsProps) {
  return (
    <div className="mt-10 pt-8 border-t border-white/10">
      <h3 className="text-lg font-heading font-bold text-text-primary mb-6 flex items-center gap-2">
        <span className="text-accent-cyan/60 font-mono text-sm">//</span>
        Comments
      </h3>
      <Giscus
        id="comments"
        repo="StudioMikrofon/tech-pulse"
        repoId="R_kgDORQbw1Q"
        category="Article comments"
        categoryId="DIC_kwDORQbw1c4C2g7i"
        mapping="specific"
        term={term}
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="top"
        theme="dark_tritanopia"
        lang="en"
        loading="lazy"
      />
    </div>
  );
}
