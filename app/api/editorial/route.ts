import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { spawn } from "child_process";

const DB_PATH = "/opt/openclaw/futurepulse/db/futurepulse.db";
const PYTHON  = "/opt/openclaw/futurepulse/venv/bin/python3";
const FP_DIR  = "/opt/openclaw/futurepulse";

function checkAuth() {
  return process.env.NEXT_PUBLIC_AGENT_PANEL === "true";
}

function getDb() {
  return new Database(DB_PATH, { readonly: false });
}

const FIELDS = `id, title, title_en, subtitle, subtitle_en, status, chosen_ending,
                endings_json, endings_en, part1, part1_en, part2, part2_en, images_json`;

// GET /api/editorial?id=150  OR  /api/editorial?slug=2026-03-07-some-article-slug
export async function GET(req: NextRequest) {
  if (!checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  const slug = params.get("slug");

  if (!id && !slug) return NextResponse.json({ error: "Missing id or slug" }, { status: 400 });

  try {
    const db = getDb();
    let row: Record<string, unknown> | undefined;

    if (id && !isNaN(Number(id))) {
      // Numeric ID lookup
      row = db.prepare(`SELECT ${FIELDS} FROM articles WHERE id = ?`).get(Number(id)) as typeof row;
    } else {
      // Slug lookup: strip leading date prefix (YYYY-MM-DD-) then LIKE match
      const rawSlug = slug || id || "";
      const slugPart = rawSlug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
      row = db.prepare(`SELECT ${FIELDS} FROM articles WHERE slug LIKE ? LIMIT 1`).get(slugPart + "%") as typeof row;
    }

    db.close();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/editorial
// body: { id, action: "ending"|"reject"|"rewrite", ending?: "A"|"B"|"C" }
export async function POST(req: NextRequest) {
  if (!checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id, action, ending } = await req.json();
    if (!id || !action) return NextResponse.json({ error: "Missing id or action" }, { status: 400 });

    const db = getDb();

    if (action === "reject") {
      db.prepare("UPDATE articles SET status='rejected' WHERE id=?").run(id);
      db.close();
      return NextResponse.json({ ok: true, message: "Odbijen" });
    }

    if (action === "rewrite") {
      db.prepare("UPDATE articles SET status='rewrite' WHERE id=?").run(id);
      db.close();
      return NextResponse.json({ ok: true, message: "Označen za prepis" });
    }

    if (action === "ending") {
      if (!ending) return NextResponse.json({ error: "Missing ending (A/B/C)" }, { status: 400 });

      // Fetch article to compute full MDX content with chosen ending appended
      const row = db.prepare("SELECT * FROM articles WHERE id=?").get(id) as Record<string, unknown>;
      if (!row) { db.close(); return NextResponse.json({ error: "Not found" }, { status: 404 }); }

      // Save chosen_ending + mark approved
      db.prepare(
        "UPDATE articles SET chosen_ending=?, approved=1, status='approved' WHERE id=?"
      ).run(ending, id);
      db.close();

      // Trigger background publish (same as review panel)
      const script = `
import sys; sys.path.insert(0, '.')
from core.vps_publisher import publish_single
import logging
logging.basicConfig(filename='logs/editorial_publish.log', level=logging.INFO)
result = publish_single(${id})
print(result)
`;
      const proc = spawn(PYTHON, ["-c", script], {
        cwd: FP_DIR,
        detached: true,
        stdio: "ignore",
      });
      proc.unref();

      return NextResponse.json({ ok: true, message: "Publish pokrenut (~60s)" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
