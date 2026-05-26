import { NextResponse } from "next/server";

import { buildAuthHeaders } from "../../_lib/sso";

const API_BASE = process.env.WIKI_API_BASE || "http://localhost:3292";

export async function POST(request: Request) {
  const upstreamUrl = new URL("/auth/logout", API_BASE);
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: buildAuthHeaders(request),
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json({ error: `Upstream connection failed: ${String(error)}` }, { status: 502 });
  }

  const response = new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: new Headers(upstreamResponse.headers),
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
