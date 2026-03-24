import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import { getAuthBaseUrl } from "../../../../_config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ modelId: string }> },
) {
  const { modelId } = await params;
  const baseUrl = getAuthBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "AUTH_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  const upstreamUrl = new URL(
    `/auth/admin/models/${encodeURIComponent(modelId)}/set-default`,
    baseUrl,
  );
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
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
    return NextResponse.json(
      { error: text || "Upstream returned non-OK status" },
      { status: upstreamResponse.status },
    );
  }

  return NextResponse.json(text ? JSON.parse(text) : {}, {
    status: upstreamResponse.status,
  });
}
