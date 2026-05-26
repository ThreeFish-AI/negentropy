import { NextResponse } from "next/server";

const API_BASE = process.env.WIKI_API_BASE || "http://localhost:3292";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const redirectParam = incomingUrl.searchParams.get("redirect") || incomingUrl.headers.get("referer") || "/";
  const redirectUrl = new URL(redirectParam, incomingUrl.origin).toString();

  const loginUrl = new URL("/auth/google/login", API_BASE);
  loginUrl.searchParams.set("redirect", redirectUrl);

  return NextResponse.redirect(loginUrl.toString());
}
