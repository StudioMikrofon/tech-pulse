"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Edit3,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Youtube,
} from "lucide-react";

interface Article {
  id: number;
  title: string;
  title_en: string;
  category: string;
  status: string;
  pipeline_stage: string;
  approved: number;
  github_uploaded: number;
  chosen_ending: string | null;
  part1: string;
  part1_en: string;
  part2: string;
  part2_en: string;
  subtitle: string;
  subtitle_en: string;
  endings_json: string; // JSON: {"A": "...", "B": "...", "C": "..."}
  endings_en: string;   // JSON: {"A": "...", "B": "...", "C": "..."}
  images_json: string;  // JSON: {"image_main": {"url": "..."}, "image_subtitle": {"url": "..."}}
  source_url: string | null;
  source_name: string | null;
  created_at: string;
  published_at: string | null;
}

type Tab = "pending" | "published";
type LangTab = "hr" | "en";
type Ending = "A" | "B" | "C";

function resolveImgUrl(url: string): string {
  if (!url) return "";
  // Convert /images/img_XYZ.jpg → /fp-images/img_XYZ.jpg
  if (url.startsWith("/images/img_")) {
    return url.replace("/images/", "/fp-images/");
  }
  // Leave https:// URLs and other paths as-is
  return url;
}

function parseImages(json: string) {
  try {
    const imgs = JSON.parse(json || "{}");
    return {
      main: resolveImgUrl((imgs.image_main || {}).url || ""),
      subtitle: resolveImgUrl((imgs.image_subtitle || {}).url || ""),
    };
  } catch { return { main: "", subtitle: "" }; }
}

function parseEndings(json: string): Record<string, string> {
  try { return JSON.parse(json || "{}"); } catch { return {}; }
}

function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return m ? m[1] : null;
}

function Field({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-mono text-text-secondary/50 mb-1">{label}</label>
      {rows === 1 ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan/40"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan/40 resize-y font-mono"
        />
      )}
    </div>
  );
}

