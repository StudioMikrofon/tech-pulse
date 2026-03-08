import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const tmpPath = join(tmpdir(), `audio_${Date.now()}_${Math.random().toString(36).slice(2)}.webm`);

  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File | null;
    if (!file) return NextResponse.json({ error: "No audio file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(tmpPath, buffer);

    // Whisper transcription
    const { createReadStream } = await import("fs");
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(tmpPath) as Parameters<typeof openai.audio.transcriptions.create>[0]["file"],
      model: "whisper-1",
      language: "hr",
    });
    const transcript = transcription.text;

    // Delete temp file immediately
    if (existsSync(tmpPath)) unlinkSync(tmpPath);

    // Polish with GPT — task-writing style, no reformulation
    const polish = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a task description polisher. The user speaks casually in Croatian (or mixed language).
Your ONLY job: take the raw speech transcript and write it as a clear, concise task description.
RULES:
- Fix transcription errors and filler words (um, uh, "znači", "ono")
- Keep the user's exact intent — do NOT add suggestions or expand scope
- Output language: Croatian if input is Croatian, English if English
- 1-3 sentences max
- Return ONLY the polished task text, no JSON, no explanation`,
        },
        { role: "user", content: transcript },
      ],
      max_tokens: 200,
    });

    const polished = polish.choices[0]?.message?.content?.trim() ?? transcript;

    return NextResponse.json({ transcript, polished });
  } catch (e: unknown) {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
