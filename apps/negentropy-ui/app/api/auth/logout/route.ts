import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import { getAuthBaseUrl } from "../_config";

export async function POST(request: Request) {
  const baseUrl = getAuthBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: "AUTH_BASE_URL is not configured" }, { status: 500 });
  }

  const upstreamUrl = new URL("/auth/logout", baseUrl);
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
