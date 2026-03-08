import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const PYTHON = "/opt/openclaw/futurepulse/venv/bin/python3";
const FP_DIR = "/opt/openclaw/futurepulse";

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_AGENT_PANEL !== "true") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, image_type, model, title, category } = await req.json();

  // model: "qwen" (default) | "openai" (explicit only)
  const provider  = model === "openai" ? '"openai"' : '"qwen"';
  const typeLabel = image_type ? `(${image_type})` : "(obje)";

  // ── PATH A: Pipeline article (has DB id) ──────────────────────────────────
  if (id) {
    const regenType = image_type === "main" || image_type === "subtitle" ? `"${image_type}"` : "None";
    const script = `
import sys, asyncio
sys.path.insert(0, '.')
import logging
logging.basicConfig(filename='logs/image_regen.log', level=logging.INFO)
from agents.image_gen import ImageGenerator
import sqlite3

async def run():
    conn = sqlite3.connect('db/futurepulse.db')
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT id,title,title_en,subtitle,subtitle_en,category,part1,part1_en,part2,part2_en,body_md FROM articles WHERE id=?",
        (${id},)
    ).fetchone()
    conn.close()
    if not row:
        print("Article not found")
        return
    gen = ImageGenerator()
    result = await gen.generate_for_article(dict(row), regen_type=${regenType}, force_provider=${provider})
    if result and result.get("success"):
        print(f"Regen OK #{${id}}")
        from core.vps_publisher import refresh_article_images
        refresh_article_images(${id})
    else:
        print(f"Regen FAILED: {result}")

asyncio.run(run())
`;
    const proc = spawn(PYTHON, ["-c", script], { cwd: FP_DIR, detached: true, stdio: "ignore" });
    proc.unref();
    return NextResponse.json({ ok: true, message: `Regeneracija slike ${typeLabel} pokrenuta (~30s)` });
  }

  // ── PATH B: No DB id — generate from title/category, return URL directly ──
  if (!title) return NextResponse.json({ error: "Missing id or title" }, { status: 400 });

  const safeTitle    = (title as string).replace(/'/g, "\\'").slice(0, 200);
  const safeCategory = ((category as string) || "tech").replace(/'/g, "\\'").slice(0, 30);
  const safeProvider = provider;

  const scriptB = `
import sys, asyncio, json
sys.path.insert(0, '.')
from core.api_pool import APIPool

async def run():
    pool = APIPool()
    prompt = f"Editorial photograph for tech news article: {repr('${safeTitle}')}. Category: ${safeCategory}. Cinematic lighting, dark sci-fi aesthetic, no text, no UI elements."
    result = await pool.generate_image(prompt, style='illustration', size='1024x576', force_provider=${safeProvider})
    print(json.dumps(result))

asyncio.run(run())
`;

  return new Promise<NextResponse>((resolve) => {
    let out = "";
    const proc = spawn(PYTHON, ["-c", scriptB], { cwd: FP_DIR });
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", async () => {
      try {
        const result = JSON.parse(out.trim());
        if (result.url) {
          // Download and save locally so URL doesn't expire
          try {
            const imgRes = await fetch(result.url);
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              const ext = result.url.includes(".png") ? "png" : "jpg";
              const filename = `gen-${Date.now()}.${ext}`;
              const dir = join(process.cwd(), "public", "gen");
              await mkdir(dir, { recursive: true });
              await writeFile(join(dir, filename), buf);
              resolve(NextResponse.json({ ok: true, imageUrl: `/gen/${filename}`, message: "Slika generirana" }));
              return;
            }
          } catch {
            // fallback to original URL if download fails
          }
          resolve(NextResponse.json({ ok: true, imageUrl: result.url, message: "Slika generirana" }));
        } else {
          resolve(NextResponse.json({ error: result.error || "Image gen failed" }, { status: 500 }));
        }
      } catch {
        resolve(NextResponse.json({ error: "Parse error: " + out.slice(0, 200) }, { status: 500 }));
      }
    });
    proc.on("error", (e: Error) => resolve(NextResponse.json({ error: e.message }, { status: 500 })));
    // 60s timeout
    setTimeout(() => resolve(NextResponse.json({ error: "Timeout" }, { status: 504 })), 60000);
  });
}
