import { NextRequest, NextResponse } from "next/server";

const SPACE_SERVICE = "http://localhost:8765";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path.join("/");
  const url = `${SPACE_SERVICE}/api/${endpoint}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 0 }, // uvijek svježe
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Space service error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Space data service unavailable" },
      { status: 503 }
    );
  }
}
