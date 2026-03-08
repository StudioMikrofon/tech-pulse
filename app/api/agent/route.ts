import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const REFORMULATE_PROMPT = `You are a developer prompt rephraser. Your ONLY job is to take the user's casual description and rephrase it as a professional, technical development request — nothing more.

STRICT RULES:
- Do NOT add suggestions, planning steps, or anything the user did not explicitly mention
- Do NOT propose solutions or approaches
- Do NOT expand scope beyond exactly what the user described
- ONLY rephrase the user's exact words more professionally and technically
- The output must represent the same intent as the input — same scope, just more precise language

Return ONLY valid JSON:
{
  "action": "prompt",
  "content": "the professionally rephrased English prompt, 1-3 sentences",
  "explanation": "one-line Croatian summary"
}

The prompt must be in English regardless of input language. Never include placeholders. Never ask clarifying questions.`;

const SYSTEM_PROMPT = `You are a powerful editorial agent embedded in TECH & SPACE — a dark sci-fi tech news portal (Next.js). You have full access to edit anything on the page AND trigger backend pipeline operations.

═══ TYPE 1: TEXT / VISUAL EDITS ═══

Use action "rewrite" to change any text on the page (titles, body, subtitles, any text).
Use action "style" to inject CSS changes.
Use action "info" to answer questions.

CRITICAL RULE FOR REWRITE: You MUST include BOTH fields:
- "content": the NEW text to replace with
- "original": the EXACT verbatim original text from the page (copy it character-for-character)
The system will do an automatic find-and-replace in the DOM using "original" as the search key.
If you don't include "original", the Apply button won't work. Always include it.

═══ TYPE 2: BACKEND OPERATIONS ═══

1. GENERATE / REGENERATE IMAGE:
   endpoint: "/api/image-regen"
   payload: { "id": <db_id number or null>, "image_type": "main", "model": "qwen", "title": "<h1 text>", "category": "<category>" }
   - ALWAYS include "title" (from the page h1) and "category" regardless of whether id is null or not
   - Default model is ALWAYS "qwen". Use "openai" ONLY if user explicitly asks for it
   - "image_type": use "main" for hero image, "subtitle" for middle image, null for auto

2. PUBLISH with ending:
   endpoint: "/api/editorial"
   payload: { "id": <db_id>, "action": "ending", "ending": "A" | "B" | "C" }

3. Mark for rewrite:
   endpoint: "/api/editorial"
   payload: { "id": <db_id>, "action": "rewrite" }

4. Reject article:
   endpoint: "/api/editorial"
   payload: { "id": <db_id>, "action": "reject" }

HOW TO FIND db_id: In page context you'll see "db#150" — that number is the db_id. Extract ONLY the number (e.g. 150). If you don't see it, set id to null.

═══ RESPONSE FORMAT ═══

For text/visual edits:
{
  "action": "rewrite",
  "content": "replacement text here",
  "original": "EXACT original text from page to find",
  "explanation": "one line in user's language"
}

For CSS changes:
{
  "action": "style",
  "content": "CSS rules here",
  "explanation": "one line"
}

For information/answers:
{
  "action": "info",
  "content": "answer here",
  "explanation": ""
}

For backend calls:
{
  "action": "backend_call",
  "endpoint": "/api/image-regen",
  "payload": { "id": null, "image_type": "main", "model": "qwen", "title": "Article Title Here", "category": "ai" },
  "content": "What will happen",
  "explanation": "one line"
}

LANGUAGE: Always respond in the same language the user writes in (Croatian if they write in Croatian).
IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no explanation outside JSON.`;

