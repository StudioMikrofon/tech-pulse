import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { spawn } from "child_process";

const DB_PATH = "/opt/openclaw/futurepulse/db/futurepulse.db";

function checkAuth(req: NextRequest): boolean {
  if (process.env.NEXT_PUBLIC_AGENT_PANEL !== "true") return false;
  return true;
}

function getDb() {
  return new Database(DB_PATH, { readonly: false });
}

function triggerPublish(articleId: number) {
  const script = `
import sys; sys.path.insert(0, '.')
from core.vps_publisher import publish_single
import logging
logging.basicConfig(filename='logs/review_publish.log', level=logging.INFO)
result = publish_single(${articleId})
print(result)
`;
  const proc = spawn(
    "/opt/openclaw/futurepulse/venv/bin/python3",
    ["-c", script],
    { cwd: "/opt/openclaw/futurepulse", detached: true, stdio: "ignore" }
  );
  proc.unref();
}

// One subprocess for multiple articles — single rebuild instead of N rebuilds
function triggerBulkPublish(articleIds: number[]) {
  const idsJson = JSON.stringify(articleIds);
  const script = `
import sys, sqlite3, logging
sys.path.insert(0, '.')
from core.vps_publisher import publish_to_vps
logging.basicConfig(filename='logs/review_publish.log', level=logging.INFO)
ids = ${idsJson}
conn = sqlite3.connect('db/futurepulse.db')
conn.row_factory = sqlite3.Row
articles = []
for aid in ids:
    row = conn.execute('SELECT * FROM articles WHERE id=?', (aid,)).fetchone()
    if row:
        articles.append(dict(row))
conn.close()
result = publish_to_vps(articles)
print(result)
`;
  const proc = spawn(
    "/opt/openclaw/futurepulse/venv/bin/python3",
    ["-c", script],
    { cwd: "/opt/openclaw/futurepulse", detached: true, stdio: "ignore" }
  );
  proc.unref();
}

// GET /api/review — list articles
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") || "pending";

  try {
    const db = getDb();
    let query = `
      SELECT id, title, title_en, category, status, pipeline_stage, approved,
             github_uploaded, chosen_ending, part1, part1_en,
             part2, part2_en, subtitle, subtitle_en,
             endings_json, endings_en, images_json,
             source_url, source_name, created_at, published_at
      FROM articles
    `;
    if (filter === "pending") {
      query += ` WHERE status NOT IN ('rejected', 'published') ORDER BY id DESC LIMIT 100`;
    } else if (filter === "published") {
      query += ` WHERE status='published' ORDER BY id DESC LIMIT 50`;
    } else {
      query += ` WHERE status != 'rejected' ORDER BY id DESC LIMIT 100`;
    }
    const rows = db.prepare(query).all();
    db.close();
    return NextResponse.json({ articles: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/review — save edits
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { id, title, title_en, part1, part1_en, part2, part2_en, subtitle, subtitle_en } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const db = getDb();
    db.prepare(`
      UPDATE articles SET
        title = COALESCE(?, title),
        title_en = COALESCE(?, title_en),
        part1 = COALESCE(?, part1),
        part1_en = COALESCE(?, part1_en),
        part2 = COALESCE(?, part2),
        part2_en = COALESCE(?, part2_en),
        subtitle = COALESCE(?, subtitle),
        subtitle_en = COALESCE(?, subtitle_en)
      WHERE id = ?
    `).run(
      title ?? null, title_en ?? null,
      part1 ?? null, part1_en ?? null,
      part2 ?? null, part2_en ?? null,
      subtitle ?? null, subtitle_en ?? null,
      id
    );
    db.close();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/review — publish, reject, bulk_publish, bulk_reject
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { id, action, chosen_ending, ids } = body;

    // --- Bulk actions ---
    if (action === "bulk_reject") {
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "Missing ids" }, { status: 400 });
      }
      const db = getDb();
      const stmt = db.prepare("UPDATE articles SET status='rejected' WHERE id=?");
      let count = 0;
      for (const articleId of ids) {
        stmt.run(articleId);
        count++;
      }
      db.close();
      return NextResponse.json({ ok: true, count });
    }

    if (action === "bulk_publish" || action === "bulk_publish_random") {
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "Missing ids" }, { status: 400 });
      }
      const useRandom = action === "bulk_publish_random";
      const endings = ["A", "B", "C"];
      const db = getDb();
      const stmtEnding = db.prepare(
        "UPDATE articles SET approved=1, status='approved', chosen_ending=? WHERE id=?"
      );
      const stmtNoEnding = db.prepare(
        "UPDATE articles SET approved=1, status='approved' WHERE id=?"
      );
      const toPublish: number[] = [];
      for (const articleId of ids) {
        if (useRandom) {
          // Assign random ending if not already set
          const row = db.prepare("SELECT chosen_ending FROM articles WHERE id=?").get(articleId) as { chosen_ending: string | null } | undefined;
          const ending = row?.chosen_ending || endings[Math.floor(Math.random() * 3)];
          stmtEnding.run(ending, articleId);
        } else {
          stmtNoEnding.run(articleId);
        }
        toPublish.push(articleId);
      }
      db.close();
      // Single subprocess = single rebuild
      triggerBulkPublish(toPublish);
      return NextResponse.json({ ok: true, count: toPublish.length });
    }

    // --- Single actions ---
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const db = getDb();

    if (action === "reject") {
      db.prepare("UPDATE articles SET status='rejected' WHERE id=?").run(id);
      db.close();
      return NextResponse.json({ ok: true, message: "Odbijen" });
    }

    // Publish: mark approved + save chosen_ending + trigger background build
    db.prepare(
      "UPDATE articles SET approved=1, status='approved', chosen_ending=? WHERE id=?"
    ).run(chosen_ending ?? null, id);
    db.close();

    triggerPublish(id);

    return NextResponse.json({ ok: true, message: "Publish pokrenut (~60s)" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
