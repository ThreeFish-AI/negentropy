import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";

function getBaseUrl() {
  return process.env.AGUI_BASE_URL || process.env.NEXT_PUBLIC_AGUI_BASE_URL;
}

function errorResponse(code: string, message: string, status = 500) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

export async function POST(request: Request) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse("AGUI_INTERNAL_ERROR", "AGUI_BASE_URL is not configured", 500);
  }

  let body: {
    app_name?: string;
    user_id?: string;
    session_id?: string;
    state?: Record<string, unknown>;
    events?: unknown[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch (error) {
    return errorResponse("AGUI_BAD_REQUEST", `Invalid JSON body: ${String(error)}`, 400);
  }

  if (!body?.app_name || !body?.user_id) {
    return errorResponse("AGUI_BAD_REQUEST", "app_name and user_id are required", 400);
  }

  const upstreamUrl = new URL(
    `/apps/${encodeURIComponent(body.app_name)}/users/${encodeURIComponent(body.user_id)}/sessions`,
    baseUrl
  );

  const payload = {
    session_id: body.session_id,
    state: body.state,
    events: body.events,
  };

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        ...Object.fromEntries(buildAuthHeaders(request)),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    return errorResponse("AGUI_UPSTREAM_ERROR", `Upstream connection failed: ${String(error)}`, 502);
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return errorResponse("AGUI_UPSTREAM_ERROR", text || "Upstream returned non-OK status", upstreamResponse.status);
  }

  try {
    return NextResponse.json(JSON.parse(text), { status: upstreamResponse.status });
  } catch {
    return NextResponse.json({ raw: text }, { status: upstreamResponse.status });
  }
}
