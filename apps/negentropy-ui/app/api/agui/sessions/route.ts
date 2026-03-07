import { NextResponse } from "next/server";
import { safeParseCreateSessionResponse } from "@/lib/agui/session-schema";
import { parseSessionUpstreamJson } from "@/app/api/agui/sessions/_response";
import {
  buildSessionUpstreamHeaders,
  getSessionAguiBaseUrl,
} from "@/app/api/agui/sessions/_request";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

export async function POST(request: Request) {
  const baseUrl = getSessionAguiBaseUrl();
  if (baseUrl instanceof Response) {
    return baseUrl;
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
    return aguiErrorResponse(AGUI_ERROR_CODES.BAD_REQUEST, `Invalid JSON body: ${String(error)}`);
  }

  if (!body?.app_name || !body?.user_id) {
    return aguiErrorResponse(AGUI_ERROR_CODES.BAD_REQUEST, "app_name and user_id are required");
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
      headers: buildSessionUpstreamHeaders(request, "json-write"),
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    return aguiErrorResponse(AGUI_ERROR_CODES.UPSTREAM_ERROR, `Upstream connection failed: ${String(error)}`);
  }

  const parsed = await parseSessionUpstreamJson({
    upstreamResponse,
    parse: safeParseCreateSessionResponse,
    invalidPayloadMessage: "Invalid upstream session create payload",
    invalidJsonMessage: "Invalid upstream session create JSON",
  });
  if (parsed instanceof Response) {
    return parsed;
  }

  return NextResponse.json(parsed.data, { status: parsed.status });
}
