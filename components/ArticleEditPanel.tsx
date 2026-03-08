"use client";

import { useEffect, useState } from "react";

interface ArticleData {
  id: number;
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  status: string;
  chosen_ending: string | null;
  endings_en: string | null;
  endings_json: string | null;
  part1: string;
  part1_en: string;
  part2: string;
  part2_en: string;
  images_json: string | null;
}

interface EndingMap { A?: string; B?: string; C?: string }
interface ImagesJson {
  image_main?: { url: string; prompt?: string };
  image_subtitle?: { url: string; prompt?: string };
}

type Lang = "en" | "hr";
type ImageModel = "qwen" | "openai";

export default function ArticleEditPanel({ dbId, articleSlug }: { dbId?: number; articleSlug?: string }) {
  const [data, setData]           = useState<ArticleData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lang, setLang]           = useState<Lang>("en");
  const [busy, setBusy]           = useState<string | null>(null); // which action is running
  const [msg, setMsg]             = useState<{ text: string; ok: boolean } | null>(null);
  const [regenModel, setRegenModel] = useState<Record<string, ImageModel>>({ main: "qwen", subtitle: "qwen" });
  const [regenMenuOpen, setRegenMenuOpen] = useState<string | null>(null); // "main"|"subtitle"|null

  const showMsg = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  };

  useEffect(() => {
    const qs = dbId != null && !isNaN(dbId) ? `id=${dbId}` : `slug=${encodeURIComponent(articleSlug || "")}`;
    fetch(`/api/editorial?${qs}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [dbId, articleSlug]);

  const doAction = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(action);
    const numericId = data?.id;
    try {
      const res = await fetch("/api/editorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: numericId, action, ...extra }),
      });
      const d = await res.json();
      if (d.ok) {
        showMsg(d.message || "OK");
        if (action === "ending") {
          setData((prev) => prev ? { ...prev, chosen_ending: extra?.ending as string, status: "approved" } : prev);
        } else if (action === "reject") {
          setData((prev) => prev ? { ...prev, status: "rejected" } : prev);
        } else if (action === "rewrite") {
          setData((prev) => prev ? { ...prev, status: "rewrite" } : prev);
        }
      } else {
        showMsg(d.error || "Greška", false);
      }
    } catch {
      showMsg("Network error", false);
    } finally {
      setBusy(null);
    }
  };

  const doRegen = async (imageType: "main" | "subtitle") => {
    setBusy(`regen_${imageType}`);
    setRegenMenuOpen(null);
    try {
      const res = await fetch("/api/image-regen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data?.id, image_type: imageType, model: regenModel[imageType] }),
      });
      const d = await res.json();
      showMsg(d.message || "Regen pokrenut");
    } catch {
      showMsg("Regen greška", false);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="border-t border-white/10 bg-space-bg/60 px-4 py-3 text-xs font-mono text-text-secondary/40">
        // Učitavam editorial panel...
      </div>
    );
  }

  if (!data) return null;

  const endingsEN: EndingMap = (() => { try { return JSON.parse(data.endings_en || "{}"); } catch { return {}; } })();
  const endingsHR: EndingMap = (() => { try { return JSON.parse(data.endings_json || "{}"); } catch { return {}; } })();
  const endings = lang === "en" ? endingsEN : endingsHR;
  const images: ImagesJson = (() => { try { return JSON.parse(data.images_json || "{}"); } catch { return {}; } })();

  const statusColor: Record<string, string> = {
    published: "text-green-400",
    approved: "text-blue-400",
    pending: "text-yellow-400",
    rejected: "text-red-400",
    rewrite: "text-orange-400",
  };

  const ENDING_KEYS = (["A", "B", "C"] as const).filter((k) => endings[k]);

  return (
    <div className="mt-8 border-t border-accent-cyan/20 bg-space-bg/80 backdrop-blur" data-article-db-id={data.id}>
      {/* Header bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/8">
        <span className="text-[10px] font-mono text-text-secondary/40">// EDITORIAL</span>
        <span className="text-[10px] font-mono text-text-secondary/30">#{data.id}</span>
        <span className={`text-[10px] font-mono ml-1 ${statusColor[data.status] ?? "text-text-secondary"}`}>
          {data.status}
        </span>
        {data.chosen_ending && (
          <span className="text-[10px] font-mono text-accent-cyan/60">ending: {data.chosen_ending}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {/* EN/HR toggle */}
          {(["en", "hr"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                lang === l
                  ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                  : "text-text-secondary/40 hover:text-text-secondary border border-transparent"
              }`}
            >
              {l === "en" ? "🇬🇧 EN" : "🇭🇷 HR"}
            </button>
          ))}
        </div>
      </div>

      {/* Content preview */}
      <div className="px-5 py-3 space-y-2 border-b border-white/8">
        <p className="text-xs font-semibold text-text-primary leading-snug">
          {lang === "en" ? data.title_en : data.title}
        </p>
        {(lang === "en" ? data.subtitle_en : data.subtitle) && (
          <p className="text-[11px] text-text-secondary/60 italic leading-snug">
            {lang === "en" ? data.subtitle_en : data.subtitle}
          </p>
        )}
        {(lang === "en" ? data.part1_en : data.part1) && (
          <p className="text-[11px] text-text-secondary/50 font-mono leading-relaxed line-clamp-3">
            {(lang === "en" ? data.part1_en : data.part1).slice(0, 300)}…
          </p>
        )}
      </div>

      {/* Endings */}
      {ENDING_KEYS.length > 0 && (
        <div className="px-5 py-3 border-b border-white/8">
          <p className="text-[9px] font-mono text-text-secondary/30 mb-2">// ZAVRŠETCI — klikni za publish</p>
          <div className="space-y-2">
            {ENDING_KEYS.map((k) => (
              <div
                key={k}
                className={`rounded-lg border px-3 py-2 cursor-pointer transition-all group ${
                  data.chosen_ending === k
                    ? "border-accent-cyan/50 bg-accent-cyan/8"
                    : "border-white/10 hover:border-accent-cyan/30 hover:bg-white/3"
                }`}
                onClick={() => {
                  if (busy) return;
                  if (!confirm(`Publish s završetkom ${k}?`)) return;
                  doAction("ending", { ending: k });
                }}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-[10px] font-mono font-bold shrink-0 mt-0.5 ${
                    data.chosen_ending === k ? "text-accent-cyan" : "text-text-secondary/40 group-hover:text-accent-cyan/60"
                  }`}>
                    [{k}]
                  </span>
                  <p className="text-[11px] text-text-secondary/70 leading-relaxed">
                    {endings[k]!.slice(0, 200)}{endings[k]!.length > 200 ? "…" : ""}
                  </p>
                  {busy === "ending" && data.chosen_ending === k && (
                    <span className="shrink-0 text-[10px] font-mono text-accent-cyan animate-pulse">⟳</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewrite / Reject */}
      <div className="px-5 py-3 flex gap-2 border-b border-white/8">
        <button
          onClick={() => { if (busy) return; if (!confirm("Označiti za prepis?")) return; doAction("rewrite"); }}
          disabled={!!busy}
          className="flex-1 py-1.5 rounded-lg border border-orange-400/25 text-orange-400/70 hover:border-orange-400/50 hover:text-orange-400 text-xs font-mono transition-all disabled:opacity-30"
        >
          {busy === "rewrite" ? "⟳" : "✎ Prepiši"}
        </button>
        <button
          onClick={() => { if (busy) return; if (!confirm(`Odbiti članak #${data?.id}?`)) return; doAction("reject"); }}
          disabled={!!busy}
          className="flex-1 py-1.5 rounded-lg border border-red-400/25 text-red-400/70 hover:border-red-400/50 hover:text-red-400 text-xs font-mono transition-all disabled:opacity-30"
        >
          {busy === "reject" ? "⟳" : "✕ Odbij"}
        </button>
      </div>

      {/* Images */}
      {(images.image_main || images.image_subtitle) && (
        <div className="px-5 py-3 border-b border-white/8">
          <p className="text-[9px] font-mono text-text-secondary/30 mb-3">// SLIKE — regeneriraj po potrebi</p>
          <div className="grid grid-cols-2 gap-3">
            {(["main", "subtitle"] as const).map((type) => {
              const img = type === "main" ? images.image_main : images.image_subtitle;
              const label = type === "main" ? "Hero" : "Podnaslov";
              if (!img?.url) return null;
              return (
                <div key={type} className="space-y-1.5">
                  <img
                    src={img.url}
                    alt={label}
                    className="w-full aspect-video object-cover rounded-lg opacity-80"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-text-secondary/30 flex-1">{label}</span>
                    <div className="relative">
                      <button
                        onClick={() => setRegenMenuOpen(regenMenuOpen === type ? null : type)}
                        disabled={!!busy}
                        className="text-[9px] font-mono px-2 py-0.5 rounded border border-white/10 text-text-secondary/50 hover:border-accent-cyan/30 hover:text-accent-cyan transition-all disabled:opacity-30"
                      >
                        {busy === `regen_${type}` ? "⟳ ..." : "↻ Regen ▾"}
                      </button>
                      {regenMenuOpen === type && (
                        <div className="absolute right-0 bottom-full mb-1 w-32 rounded-lg border border-white/10 bg-space-bg shadow-xl z-50 overflow-hidden">
                          {(["qwen", "openai"] as ImageModel[]).map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                setRegenModel((prev) => ({ ...prev, [type]: m }));
                                doRegen(type);
                              }}
                              className={`w-full text-left px-3 py-2 text-[10px] font-mono hover:bg-white/5 transition-colors ${
                                regenModel[type] === m ? "text-accent-cyan" : "text-text-secondary"
                              }`}
                            >
                              {m === "qwen" ? "⚡ Qwen Image" : "🧠 GPT Image"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {img.prompt && (
                    <p className="text-[8px] font-mono text-text-secondary/25 leading-tight line-clamp-2">{img.prompt.slice(0, 80)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status message */}
      {msg && (
        <div className={`px-5 py-2 text-xs font-mono ${msg.ok ? "text-green-400/80" : "text-red-400/80"}`}>
          {msg.ok ? "✓" : "✗"} {msg.text}
        </div>
      )}

      <div className="px-5 py-2 text-[9px] font-mono text-text-secondary/20">
        // Sve promjene idu i na glavni site (techand.space) automatski
      </div>
    </div>
  );
}
