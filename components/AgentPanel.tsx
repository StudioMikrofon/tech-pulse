"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface AgentResponse {
  action?: string;
  content?: string;
  original?: string;   // exact original text for global DOM find-replace (rewrite action)
  explanation?: string;
  error?: string;
  endpoint?: string;
  payload?: Record<string, unknown>;
}

interface LassoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TaskItem {
  id: string;
  prompt: string;
  summary: string;
  raw: string;
}

type SelectMode = "click" | "lasso";
type PanelTab = "agent" | "tasks";

const MODELS = [
  { key: "claude-opus",       label: "Claude Opus 4.6", badge: "★", provider: "anthropic" },
  { key: "claude-sonnet",     label: "Claude Sonnet",   badge: "🧠", provider: "anthropic" },
  { key: "claude-haiku",      label: "Claude Haiku",    badge: "⚡", provider: "anthropic" },
  { key: "gpt-5-nano",        label: "GPT-5 Nano",      badge: "⚡", provider: "openai" },
  { key: "gpt-5-mini",        label: "GPT-5 Mini",      badge: "🧠", provider: "openai" },
  { key: "mistral-small",     label: "Mistral Small",   badge: "⚡", provider: "mistral" },
  { key: "mistral-large",     label: "Mistral Large",   badge: "🧠", provider: "mistral" },
  { key: "open-mistral-nemo", label: "Mistral Nemo",    badge: "🆓", provider: "mistral" },
] as const;

type ModelKey = typeof MODELS[number]["key"];

