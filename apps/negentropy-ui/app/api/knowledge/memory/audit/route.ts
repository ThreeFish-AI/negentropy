import { NextResponse } from "next/server";

/**
 * @deprecated Memory Audit API has been moved to /api/memory/audit
 * Redirect legacy requests to new endpoint.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const newUrl = new URL("/api/memory/audit", url.origin);
  newUrl.search = url.search;
  return NextResponse.redirect(newUrl, 308);
}
