import { NextResponse } from "next/server";
import { getAuthBaseUrl } from "../_config";

export async function GET(request: Request) {
  const baseUrl = getAuthBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: "AUTH_BASE_URL is not configured" }, { status: 500 });
  }

  const incomingUrl = new URL(request.url);
  const redirectParam = incomingUrl.searchParams.get("redirect") || "/";
  const redirectUrl = new URL(redirectParam, incomingUrl.origin).toString();

  const loginUrl = new URL("/auth/google/login", baseUrl);
  loginUrl.searchParams.set("redirect", redirectUrl);

  return NextResponse.redirect(loginUrl.toString());
}
