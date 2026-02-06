import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

function getBaseUrl() {
  return process.env.AGUI_BASE_URL || process.env.NEXT_PUBLIC_AGUI_BASE_URL;
}

function errorResponse(
  code: keyof typeof AGUI_ERROR_CODES,
  message: string,
  traceId?: string,
): Response {
  return aguiErrorResponse(code, message, traceId);
}

export async function GET(request: Request) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse("INTERNAL_ERROR", "AGUI_BASE_URL is not configured");
  }

  const { searchParams } = new URL(request.url);
  const appName = searchParams.get("app_name");
  const userId = searchParams.get("user_id");

  if (!appName || !userId) {
    return errorResponse("BAD_REQUEST", "app_name and user_id are required");
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
    return errorResponse("UPSTREAM_ERROR", `Upstream connection failed: ${String(error)}`);
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return errorResponse("UPSTREAM_ERROR", text || "Upstream returned non-OK status");
  }

  try {
    return NextResponse.json(JSON.parse(text), { status: upstreamResponse.status });
  } catch {
    return NextResponse.json({ raw: text }, { status: upstreamResponse.status });
  }
}
