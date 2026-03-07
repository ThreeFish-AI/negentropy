import { NextResponse } from "next/server";
import { safeParseCreateSessionResponse } from "@/lib/agui/session-schema";
import { parseSessionUpstreamJson } from "@/app/api/agui/sessions/_response";
import {
  buildSessionCreateUpstreamUrl,
  parseSessionCreateBody,
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

  const body = await parseSessionCreateBody(request);
  if (body instanceof Response) {
    return body;
  }

  const upstreamUrl = buildSessionCreateUpstreamUrl(baseUrl, {
    appName: body.appName,
    userId: body.userId,
  });

  const payload = {
    session_id: body.sessionId,
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
