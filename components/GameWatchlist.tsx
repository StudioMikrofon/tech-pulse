"use client";

import { useState } from "react";
import { Gamepad2, ChevronDown, ChevronUp, ExternalLink, Play } from "lucide-react";

// ---------------------------------------------------------------------------
// Game Watchlist — tracked upcoming / in-development titles
// ---------------------------------------------------------------------------

interface TrackedGame {
  id: string;
  name: string;
  developer: string;
  publisher?: string;
  status: "announced" | "in_dev" | "alpha" | "beta" | "delayed" | "upcoming";
  releaseWindow: string;
  platforms: string[];
  engine?: string;
  summary: string;
  trailerUrl?: string;   // YouTube watch URL
  officialUrl?: string;
  accentColor: string;   // CSS color for border/highlight
  tags: string[];
}

const GAMES: TrackedGame[] = [
  {
    id: "witcher4",
    name: "The Witcher 4",
    developer: "CD Projekt Red",
    publisher: "CD Projekt",
    status: "in_dev",
    releaseWindow: "TBD — Unreal Engine 5",
    platforms: ["PC", "PS5", "Xbox Series X|S"],
    engine: "Unreal Engine 5",
    summary:
      "Codename Polaris. Nova trilogija — nova protagonistica: Ciri. REDengine 4 → UE5 prelazak. Revealed na The Game Awards 2024. Nema datuma.",
    trailerUrl: "https://www.youtube.com/watch?v=VHXtKFSrxhQ",
    officialUrl: "https://www.thewitcher.com",
    accentColor: "#a855f7",
    tags: ["RPG", "Open World", "AAA"],
  },
  {
    id: "gta6",
    name: "GTA VI",
    developer: "Rockstar Games",
    publisher: "Take-Two Interactive",
    status: "delayed",
    releaseWindow: "2026 (odgođeno s 2025)",
    platforms: ["PS5", "Xbox Series X|S", "PC (kasnije)"],
    summary:
      "Jason i Lucia, Florida / Vice City okruženje. Trailer 1 rekordnih 100M pogleda u 24h. PC verzija dolazi kasnije. Najveći budžet u gaming historiji (~$2B).",
    trailerUrl: "https://www.youtube.com/watch?v=QdBZExpgErs",
    officialUrl: "https://www.rockstargames.com/VI",
    accentColor: "#f59e0b",
    tags: ["Open World", "Action", "AAA"],
  },
  {
    id: "unrecord",
    name: "UNRECORD",
    developer: "DRAMA",
    status: "announced",
    releaseWindow: "TBD — no date",
    platforms: ["PC"],
    engine: "Unreal Engine 5",
    summary:
      "Bodycam shooter koji izgleda kao real life footage. Lumen + Nanite + motion blur. Indie studio iz Francuske. Viral zbog hyperrealizma. Demo video izazvao debate je li CGI ili stvarnost.",
    trailerUrl: "https://www.youtube.com/watch?v=oLkUFfwhRFY",
    accentColor: "#34d399",
    tags: ["FPS", "Indie", "UE5"],
  },
  {
    id: "starcitizen",
    name: "Star Citizen",
    developer: "Cloud Imperium Games",
    publisher: "Roberts Space Industries",
    status: "alpha",
    releaseWindow: "Alpha 4.0 LIVE — Squadron 42 TBD",
    platforms: ["PC"],
    engine: "lumberyard → Star Engine",
    summary:
      "Alpha 4.0 s Pyro sustavom. Crowdfunding $700M+. Squadron 42 singleplayer kampanja u finalnoj polish fazi. MMO space sim bez presedana u opsegu. Server meshing tehnologija live.",
    trailerUrl: "https://www.youtube.com/watch?v=e3C_cyEZF5s",
    officialUrl: "https://robertsspaceindustries.com",
    accentColor: "#00d4ff",
    tags: ["Space Sim", "MMO", "Alpha"],
  },
];

const STATUS_CONFIG = {
  announced: { label: "Announced",  color: "#94a3b8" },
  in_dev:    { label: "In Dev",     color: "#a855f7" },
  alpha:     { label: "Alpha Live", color: "#00d4ff" },
  beta:      { label: "Beta",       color: "#34d399" },
  delayed:   { label: "Delayed",    color: "#f59e0b" },
  upcoming:  { label: "Upcoming",   color: "#34d399" },
};

function GameCard({ game }: { game: TrackedGame }) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_CONFIG[game.status];

  return (
    <div
      className="rounded-lg border overflow-hidden transition-all duration-200"
      style={{ borderColor: `${game.accentColor}25` }}
    >
      {/* Header */}
      <button
        className="w-full text-left p-3 flex items-start gap-2 hover:bg-white/3 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[11px] font-mono font-bold"
              style={{ color: game.accentColor }}
            >
              {game.name}
            </span>
            <span
              className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ background: `${st.color}20`, color: st.color }}
            >
              {st.label}
            </span>
          </div>
          <p className="text-[9px] font-mono text-text-secondary mt-0.5">
            {game.developer}
            {game.engine && <span className="opacity-60"> · {game.engine}</span>}
          </p>
          <p className="text-[9px] font-mono mt-0.5" style={{ color: `${game.accentColor}90` }}>
            {game.releaseWindow}
          </p>
        </div>
        <div className="shrink-0 mt-0.5">
          {expanded
            ? <ChevronUp className="w-3 h-3 text-text-secondary" />
            : <ChevronDown className="w-3 h-3 text-text-secondary" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: `${game.accentColor}15` }}>
          {/* Summary */}
          <p className="text-[10px] text-text-secondary leading-relaxed mt-2 font-mono">
            {game.summary}
          </p>

          {/* Platforms */}
          <div className="flex flex-wrap gap-1">
            {game.platforms.map((p) => (
              <span key={p} className="text-[8px] font-mono px-1 py-0.5 rounded bg-white/5 text-text-secondary">
                {p}
              </span>
            ))}
            {game.tags.map((t) => (
              <span key={t} className="text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: `${game.accentColor}15`, color: game.accentColor }}>
                {t}
              </span>
            ))}
          </div>

          {/* Action links */}
          <div className="flex gap-2 pt-1">
            {game.trailerUrl && (
              <a
                href={game.trailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded transition-colors"
                style={{ background: `${game.accentColor}15`, color: game.accentColor }}
              >
                <Play className="w-2.5 h-2.5" />
                Trailer
              </a>
            )}
            {game.officialUrl && (
              <a
                href={game.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded bg-white/5 text-text-secondary hover:text-text-primary transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Official
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GameWatchlist() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Gamepad2 className="w-4 h-4 text-purple-400" />
        <h3 className="text-xs font-semibold text-text-primary font-mono tracking-wider">GAME RADAR</h3>
        <span className="text-[8px] font-mono text-text-secondary ml-auto">{GAMES.length} tracked</span>
      </div>
      {GAMES.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </div>
  );
}
