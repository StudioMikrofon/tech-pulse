import { NextResponse } from "next/server";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const STATUS_FILE = join(DATA_DIR, "exec-status.json");
const LOG_FILE = join(DATA_DIR, "exec-log.txt");

export async function GET() {
  mkdirSync(DATA_DIR, { recursive: true });

  let status = { status: "idle", step: "No run yet", ts: "" };
  if (existsSync(STATUS_FILE)) {
    try { status = JSON.parse(readFileSync(STATUS_FILE, "utf-8")); } catch {}
  }

  let log = "";
  if (existsSync(LOG_FILE)) {
    try {
      const full = readFileSync(LOG_FILE, "utf-8");
      // Return last 3000 chars
      log = full.slice(-3000);
    } catch {}
  }

  return NextResponse.json({ ...status, log });
}
