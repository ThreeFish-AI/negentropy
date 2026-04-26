import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import { getAguiBaseUrl } from "@/lib/server/backend-url";

export async function GET(request: Request) {
  const baseUrl = getAguiBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "AGUI_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  const upstreamUrl = new URL("/interface/models/vendor-configs", baseUrl);
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: buildAuthHeaders(request),
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Upstream connection failed: ${String(error)}` },
      { status: 502 },
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    let errorMessage = "Upstream returned non-OK status";
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.detail || errorData.error || text;
    } catch {
      errorMessage = text || errorMessage;
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: upstreamResponse.status },
    );
  }

  return NextResponse.json(text ? JSON.parse(text) : {}, {
    status: upstreamResponse.status,
  });
}