const MODELS: Record<string, { provider: "openai" | "anthropic" | "mistral"; id: string; label: string }> = {
  "gpt-5-nano":          { provider: "openai",    id: "gpt-5-nano",                    label: "GPT-5 Nano" },
  "gpt-5-mini":          { provider: "openai",    id: "gpt-5-mini",                    label: "GPT-5 Mini" },
  "claude-opus":         { provider: "anthropic", id: "claude-opus-4-6",               label: "Claude Opus 4.6" },
  "claude-haiku":        { provider: "anthropic", id: "claude-haiku-4-5-20251001",      label: "Claude Haiku" },
  "claude-sonnet":       { provider: "anthropic", id: "claude-sonnet-4-6",              label: "Claude Sonnet" },
  "mistral-small":       { provider: "mistral",   id: "mistral-small-latest",           label: "Mistral Small" },
  "mistral-large":       { provider: "mistral",   id: "mistral-large-latest",           label: "Mistral Large" },
  "open-mistral-nemo":   { provider: "mistral",   id: "open-mistral-nemo",              label: "Mistral Nemo" },
};

async function callOpenAI(model: string, userMessage: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_completion_tokens: 16000,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "{}";
}

async function callMistral(model: string, userMessage: string): Promise<string> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMessage }],
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "{}";
}

async function callAnthropic(model: string, userMessage: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || "{}";
}

export async function POST(req: NextRequest) {
  const { instruction, selectedText, selectedInfo, pageContext, bodyContext, model: modelKey = "gpt-5-nano", mode } = await req.json();

  if (!instruction?.trim()) {
    return NextResponse.json({ error: "No instruction provided" }, { status: 400 });
  }

  const modelDef = MODELS[modelKey] ?? MODELS["gpt-5-nano"];

  // Reformulate mode — turn casual description into a professional dev prompt
  if (mode === "reformulate") {
    const refMessage = [
      selectedText ? `SELECTED ELEMENT:\n${selectedInfo ? `${selectedInfo}\n` : ""}${selectedText.trim().slice(0, 400)}` : null,
      `USER DESCRIPTION: ${instruction.trim()}`,
    ].filter(Boolean).join("\n\n");

    try {
      let raw: string;
      if (modelDef.provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({ model: modelDef.id, messages: [{ role: "system", content: REFORMULATE_PROMPT }, { role: "user", content: refMessage }], max_completion_tokens: 4000 }),
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}`);
        const d = await res.json();
        raw = d.choices?.[0]?.message?.content || "{}";
      } else if (modelDef.provider === "mistral") {
        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
          body: JSON.stringify({ model: modelDef.id, messages: [{ role: "system", content: REFORMULATE_PROMPT }, { role: "user", content: refMessage }], max_tokens: 1000 }),
        });
        if (!res.ok) throw new Error(`Mistral ${res.status}`);
        const d = await res.json();
        raw = d.choices?.[0]?.message?.content || "{}";
      } else {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: modelDef.id, system: REFORMULATE_PROMPT, messages: [{ role: "user", content: refMessage }], max_tokens: 1000 }),
        });
        if (!res.ok) throw new Error(`Anthropic ${res.status}`);
        const d = await res.json();
        raw = d.content?.[0]?.text || "{}";
      }
      const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
      try { return NextResponse.json(JSON.parse(cleaned)); }
      catch { return NextResponse.json({ action: "prompt", content: cleaned, explanation: "" }); }
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  if (modelDef.provider === "openai" && !OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }
  if (modelDef.provider === "anthropic" && !ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Anthropic API key not configured — add ANTHROPIC_API_KEY to .env.local" }, { status: 500 });
  }

  const userMessage = [
    selectedText ? `SELECTED ELEMENT ON PAGE:\n${selectedInfo ? `Element: ${selectedInfo}\n` : ""}Text content:\n${selectedText.trim().slice(0, 800)}` : null,
    pageContext ? `PAGE CONTEXT:\n${pageContext.trim().slice(0, 400)}` : null,
    bodyContext ? `ARTICLE BODY TEXT (use this to find exact "original" text for rewrite):\n${bodyContext.trim().slice(0, 2000)}` : null,
    `USER INSTRUCTION: ${instruction.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    let raw: string;
    if (modelDef.provider === "openai") {
      raw = await callOpenAI(modelDef.id, userMessage);
    } else if (modelDef.provider === "mistral") {
      raw = await callMistral(modelDef.id, userMessage);
    } else {
      raw = await callAnthropic(modelDef.id, userMessage);
    }

    // Strip markdown code blocks if present
    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { action: "info", content: cleaned, explanation: "" };
    }

    return NextResponse.json(parsed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