export default function AgentPanel() {
  const [open, setOpen]                   = useState(false);
  const [tab, setTab]                     = useState<PanelTab>("agent");
  const [selectedModel, setSelectedModel] = useState<ModelKey>("gpt-5-nano");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [selectMode, setSelectMode]       = useState<SelectMode>("click");
  const [selecting, setSelecting]         = useState(false);
  const [selectedText, setSelectedText]   = useState("");
  const [selectedEl, setSelectedEl]       = useState<HTMLElement | null>(null);
  const [selectedInfo, setSelectedInfo]   = useState("");
  const [instruction, setInstruction]     = useState("");
  const [loading, setLoading]             = useState(false);
  const [response, setResponse]           = useState<AgentResponse | null>(null);
  const [applied, setApplied]             = useState(false);
  const [progress, setProgress]           = useState(0);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendResult, setBackendResult]   = useState<{ ok: boolean; msg: string; imageUrl?: string } | null>(null);
  const progressRef                       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Task builder state
  const [taskInput, setTaskInput]         = useState("");
  const [taskLoading, setTaskLoading]     = useState(false);
  const [tasks, setTasks]                 = useState<TaskItem[]>([]);
  const [copied, setCopied]               = useState(false);
  const [tasksLoaded, setTasksLoaded]     = useState(false);

  // Claude Code execution state
  const [runStatus, setRunStatus]         = useState<{ status: string; step: string; log?: string } | null>(null);
  const runPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Article DB ID resolved from URL (for article pages)
  const [pageArticleDbId, setPageArticleDbId] = useState<number | null>(null);

  // Voice recording state
  const [recording, setRecording]         = useState(false);
  const [transcribing, setTranscribing]   = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);

  // Lasso state
  const [lassoActive, setLassoActive] = useState(false);
  const [lassoRect, setLassoRect]     = useState<LassoRect | null>(null);
  const lassoStart = useRef<{ x: number; y: number } | null>(null);

  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const taskInputRef    = useRef<HTMLTextAreaElement>(null);
  const applyTargetRef  = useRef<HTMLElement | null>(null); // preserved after clearSelection
  const undoTextRef     = useRef<{ node: Text; original: string } | null>(null);

  // ── PROGRESS BAR ─────────────────────────────────────────────────────────
  const startProgress = () => {
    setProgress(0);
    if (progressRef.current) clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(progressRef.current!); return p; }
        return p + (90 - p) * 0.08;
      });
    }, 200);
  };

  const finishProgress = () => {
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 600);
  };

  // Persist tasks server-side (cross-device sync) with localStorage fallback
  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data) && data.length) setTasks(data); })
      .catch(() => {
        try {
          const stored = localStorage.getItem("tp-agent-tasks");
          if (stored) setTasks(JSON.parse(stored));
        } catch {}
      })
      .finally(() => setTasksLoaded(true));
  }, []);

  useEffect(() => {
    if (!tasksLoaded) return;
    fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tasks) }).catch(() => {});
    try { localStorage.setItem("tp-agent-tasks", JSON.stringify(tasks)); } catch {}
  }, [tasks, tasksLoaded]);

  // Resolve article DB ID from URL when on an article page
  useEffect(() => {
    const match = window.location.pathname.match(/^\/(?:hr\/)?article\/[^/]+\/(.+)$/);
    if (!match) return;
    const slug = match[1];
    fetch(`/api/editorial?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (d.id) setPageArticleDbId(Number(d.id)); })
      .catch(() => {});
  }, []);

  const getPageContext = () => {
    const h1      = document.querySelector("h1")?.textContent ?? "";
    const badge   = document.querySelector("[class*='category']")?.textContent ?? "";
    const path    = window.location.pathname;
    // Use resolved article DB ID (from URL fetch) or fallback to DOM attribute
    const domId   = document.querySelector("[data-article-db-id]")?.getAttribute("data-article-db-id") ?? "";
    const artId   = pageArticleDbId ?? (domId ? Number(domId) : null);
    return [badge, h1, artId ? `Article #${artId}` : "", `page: ${path}`].filter(Boolean).join(" — ").slice(0, 300);
  };

  // ── CLICK SELECT ───────────────────────────────────────────────────────────
  const handleMouseOver = useCallback((e: MouseEvent) => {
    const el = e.target as HTMLElement;
    if (!el || el.closest("#agent-panel")) return;
    el.dataset.agentHover = "true";
  }, []);

  const handleMouseOut = useCallback((e: MouseEvent) => {
    const el = e.target as HTMLElement;
    delete el.dataset.agentHover;
  }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    if (!selecting || selectMode !== "click") return;
    const el = e.target as HTMLElement;
    if (el.closest("#agent-panel")) return;
    e.preventDefault();
    e.stopPropagation();

    if (selectedEl) delete selectedEl.dataset.agentSelected;
    el.dataset.agentSelected = "true";
    setSelectedEl(el);

    const tag = el.tagName.toLowerCase();
    const cls = el.className?.toString().slice(0, 80) ?? "";
    setSelectedInfo(`<${tag}> ${cls}`);
    setSelectedText(el.innerText?.slice(0, 800) ?? "");
    setSelecting(false);
    setResponse(null);
    setApplied(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [selecting, selectMode, selectedEl]);

  useEffect(() => {
    if (selecting && selectMode === "click") {
      document.addEventListener("mouseover", handleMouseOver, true);
      document.addEventListener("mouseout", handleMouseOut, true);
      document.addEventListener("click", handleClick, true);
      document.body.style.cursor = "crosshair";
    } else {
      document.removeEventListener("mouseover", handleMouseOver, true);
      document.removeEventListener("mouseout", handleMouseOut, true);
      document.removeEventListener("click", handleClick, true);
      if (!lassoActive) document.body.style.cursor = "";
    }
    return () => {
      document.removeEventListener("mouseover", handleMouseOver, true);
      document.removeEventListener("mouseout", handleMouseOut, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, [selecting, selectMode, lassoActive, handleMouseOver, handleMouseOut, handleClick]);

  // ── LASSO SELECT ───────────────────────────────────────────────────────────
  const collectTextInRect = (rect: LassoRect): string => {
    const seen = new Set<HTMLElement>();
    const step = 16;
    const texts: string[] = [];
    for (let x = rect.x; x < rect.x + rect.w; x += step) {
      for (let y = rect.y; y < rect.y + rect.h; y += step) {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        if (!el || el.closest("#agent-panel") || seen.has(el)) continue;
        seen.add(el);
        const text = el.innerText?.trim();
        if (text && text.length > 0 && text.length < 500) texts.push(text);
      }
    }
    return [...new Set(texts)].join("\n").slice(0, 1200);
  };

  const handleLassoMouseDown = useCallback((e: MouseEvent) => {
    if (!lassoActive) return;
    if ((e.target as HTMLElement).closest("#agent-panel")) return;
    e.preventDefault();
    lassoStart.current = { x: e.clientX, y: e.clientY };
    setLassoRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  }, [lassoActive]);

  const handleLassoMouseMove = useCallback((e: MouseEvent) => {
    if (!lassoActive || !lassoStart.current) return;
    const sx = lassoStart.current.x, sy = lassoStart.current.y;
    setLassoRect({ x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY), w: Math.abs(e.clientX - sx), h: Math.abs(e.clientY - sy) });
  }, [lassoActive]);

  const handleLassoMouseUp = useCallback((e: MouseEvent) => {
    if (!lassoActive || !lassoStart.current) return;
    e.preventDefault();
    const sx = lassoStart.current.x, sy = lassoStart.current.y;
    const rect: LassoRect = { x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY), w: Math.abs(e.clientX - sx), h: Math.abs(e.clientY - sy) };
    if (rect.w > 10 && rect.h > 10) {
      const text = collectTextInRect(rect);
      setSelectedText(text);
      setSelectedInfo(`Lasso ${Math.round(rect.w)}×${Math.round(rect.h)}px`);
      setSelectedEl(null);
      setResponse(null);
      setApplied(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
    lassoStart.current = null;
    setLassoRect(null);
    setLassoActive(false);
    document.body.style.cursor = "";
  }, [lassoActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lassoActive) {
      document.addEventListener("mousedown", handleLassoMouseDown, true);
      document.addEventListener("mousemove", handleLassoMouseMove, true);
      document.addEventListener("mouseup", handleLassoMouseUp, true);
      document.body.style.cursor = "crosshair";
    } else {
      document.removeEventListener("mousedown", handleLassoMouseDown, true);
      document.removeEventListener("mousemove", handleLassoMouseMove, true);
      document.removeEventListener("mouseup", handleLassoMouseUp, true);
    }
    return () => {
      document.removeEventListener("mousedown", handleLassoMouseDown, true);
      document.removeEventListener("mousemove", handleLassoMouseMove, true);
      document.removeEventListener("mouseup", handleLassoMouseUp, true);
    };
  }, [lassoActive, handleLassoMouseDown, handleLassoMouseMove, handleLassoMouseUp]);

  useEffect(() => {
    return () => {
      document.querySelectorAll("[data-agent-selected]").forEach((el) => {
        delete (el as HTMLElement).dataset.agentSelected;
      });
    };
  }, []);

  // Full clear (for explicit cancel/close)
  const clearSelection = () => {
    if (selectedEl) delete selectedEl.dataset.agentSelected;
    setSelectedEl(null);
    setSelectedText("");
    setSelectedInfo("");
    setResponse(null);
    setApplied(false);
    setSelecting(false);
    setLassoActive(false);
    document.body.style.cursor = "";
  };

  // Clears only the selection UI state — does NOT touch response (used after send)
  const resetSelectionUI = () => {
    if (selectedEl) delete selectedEl.dataset.agentSelected;
    setSelectedEl(null);
    setSelectedText("");
    setSelectedInfo("");
    setSelecting(false);
    setLassoActive(false);
    document.body.style.cursor = "";
  };

  // ── AGENT SEND ─────────────────────────────────────────────────────────────
  const send = async () => {
    if (!instruction.trim() && !selectedText) return;
    setLoading(true);
    setResponse(null);
    setApplied(false);
    setBackendResult(null);
    startProgress();

    // Preserve the target element for apply (clearSelection resets selectedEl)
    applyTargetRef.current = selectedEl;

    // Build full message that always includes selected content
    const fullInstruction = selectedText
      ? `[Odabrani sadržaj]\n${selectedInfo ? selectedInfo + "\n" : ""}${selectedText.trim().slice(0, 600)}\n\n[Zadatak] ${instruction.trim()}`
      : instruction.trim();

    // When nothing is selected, grab article body so agent can find text to replace
    const bodyContext = !selectedText
      ? (document.querySelector("article")?.innerText ?? document.querySelector("main")?.innerText ?? "").slice(0, 2000)
      : "";

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: fullInstruction,
          selectedText,
          selectedInfo,
          pageContext: getPageContext(),
          bodyContext,
          model: selectedModel,
        }),
      });
      const data: AgentResponse = await res.json();
      setResponse(data);
    } catch {
      setResponse({ error: "Network error" });
    } finally {
      finishProgress();
      setLoading(false);
      // Clear selection UI only — keep response visible
      resetSelectionUI();
      setInstruction("");
    }
  };

  // Walk all text nodes in the page and replace first occurrence of `original` with `replacement`
  const replaceTextInDom = (original: string, replacement: string): boolean => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n as Text);
    for (const textNode of nodes) {
      if (textNode.parentElement?.closest("#agent-panel")) continue;
      if (textNode.textContent?.includes(original)) {
        undoTextRef.current = { node: textNode, original: textNode.textContent };
        textNode.textContent = textNode.textContent.replace(original, replacement);
        return true;
      }
    }
    return false;
  };

  // Replace the first article image on the page with a new URL
  const replacePageImage = (imageUrl: string): boolean => {
    const selectors = ["article img", "main img", "[class*='hero'] img", "[class*='aspect-video'] img", "img[class*='aspect']"];
    for (const sel of selectors) {
      const img = document.querySelector(sel) as HTMLImageElement | null;
      if (img && !img.closest("#agent-panel")) { img.src = imageUrl; return true; }
    }
    const allImgs = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
    const target = allImgs.find(img => !img.closest("#agent-panel") && img.offsetWidth > 100);
    if (target) { target.src = imageUrl; return true; }
    return false;
  };

  const applyRewrite = () => {
    if (!response?.content) return;
    const target = applyTargetRef.current;
    if (target) {
      // Targeted replace — user selected a specific element
      if (!target.dataset.agentOriginal) target.dataset.agentOriginal = target.innerText;
      target.innerText = response.content;
      setApplied(true);
    } else if (response.original) {
      // Global DOM text-node find-and-replace
      const ok = replaceTextInDom(response.original, response.content);
      if (ok) setApplied(true);
    }
  };

  const undoRewrite = () => {
    const target = applyTargetRef.current;
    if (target?.dataset.agentOriginal) {
      target.innerText = target.dataset.agentOriginal;
      delete target.dataset.agentOriginal;
      setApplied(false);
    } else if (undoTextRef.current) {
      undoTextRef.current.node.textContent = undoTextRef.current.original;
      undoTextRef.current = null;
      setApplied(false);
    }
  };

  const applyStyle = () => {
    if (!response?.content) return;
    let styleEl = document.getElementById("agent-injected-style") as HTMLStyleElement | null;
    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "agent-injected-style"; document.head.appendChild(styleEl); }
    styleEl.textContent += "\n" + response.content;
    setApplied(true);
  };

  const undoStyle = () => {
    document.getElementById("agent-injected-style")?.remove();
    setApplied(false);
  };

  const applyBackendCall = async () => {
    if (!response?.endpoint || !response?.payload) return;
    setBackendLoading(true);
    setBackendResult(null);

    // If agent couldn't find article ID but we have it from URL fetch, inject it
    const payload = { ...response.payload };
    if (payload.id == null && pageArticleDbId) payload.id = pageArticleDbId;

    try {
      const res = await fetch(response.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const rd = await res.json().catch(() => ({}));
        const msg = rd.imageUrl
          ? `Slika generirana — URL: ${rd.imageUrl}`
          : (rd.message || "Zahtjev poslan uspješno.");
        setBackendResult({ ok: true, msg, imageUrl: rd.imageUrl });
      } else {
        const d = await res.json().catch(() => ({}));
        setBackendResult({ ok: false, msg: d.error || `Greška ${res.status}` });
      }
    } catch {
      setBackendResult({ ok: false, msg: "Mrežna greška." });
    } finally {
      setBackendLoading(false);
    }
  };

  // ── TASK BUILDER ───────────────────────────────────────────────────────────
  const addTask = async () => {
    if (!taskInput.trim()) return;
    setTaskLoading(true);
    const capturedText = selectedText;
    const capturedInfo = selectedInfo;
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: taskInput,
          selectedText: capturedText,
          selectedInfo: capturedInfo,
          model: selectedModel,
          mode: "reformulate",
        }),
      });
      const data: AgentResponse = await res.json();
      if (data.content && !data.error) {
        setTasks((prev) => [...prev, {
          id: Date.now().toString(),
          prompt: data.content!,
          summary: data.explanation || taskInput.slice(0, 60),
          raw: taskInput,
        }]);
        setTaskInput("");
        // Clear selection after task is added — unlock buttons
        clearSelection();
      }
    } catch {
      // silently fail
    } finally {
      setTaskLoading(false);
    }
  };

  const removeTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const copyAll = () => {
    if (!tasks.length) return;
    const combined = tasks.map((t, i) => `### Task ${i + 1}\n${t.prompt}`).join("\n\n");
    navigator.clipboard.writeText(combined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── CLAUDE CODE EXECUTION ──────────────────────────────────────────────────
  const startPoll = () => {
    if (runPollRef.current) clearInterval(runPollRef.current);
    runPollRef.current = setInterval(async () => {
      const res = await fetch("/api/run-status").catch(() => null);
      if (!res) return;
      const data = await res.json().catch(() => null);
      if (!data) return;
      setRunStatus(data);
      if (data.status === "done" || data.status === "error") {
        clearInterval(runPollRef.current!);
        runPollRef.current = null;
      }
    }, 3000);
  };

  const runWithClaude = async () => {
    if (!tasks.length) return;
    setRunStatus({ status: "running", step: "Starting..." });
    startPoll();
    await fetch("/api/run-tasks", { method: "POST" }).catch(() => null);
  };

  // ── VOICE RECORDING ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcribeAudio(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      alert("Mikrofon nije dostupan.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setTranscribing(true);
  };

  const transcribeAudio = async (blob: Blob) => {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (data.polished) {
        setTaskInput((prev) => (prev ? prev + " " + data.polished : data.polished));
        setTimeout(() => taskInputRef.current?.focus(), 50);
      }
    } catch {
      // silently fail
    } finally {
      setTranscribing(false);
    }
  };

  // ── CLOSED STATE ───────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Open Agent Editor"
        className="fixed bottom-6 right-6 z-[9999] w-12 h-12 rounded-full bg-accent-cyan text-space-bg font-bold text-lg shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
        style={{ boxShadow: "0 0 20px rgba(0,255,255,0.4)" }}
      >
        ✦
      </button>
    );
  }

  // ── OPEN ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        [data-agent-hover]:not([data-agent-selected]) {
          outline: 2px dashed rgba(0,255,255,0.5) !important;
          outline-offset: 2px;
        }
        [data-agent-selected] {
          outline: 2px solid rgba(0,255,255,0.9) !important;
          outline-offset: 2px;
          background: rgba(0,255,255,0.04) !important;
        }
      `}</style>

      {/* Lasso rectangle */}
      {lassoRect && lassoRect.w > 4 && lassoRect.h > 4 && (
        <div style={{ position: "fixed", left: lassoRect.x, top: lassoRect.y, width: lassoRect.w, height: lassoRect.h, border: "2px solid rgba(0,255,255,0.9)", background: "rgba(0,255,255,0.06)", pointerEvents: "none", zIndex: 9998, boxShadow: "0 0 12px rgba(0,255,255,0.3)" }} />
      )}

      <div
        id="agent-panel"
        className="fixed bottom-6 right-6 z-[9999] w-80 rounded-xl border border-white/10 bg-space-bg/95 backdrop-blur shadow-2xl flex flex-col overflow-hidden"
        style={{ boxShadow: "0 0 40px rgba(0,255,255,0.15), 0 8px 32px rgba(0,0,0,0.5)" }}
      >
        {/* Progress bar */}
        {progress > 0 && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-10">
            <div
              className="h-full bg-accent-cyan transition-all duration-200"
              style={{ width: `${progress}%`, boxShadow: "0 0 8px rgba(0,255,255,0.8)" }}
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-0">
            {(["agent", "tasks"] as PanelTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${tab === t ? "text-accent-cyan bg-accent-cyan/10" : "text-text-secondary hover:text-text-primary"}`}
              >
                {t === "agent" ? "✦ AGENT" : `⊞ TASKS${tasks.length ? ` (${tasks.length})` : ""}`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setModelMenuOpen((v) => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-white/5 hover:border-accent-cyan/40 text-text-secondary hover:text-text-primary text-xs font-mono transition-all"
              >
                {MODELS.find((m) => m.key === selectedModel)?.label ?? selectedModel}
                <span className="text-[10px] opacity-50">▾</span>
              </button>
              {modelMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-white/10 bg-space-bg shadow-xl z-10 overflow-hidden">
                  {MODELS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => { setSelectedModel(m.key); setModelMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono hover:bg-white/5 transition-colors ${selectedModel === m.key ? "text-accent-cyan" : "text-text-secondary"}`}
                    >
                      <span>{m.label}</span>
                      <span className="opacity-40 text-[10px]">{m.badge}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => { clearSelection(); setModelMenuOpen(false); setOpen(false); }}
              className="text-text-secondary hover:text-text-primary text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── AGENT TAB ── */}
        {tab === "agent" && (
          <div className="p-4 flex flex-col gap-3">
            {/* Selection mode buttons — disabled while loading */}
            <div className="flex gap-2">
              <button
                onClick={() => { setLassoActive(false); clearSelection(); setSelectMode("click"); setSelecting(true); }}
                disabled={loading}
                className={`flex-1 py-2 px-2 rounded-lg border text-xs font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed ${selecting && selectMode === "click" ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan animate-pulse" : "border-white/20 text-text-secondary hover:border-accent-cyan/50 hover:text-text-primary"}`}
              >
                {selecting && selectMode === "click" ? "⊹ Klikni..." : "⊹ Klikni element"}
              </button>
              <button
                onClick={() => { setSelecting(false); clearSelection(); setSelectMode("lasso"); setLassoActive(true); }}
                disabled={loading}
                className={`flex-1 py-2 px-2 rounded-lg border text-xs font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed ${lassoActive ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan animate-pulse" : "border-white/20 text-text-secondary hover:border-accent-cyan/50 hover:text-text-primary"}`}
              >
                {lassoActive ? "⊹ Razvuci..." : "⊹ Lasso select"}
              </button>
            </div>

            {/* Selected preview */}
            {selectedText && (
              <div className="relative">
                {selectedInfo && <p className="text-accent-cyan/50 text-[10px] font-mono mb-1 truncate">{selectedInfo}</p>}
                <div className="rounded-lg bg-white/5 border border-accent-cyan/30 px-3 py-2 text-xs text-text-secondary font-mono leading-relaxed max-h-24 overflow-y-auto">
                  {selectedText.slice(0, 200)}{selectedText.length > 200 ? "…" : ""}
                </div>
                <button onClick={clearSelection} className="absolute top-1 right-2 text-text-secondary/50 hover:text-text-secondary text-xs">×</button>
              </div>
            )}

            {/* Instruction */}
            <textarea
              ref={textareaRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
              placeholder={selectedText ? "Što napraviti s ovim? (Ctrl+Enter)" : "Odaberi element ili postavi pitanje..."}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 font-mono resize-none focus:outline-none focus:border-accent-cyan/50 transition-colors"
            />

            <button
              onClick={send}
              disabled={loading || (!instruction.trim() && !selectedText)}
              className="w-full py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/40 text-accent-cyan text-sm font-mono hover:bg-accent-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Obrađujem..." : "Pošalji  ↵"}
            </button>

            {/* Response */}
            {response && (
              <div className="rounded-lg border border-white/10 bg-white/3 p-3 text-sm">
                {response.error ? (
                  <p className="text-red-400 font-mono text-xs">{response.error}</p>
                ) : (
                  <>
                    {response.explanation && <p className="text-text-secondary text-xs font-mono mb-2 italic">{response.explanation}</p>}
                    <div className="text-text-primary leading-relaxed max-h-36 overflow-y-auto text-xs font-mono whitespace-pre-wrap bg-black/20 rounded p-2">{response.content}</div>
                    {response.action === "rewrite" && (
                      <div className="flex gap-2 mt-2">
                        {(applyTargetRef.current || response.original) ? (
                          !applied
                            ? <button onClick={applyRewrite} className="flex-1 py-1 rounded bg-accent-cyan/20 border border-accent-cyan/40 text-accent-cyan text-xs font-mono hover:bg-accent-cyan/30 transition-all">▶ Apply na stranicu</button>
                            : <button onClick={undoRewrite} className="flex-1 py-1 rounded bg-white/10 border border-white/20 text-text-secondary text-xs font-mono hover:bg-white/20 transition-all">Undo</button>
                        ) : (
                          <span className="flex-1 text-[10px] font-mono text-text-secondary/40 py-1">Odaberi element za Apply</span>
                        )}
                        <button onClick={() => navigator.clipboard.writeText(response.content ?? "")} className="px-3 py-1 rounded bg-white/5 border border-white/10 text-text-secondary text-xs font-mono hover:bg-white/10 transition-all">Copy</button>
                      </div>
                    )}
                    {response.action === "style" && (
                      <div className="flex gap-2 mt-2">
                        {!applied ? <button onClick={applyStyle} className="flex-1 py-1 rounded bg-accent-cyan/20 border border-accent-cyan/40 text-accent-cyan text-xs font-mono hover:bg-accent-cyan/30 transition-all">Apply na stranicu</button>
                          : <button onClick={undoStyle} className="flex-1 py-1 rounded bg-white/10 border border-white/20 text-text-secondary text-xs font-mono hover:bg-white/20 transition-all">Undo</button>}
                        <button onClick={() => navigator.clipboard.writeText(response.content ?? "")} className="px-3 py-1 rounded bg-white/5 border border-white/10 text-text-secondary text-xs font-mono hover:bg-white/10 transition-all">Copy</button>
                      </div>
                    )}
                    {response.action === "info" && (
                      <button onClick={() => navigator.clipboard.writeText(response.content ?? "")} className="mt-2 w-full py-1 rounded bg-white/5 border border-white/10 text-text-secondary text-xs font-mono hover:bg-white/10 transition-all">Copy</button>
                    )}
                    {response.action === "backend_call" && (
                      <div className="mt-2 flex flex-col gap-2">
                        <div className="text-[10px] font-mono text-text-secondary/50 px-1">
                          <span className="text-accent-cyan/60">endpoint:</span> {response.endpoint}
                          {response.payload && (response.payload as Record<string,unknown>).id == null && (
                            <span className="ml-2 text-yellow-400/60">⚠ ID nije pronađen</span>
                          )}
                        </div>
                        {backendResult && (
                          <div className={`text-xs font-mono px-2 py-1 rounded border ${backendResult.ok ? "border-green-400/30 bg-green-400/10 text-green-400" : "border-red-400/30 bg-red-400/10 text-red-400"}`}>
                            {backendResult.ok ? "✓ " : "✗ "}{backendResult.imageUrl ? "Slika generirana:" : backendResult.msg}
                          </div>
                        )}
                        {backendResult?.imageUrl && (
                          <div className="rounded overflow-hidden border border-white/10">
                            <img src={backendResult.imageUrl} alt="Generated" className="w-full" />
                            <div className="flex bg-black/20">
                              <button
                                onClick={() => { const ok = replacePageImage(backendResult.imageUrl!); setApplied(ok); }}
                                className="flex-1 text-center text-[9px] font-mono text-accent-cyan/70 hover:text-accent-cyan py-1.5 hover:bg-white/5 transition-colors"
                              >
                                {applied ? "✓ Zamijenjeno" : "🔄 Zamijeni sliku na stranici"}
                              </button>
                              <a href={backendResult.imageUrl} target="_blank" rel="noreferrer" className="px-2 text-[9px] font-mono text-text-secondary/30 hover:text-accent-cyan py-1.5">↗</a>
                            </div>
                          </div>
                        )}
                        {(!backendResult || !backendResult.ok) && (
                          <button
                            onClick={() => { setBackendResult(null); applyBackendCall(); }}
                            disabled={backendLoading}
                            className="w-full py-1.5 rounded bg-accent-cyan/20 border border-accent-cyan/40 text-accent-cyan text-xs font-mono hover:bg-accent-cyan/30 disabled:opacity-40 disabled:cursor-wait transition-all"
                          >
                            {backendLoading ? "⟳ Šaljem..." : backendResult ? "↺ Pokušaj ponovo" : "▶ Apply"}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <p className="text-text-secondary/30 text-xs font-mono text-center">Izmjene su samo preview. Kopiraj tekst za spremanje.</p>
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {tab === "tasks" && (
          <div className="p-4 flex flex-col gap-3">
            <p className="text-[10px] font-mono text-text-secondary/50 leading-relaxed">
              Opiši problem casual jezikom → agent ga pretvori u profesionalni prompt koji možeš dati Claude Code-u.
            </p>

            {/* Context (optional) */}
            {selectedText && (
              <div className="relative">
                <p className="text-accent-cyan/50 text-[10px] font-mono mb-1 truncate">Context: {selectedInfo}</p>
                <div className="rounded bg-white/5 border border-accent-cyan/20 px-2 py-1.5 text-[10px] text-text-secondary font-mono max-h-14 overflow-hidden">
                  {selectedText.slice(0, 120)}…
                </div>
                <button onClick={clearSelection} className="absolute top-0 right-0 text-text-secondary/40 hover:text-text-secondary text-xs px-1">×</button>
              </div>
            )}
            {!selectedText && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setLassoActive(false); clearSelection(); setSelectMode("click"); setSelecting(true); }}
                  disabled={taskLoading}
                  className={`flex-1 py-1.5 rounded-lg border text-[10px] font-mono transition-all disabled:opacity-30 ${selecting && selectMode === "click" ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan animate-pulse" : "border-white/15 text-text-secondary/50 hover:border-white/30 hover:text-text-secondary"}`}
                >
                  {selecting && selectMode === "click" ? "⊹ Klikni..." : "⊹ Klikni"}
                </button>
                <button
                  onClick={() => { setSelecting(false); clearSelection(); setSelectMode("lasso"); setLassoActive(true); }}
                  disabled={taskLoading}
                  className={`flex-1 py-1.5 rounded-lg border text-[10px] font-mono transition-all disabled:opacity-30 ${lassoActive ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan animate-pulse" : "border-white/15 text-text-secondary/50 hover:border-white/30 hover:text-text-secondary"}`}
                >
                  {lassoActive ? "⊹ Razvuci..." : "⊹ Lasso"}
                </button>
              </div>
            )}

            {/* Input */}
            <textarea
              ref={taskInputRef}
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addTask(); }}
              placeholder={"npr. 'taj gumb je premali i ne vidi se dobro'"}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/30 font-mono resize-none focus:outline-none focus:border-accent-cyan/40 transition-colors"
            />

            {/* Mic + Add row */}
            <div className="flex gap-2">
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                title={recording ? "Zaustavi snimanje" : "Diktuj task glasom"}
                className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center text-base transition-all ${
                  recording
                    ? "border-red-400/60 bg-red-400/10 text-red-400 animate-pulse"
                    : transcribing
                    ? "border-white/10 bg-white/5 text-text-secondary/40 cursor-wait"
                    : "border-white/15 bg-white/5 text-text-secondary/60 hover:border-accent-cyan/40 hover:text-accent-cyan"
                }`}
              >
                {transcribing ? "⟳" : recording ? "⏹" : "🎙"}
              </button>
              <button
                onClick={addTask}
                disabled={taskLoading || !taskInput.trim()}
                className="flex-1 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs font-mono hover:bg-accent-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {taskLoading ? "⟳ Pretvaram u prompt..." : "+ Dodaj na listu"}
              </button>
            </div>

            {/* Task list */}
            {tasks.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-text-secondary/40">{tasks.length} task{tasks.length > 1 ? "s" : ""}</span>
                <button
                  onClick={() => { setTasks([]); }}
                  className="text-[9px] font-mono text-red-400/50 hover:text-red-400 transition-colors px-1"
                  title="Izbriši sve taskove"
                >
                  🗑 Izbriši sve
                </button>
              </div>
            )}
            {tasks.length > 0 && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {tasks.map((task, i) => (
                  <div key={task.id} className="rounded-lg bg-white/4 border border-white/8 p-2.5 group">
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[9px] font-mono text-accent-cyan/50 shrink-0">#{i + 1}</span>
                      <p className="text-[10px] font-mono text-text-secondary/60 flex-1 leading-relaxed italic truncate">{task.summary}</p>
                      <button onClick={() => removeTask(task.id)} className="text-text-secondary/20 hover:text-red-400/60 text-xs shrink-0 transition-colors opacity-0 group-hover:opacity-100">×</button>
                    </div>
                    <p className="text-[10px] font-mono text-text-primary/70 leading-relaxed line-clamp-3">{task.prompt}</p>
                    <button
                      onClick={() => navigator.clipboard.writeText(task.prompt)}
                      className="mt-1.5 text-[8px] font-mono text-text-secondary/30 hover:text-accent-cyan/60 transition-colors"
                    >
                      copy →
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tasks.length > 1 && (
              <button
                onClick={copyAll}
                className={`w-full py-2 rounded-lg border text-xs font-mono transition-all ${copied ? "border-green-400/40 bg-green-400/10 text-green-400" : "border-white/15 bg-white/3 text-text-secondary hover:border-accent-cyan/30 hover:text-text-primary"}`}
              >
                {copied ? "✓ Kopirano!" : `↗ Kopiraj sve ${tasks.length} prompta`}
              </button>
            )}

            {tasks.length > 0 && (
              <button
                onClick={runWithClaude}
                disabled={runStatus?.status === "running"}
                className={`w-full py-2 rounded-lg border text-xs font-mono transition-all ${
                  runStatus?.status === "running"
                    ? "border-accent-cyan/60 bg-accent-cyan/10 text-accent-cyan animate-pulse cursor-wait"
                    : runStatus?.status === "done"
                    ? "border-green-400/40 bg-green-400/10 text-green-400"
                    : runStatus?.status === "error"
                    ? "border-red-400/40 bg-red-400/10 text-red-400"
                    : "border-accent-cyan/30 bg-accent-cyan/5 text-accent-cyan hover:bg-accent-cyan/15"
                }`}
              >
                {runStatus?.status === "running"
                  ? `⟳ ${runStatus.step}`
                  : runStatus?.status === "done"
                  ? "✓ Done — reload to see changes"
                  : runStatus?.status === "error"
                  ? `✗ ${runStatus.step}`
                  : `▶ Run ${tasks.length} task${tasks.length > 1 ? "s" : ""} with Claude Code`}
              </button>
            )}

            {tasks.length === 0 && (
              <p className="text-center text-[10px] font-mono text-text-secondary/25 py-2">
                Lista je prazna. Dodaj prvi task gore.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
