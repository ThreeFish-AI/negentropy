import { NextResponse } from "next/server";

import { buildAuthHeaders } from "../../_lib/sso";

const API_BASE = process.env.WIKI_API_BASE || "http://localhost:3292";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const code = incomingUrl.searchParams.get("code");
  const state = incomingUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const callbackUrl = new URL("/auth/google/callback", API_BASE);
  callbackUrl.searchParams.set("code", code);
  callbackUrl.searchParams.set("state", state);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(callbackUrl.toString(), {
      method: "GET",
      headers: buildAuthHeaders(request),
      redirect: "manual",
    });
  } catch (error) {
    return NextResponse.json({ error: `Upstream connection failed: ${String(error)}` }, { status: 502 });
  }

  // Backend returns 302 with Set-Cookie header
  const setCookie = upstreamResponse.headers.get("set-cookie");
  const location = upstreamResponse.headers.get("location") || "/";

  const response = NextResponse.redirect(new URL(location, incomingUrl.origin));

  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}
