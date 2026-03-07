import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import { safeParseSessionDetailResponse } from "@/lib/agui/session-schema";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

function getBaseUrl() {
  return process.env.AGUI_BASE_URL || process.env.NEXT_PUBLIC_AGUI_BASE_URL;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.INTERNAL_ERROR,
      "AGUI_BASE_URL is not configured",
    );
  }

  const { sessionId } = await params;
  const { searchParams } = new URL(request.url);
  const appName = searchParams.get("app_name");
  const userId = searchParams.get("user_id");

  if (!appName || !userId) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      "app_name and user_id are required",
    );
  }

  const upstreamUrl = new URL(
    `/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(
      sessionId
    )}`,
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
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      `Upstream connection failed: ${String(error)}`,
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      text || "Upstream returned non-OK status",
    );
  }

  try {
    const payload = JSON.parse(text) as unknown;
    const parsed = safeParseSessionDetailResponse(payload);
    if (!parsed.success) {
      return aguiErrorResponse(
        AGUI_ERROR_CODES.UPSTREAM_ERROR,
        "Invalid upstream session detail payload",
      );
    }
    return NextResponse.json(parsed.data, { status: upstreamResponse.status });
  } catch {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      "Invalid upstream session detail JSON",
    );
  }
}
