import { NextResponse } from "next/server";

/**
 * @deprecated Memory API has been moved to /api/memory/
 * Redirect legacy requests to new endpoint.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const newUrl = new URL("/api/memory", url.origin);
  newUrl.search = url.search;
  return NextResponse.redirect(newUrl, 308);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const newUrl = new URL("/api/memory", url.origin);
  newUrl.search = url.search;
  return NextResponse.redirect(newUrl, 308);
}
