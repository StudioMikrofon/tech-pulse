"use client";

interface YouTubeEmbedProps {
  id: string;
  title?: string;
}

export default function YouTubeEmbed({ id, title }: YouTubeEmbedProps) {
  return (
    <div className="glass-card overflow-hidden my-8">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`}
          title={title ?? "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
}
