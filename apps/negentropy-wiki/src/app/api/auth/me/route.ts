import { NextResponse } from "next/server";

import { buildAuthHeaders } from "../../_lib/sso";

const API_BASE = process.env.WIKI_API_BASE || "http://localhost:3292";

export async function GET(request: Request) {
  const upstreamUrl = new URL("/auth/me", API_BASE);
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: buildAuthHeaders(request),
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json({ error: `Upstream connection failed: ${String(error)}` }, { status: 502 });
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return NextResponse.json({ error: text || "Upstream returned non-OK status" }, { status: upstreamResponse.status });
  }

  return NextResponse.json(JSON.parse(text), { status: upstreamResponse.status });
}
