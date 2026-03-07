import { buildAuthHeaders } from "@/lib/sso";
import { safeParseSessionArchiveResponse } from "@/lib/agui/session-schema";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

function getBaseUrl() {
  return process.env.AGUI_BASE_URL || process.env.NEXT_PUBLIC_AGUI_BASE_URL;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.INTERNAL_ERROR,
      "AGUI_BASE_URL is not configured"
    );
  }

  let body: {
    app_name?: string;
    user_id?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch (error) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      `Invalid JSON body: ${String(error)}`
    );
  }

  if (!body?.app_name || !body?.user_id) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      "app_name and user_id are required"
    );
  }

  const { sessionId } = await params;
  const upstreamUrl = new URL(
    `/apps/${encodeURIComponent(body.app_name)}/users/${encodeURIComponent(
      body.user_id
    )}/sessions/${encodeURIComponent(sessionId)}/archive`,
    baseUrl
  );

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        ...Object.fromEntries(buildAuthHeaders(request)),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch (error) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      `Upstream connection failed: ${String(error)}`
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      text || "Upstream returned non-OK status"
    );
  }

  try {
    const payload = JSON.parse(text) as unknown;
    const parsed = safeParseSessionArchiveResponse(payload);
    if (!parsed.success) {
      return aguiErrorResponse(
        AGUI_ERROR_CODES.UPSTREAM_ERROR,
        "Invalid upstream session archive payload"
      );
    }
    return Response.json(parsed.data, { status: upstreamResponse.status });
  } catch {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      "Invalid upstream session archive JSON"
    );
  }
}
