import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const TASKS_FILE = join(DATA_DIR, "tasks.json");

function readTasks(): unknown[] {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    return JSON.parse(readFileSync(TASKS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeTasks(tasks: unknown[]) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

export async function GET() {
  return NextResponse.json(readTasks());
}

export async function POST(req: NextRequest) {
  const tasks = await req.json();
  if (!Array.isArray(tasks)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  writeTasks(tasks);
  return NextResponse.json({ ok: true });
}
