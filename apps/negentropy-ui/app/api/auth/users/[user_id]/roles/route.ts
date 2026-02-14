import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import { getAuthBaseUrl } from "../../../_config";

export async function PATCH(
  request: Request,
  context: { params: { user_id: string } },
) {
  const baseUrl = getAuthBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "AUTH_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  const userId = encodeURIComponent(context.params.user_id);
  const upstreamUrl = new URL(`/auth/users/${userId}/roles`, baseUrl);
  const body = await request.text();
  const headers = buildAuthHeaders(request);
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "PATCH",
      headers,
      body,
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

  return NextResponse.json(JSON.parse(text), {
    status: upstreamResponse.status,
  });
}
