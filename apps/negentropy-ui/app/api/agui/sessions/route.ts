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

export async function POST(request: Request) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse("INTERNAL_ERROR", "AGUI_BASE_URL is not configured");
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
    return errorResponse("BAD_REQUEST", `Invalid JSON body: ${String(error)}`);
  }

  if (!body?.app_name || !body?.user_id) {
    return errorResponse("BAD_REQUEST", "app_name and user_id are required");
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
