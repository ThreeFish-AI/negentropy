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

export async function GET(request: Request) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse("AGUI_INTERNAL_ERROR", "AGUI_BASE_URL is not configured", 500);
  }

  const { searchParams } = new URL(request.url);
  const appName = searchParams.get("app_name");
  const userId = searchParams.get("user_id");

  if (!appName || !userId) {
    return errorResponse("AGUI_BAD_REQUEST", "app_name and user_id are required", 400);
  }

  const upstreamUrl = new URL(
    `/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions`,
    baseUrl
  );

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        ...Object.fromEntries(buildAuthHeaders(request)),
        Accept: "application/json",
      },
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