function ArticleCard({
  article,
  onPublish,
  onReject,
  selected,
  onToggleSelect,
}: {
  article: Article;
  onPublish: (id: number) => void;
  onReject: (id: number) => void;
  selected: boolean;
  onToggleSelect: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [langTab, setLangTab] = useState<LangTab>("hr");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedEnding, setSelectedEnding] = useState<Ending | null>(
    (article.chosen_ending as Ending) || null
  );
  const [fields, setFields] = useState({
    title: article.title ?? "",
    title_en: article.title_en ?? "",
    part1: article.part1 ?? "",
    part1_en: article.part1_en ?? "",
    part2: article.part2 ?? "",
    part2_en: article.part2_en ?? "",
    subtitle: article.subtitle ?? "",
    subtitle_en: article.subtitle_en ?? "",
  });

  const imgs = parseImages(article.images_json);
  const endingsHr = parseEndings(article.endings_json);
  const endingsEn = parseEndings(article.endings_en);
  const ytId = extractYoutubeId(article.source_url);

  const statusColor: Record<string, string> = {
    published: "text-green-400",
    approved: "text-blue-400",
    pending: "text-yellow-400",
    rejected: "text-red-400",
    rewrite: "text-orange-400",
  };
  const sColor = statusColor[article.status] || "text-text-secondary";

  const endingsForLang = langTab === "hr" ? endingsHr : endingsEn;
  const hasEndings = Object.keys(endingsHr).length > 0 || Object.keys(endingsEn).length > 0;

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: article.id, ...fields }),
    });
    setSaving(false);
    setEditing(false);
  };

  const handlePublish = async () => {
    if (!selectedEnding) return;
    setPublishing(true);
    const r = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: article.id, action: "publish", chosen_ending: selectedEnding }),
    });
    const data = await r.json();
    alert(data.message || "Publish pokrenut");
    onPublish(article.id);
    setPublishing(false);
  };

  const handleReject = async () => {
    if (!confirm(`Odbiti članak #${article.id}?`)) return;
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: article.id, action: "reject" }),
    });
    onReject(article.id);
  };

  return (
    <div
      className={`glass-card p-4 mb-3 transition-all ${
        selected ? "border border-accent-cyan/40" : ""
      }`}
    >
      {/* Collapsed header row */}
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-0.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(article.id)}
            className="w-3.5 h-3.5 accent-cyan-400 cursor-pointer"
            title="Odaberi članak"
          />
        </div>

        {imgs.main && (
          <img
            src={imgs.main}
            alt=""
            className="w-12 h-12 object-cover rounded flex-shrink-0 opacity-80"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`category-badge category-badge-${article.category} text-[9px]`}>
              {article.category}
            </span>
            <span className={`text-[10px] font-mono ${sColor}`}>{article.status}</span>
            <span className="font-mono text-xs text-text-secondary/40 ml-auto">#{article.id}</span>
          </div>
          <div className="text-sm font-semibold text-text-primary leading-tight mb-0.5 truncate">
            🇭🇷 {article.title || <span className="opacity-40">—</span>}
          </div>
          <div className="text-xs text-text-secondary/70 leading-tight truncate">
            🇬🇧 {article.title_en || <span className="opacity-40">—</span>}
          </div>
          {article.pipeline_stage && (
            <div className="font-mono text-[9px] text-text-secondary/40 mt-0.5">
              stage: {article.pipeline_stage}
            </div>
          )}
        </div>
      </div>

      {/* Collapsed action bar */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-mono border border-white/10 hover:border-white/20 rounded px-2 py-1 text-text-secondary/70 hover:text-text-primary transition-all"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Sakrij" : "▼ Prikaži"}
        </button>

        <button
          onClick={() => { setEditing(!editing); setExpanded(true); }}
          className="flex items-center gap-1 text-xs font-mono border border-white/10 hover:border-accent-cyan/30 hover:text-accent-cyan rounded px-2 py-1 text-text-secondary transition-all"
        >
          <Edit3 className="w-3 h-3" /> ✏️ Edit
        </button>

        <button
          onClick={handleReject}
          className="flex items-center gap-1 text-xs font-mono border border-red-400/20 hover:border-red-400/50 text-red-400/70 hover:text-red-400 rounded px-2 py-1 transition-all"
        >
          <XCircle className="w-3 h-3" /> 🔴 Odbij
        </button>

        {/* Quick ending buttons shown when not yet chosen and article is not published */}
        {article.status !== "published" && hasEndings && !selectedEnding && (
          <div className="flex items-center gap-1 ml-auto">
            {(["A", "B", "C"] as Ending[]).map((e) => (
              <button
                key={e}
                onClick={() => { setSelectedEnding(e); setExpanded(true); }}
                className="flex items-center gap-1 text-xs font-mono border border-white/10 hover:border-accent-cyan/40 hover:text-accent-cyan rounded px-2 py-1 text-text-secondary/60 transition-all"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {article.status === "published" && (
          <span className="ml-auto flex items-center gap-1 text-xs font-mono text-green-400">
            <CheckCircle className="w-3 h-3" /> Objavljeno
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 border-t border-white/10 pt-4 space-y-4">
          {/* Hero image */}
          {imgs.main && (
            <div className="w-full aspect-video overflow-hidden rounded-lg">
              <img src={imgs.main} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* YouTube embed */}
          {ytId && (
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black/30">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title="YouTube video"
              />
            </div>
          )}

          {/* Lang tabs */}
          <div className="flex gap-2">
            {(["hr", "en"] as LangTab[]).map((l) => (
              <button
                key={l}
                onClick={() => setLangTab(l)}
                className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                  langTab === l
                    ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                    : "text-text-secondary border border-white/10 hover:border-white/20"
                }`}
              >
                {l === "hr" ? "🇭🇷 Hrvatski" : "🇬🇧 English"}
              </button>
            ))}
          </div>

          {/* Article body */}
          {editing ? (
            <div className="space-y-3">
              {langTab === "hr" ? (
                <>
                  <Field label="🇭🇷 Naslov" value={fields.title} onChange={(v) => setFields((f) => ({ ...f, title: v }))} />
                  <Field label="🇭🇷 Part 1" value={fields.part1} onChange={(v) => setFields((f) => ({ ...f, part1: v }))} rows={6} />
                  <Field label="🇭🇷 Subtitle" value={fields.subtitle} onChange={(v) => setFields((f) => ({ ...f, subtitle: v }))} />
                  <Field label="🇭🇷 Part 2" value={fields.part2} onChange={(v) => setFields((f) => ({ ...f, part2: v }))} rows={4} />
                </>
              ) : (
                <>
                  <Field label="🇬🇧 Title (EN)" value={fields.title_en} onChange={(v) => setFields((f) => ({ ...f, title_en: v }))} />
                  <Field label="🇬🇧 Part 1 (EN)" value={fields.part1_en} onChange={(v) => setFields((f) => ({ ...f, part1_en: v }))} rows={6} />
                  <Field label="🇬🇧 Subtitle (EN)" value={fields.subtitle_en} onChange={(v) => setFields((f) => ({ ...f, subtitle_en: v }))} />
                  <Field label="🇬🇧 Part 2 (EN)" value={fields.part2_en} onChange={(v) => setFields((f) => ({ ...f, part2_en: v }))} rows={4} />
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Part 1 */}
              <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                {langTab === "hr" ? fields.part1 : fields.part1_en}
              </div>

              {/* Subtitle image */}
              {imgs.subtitle && (
                <img
                  src={imgs.subtitle}
                  alt=""
                  className="w-full object-cover rounded max-h-48"
                />
              )}

              {/* Subtitle text */}
              {(langTab === "hr" ? fields.subtitle : fields.subtitle_en) && (
                <p className="text-sm italic text-text-secondary">
                  {langTab === "hr" ? fields.subtitle : fields.subtitle_en}
                </p>
              )}

              {/* Part 2 */}
              <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                {langTab === "hr" ? fields.part2 : fields.part2_en}
              </div>
            </div>
          )}

          {/* Endings section */}
          {hasEndings && (
            <div className="space-y-2">
              <p className="font-mono text-xs text-text-secondary/50">Odaberi završetak:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["A", "B", "C"] as Ending[]).map((e) => {
                  const text = endingsForLang[e] || endingsHr[e] || "";
                  const isSelected = selectedEnding === e;
                  return (
                    <button
                      key={e}
                      onClick={() => setSelectedEnding(isSelected ? null : e)}
                      className={`text-left rounded p-2 border transition-all ${
                        isSelected
                          ? "border-accent-cyan bg-accent-cyan/10 text-text-primary"
                          : "border-white/10 hover:border-white/20 text-text-secondary/70"
                      }`}
                    >
                      <div className={`font-mono text-xs font-bold mb-1 ${isSelected ? "text-accent-cyan" : "text-text-secondary/50"}`}>
                        {e}
                      </div>
                      <div className="text-xs leading-snug">{text}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10 flex-wrap">
            {editing ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 text-xs font-mono text-green-400 border border-green-400/30 hover:border-green-400 rounded px-2 py-1 transition-all"
              >
                <Save className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
              </button>
            ) : null}

            <button
              onClick={() => setEditing(!editing)}
              className="flex items-center gap-1 text-xs font-mono border border-white/10 hover:border-accent-cyan/30 hover:text-accent-cyan rounded px-2 py-1 text-text-secondary transition-all"
            >
              <Edit3 className="w-3 h-3" /> ✏️ Edit
            </button>

            <button
              onClick={handleReject}
              className="flex items-center gap-1 text-xs font-mono border border-red-400/20 hover:border-red-400/50 text-red-400/70 hover:text-red-400 rounded px-2 py-1 transition-all"
            >
              <XCircle className="w-3 h-3" /> 🔴 Odbij
            </button>

            {article.status !== "published" && (
              <button
                onClick={handlePublish}
                disabled={publishing || !selectedEnding}
                className={`flex items-center gap-1 text-xs font-mono border rounded px-2 py-1 transition-all ml-auto ${
                  selectedEnding
                    ? "text-accent-cyan border-accent-cyan/30 hover:border-accent-cyan hover:bg-accent-cyan/10"
                    : "text-text-secondary/30 border-white/10 cursor-not-allowed"
                }`}
              >
                <CheckCircle className="w-3 h-3" />
                {publishing ? "Objavljujem..." : "✅ Objavi"}
                {selectedEnding && <span className="ml-1 opacity-60">({selectedEnding})</span>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewPanel() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    const r = await fetch(`/api/review?filter=${tab}`);
    const data = await r.json();
    setArticles(data.articles || []);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const removeArticle = (id: number) => {
    setArticles((a) => a.filter((x) => x.id !== id));
    setSelected((s) => { const next = new Set(s); next.delete(id); return next; });
  };

  const removeArticles = (ids: number[]) => {
    const idSet = new Set(ids);
    setArticles((a) => a.filter((x) => !idSet.has(x.id)));
    setSelected((s) => { const next = new Set(s); ids.forEach((id) => next.delete(id)); return next; });
  };

  const handleToggleSelect = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelected(new Set(articles.map((a) => a.id)));
  };

  const handleClearAll = () => {
    setSelected(new Set());
  };

  const handleBulkPublish = async () => {
    if (selected.size === 0) return;
    setBulkWorking(true);

    const ids = Array.from(selected);
    // Determine which have chosen_ending
    const articleMap = new Map(articles.map((a) => [a.id, a]));
    const toPublish = ids.filter((id) => {
      const a = articleMap.get(id);
      return a && a.chosen_ending;
    });
    const skipped = ids.length - toPublish.length;

    if (toPublish.length === 0) {
      alert("Nijedan odabrani članak nema odabran završetak. Odaberi završetak u kartici članka.");
      setBulkWorking(false);
      return;
    }

    try {
      const r = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_publish", ids: toPublish }),
      });
      const data = await r.json();
      const msg = skipped > 0
        ? `Objavljeno: ${data.count ?? toPublish.length}. Preskočeno (bez završetka): ${skipped}.`
        : `Objavljeno: ${data.count ?? toPublish.length}.`;
      alert(msg);
      removeArticles(toPublish);
    } catch (e) {
      alert("Greška pri bulk publish");
    }
    setBulkWorking(false);
  };

  const handleBulkReject = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Odbiti ${selected.size} odabranih članaka?`)) return;
    setBulkWorking(true);

    const ids = Array.from(selected);
    try {
      const r = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_reject", ids }),
      });
      const data = await r.json();
      alert(`Odbijeno: ${data.count ?? ids.length}.`);
      removeArticles(ids);
    } catch (e) {
      alert("Greška pri bulk reject");
    }
    setBulkWorking(false);
  };

  const selectedWithEnding = Array.from(selected).filter((id) => {
    const a = articles.find((x) => x.id === id);
    return a && a.chosen_ending;
  }).length;
  const selectedWithoutEnding = selected.size - selectedWithEnding;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-text-primary">// Review Panel</h1>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-text-secondary/40">{articles.length} članaka</span>
          <button
            onClick={load}
            className="flex items-center gap-1 text-xs font-mono text-text-secondary hover:text-accent-cyan transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Tab row + select-all link */}
      <div className="flex items-center gap-2 mb-6">
        {(["pending", "published"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-xs font-mono transition-all ${
              tab === t
                ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                : "text-text-secondary border border-white/10 hover:border-white/20"
            }`}
          >
            {t === "pending" ? "Čekaju" : "Objavljeni"}
          </button>
        ))}

        {articles.length > 0 && (
          <div className="ml-auto flex items-center gap-2 font-mono text-[10px] text-text-secondary/50">
            <button
              onClick={handleSelectAll}
              className="hover:text-accent-cyan transition-colors"
            >
              Odaberi sve
            </button>
            <span>/</span>
            <button
              onClick={handleClearAll}
              className="hover:text-text-secondary transition-colors"
            >
              Poništi sve
            </button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="glass-card p-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs text-text-secondary/70">
            ✓ {selected.size} odabrano
          </span>

          <button
            onClick={handleBulkPublish}
            disabled={bulkWorking}
            title={
              selectedWithoutEnding > 0
                ? `${selectedWithoutEnding} nema odabran završetak — bit će preskočeni`
                : "Objavi sve odabrane"
            }
            className="flex items-center gap-1 text-xs font-mono border border-accent-cyan/30 text-accent-cyan hover:border-accent-cyan hover:bg-accent-cyan/10 rounded px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-3 h-3" />
            Objavi odabrane ({selected.size})
            {selectedWithoutEnding > 0 && (
              <span className="ml-1 text-yellow-400/70 text-[9px]">⚠ {selectedWithoutEnding}</span>
            )}
          </button>

          <button
            onClick={handleBulkReject}
            disabled={bulkWorking}
            className="flex items-center gap-1 text-xs font-mono border border-red-400/20 text-red-400 hover:border-red-400/50 rounded px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-3 h-3" />
            Odbij odabrane ({selected.size})
          </button>

          <button
            onClick={handleClearAll}
            className="text-xs font-mono text-text-secondary/50 hover:text-text-secondary transition-colors ml-auto"
          >
            Poništi
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-center font-mono text-text-secondary/50 py-16">// Učitavam...</p>
      ) : articles.length === 0 ? (
        <p className="text-center font-mono text-text-secondary/50 py-16">// Nema članaka</p>
      ) : (
        articles.map((a) => (
          <ArticleCard
            key={a.id}
            article={a}
            onPublish={removeArticle}
            onReject={removeArticle}
            selected={selected.has(a.id)}
            onToggleSelect={handleToggleSelect}
          />
        ))
      )}
    </div>
  );
}
