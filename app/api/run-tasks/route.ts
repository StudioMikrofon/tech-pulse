import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const STATUS_FILE = join(DATA_DIR, "exec-status.json");

export async function POST() {
  // Check if already running
  if (existsSync(STATUS_FILE)) {
    try {
      const status = JSON.parse(readFileSync(STATUS_FILE, "utf-8"));
      if (status.status === "running") {
        return NextResponse.json({ error: "Already running", status });
      }
    } catch {}
  }

  mkdirSync(DATA_DIR, { recursive: true });

  // Spawn detached so it outlives the request
  const child = spawn("/opt/run-claude-tasks.sh", [], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, HOME: "/root", CLAUDECODE: undefined } as NodeJS.ProcessEnv,
  });
  child.unref();

  return NextResponse.json({ ok: true, pid: child.pid });
}

export async function GET() {
  if (!existsSync(STATUS_FILE)) {
    return NextResponse.json({ status: "idle", step: "No run yet" });
  }
  try {
    return NextResponse.json(JSON.parse(readFileSync(STATUS_FILE, "utf-8")));
  } catch {
    return NextResponse.json({ status: "idle", step: "Unknown" });
  }
}
