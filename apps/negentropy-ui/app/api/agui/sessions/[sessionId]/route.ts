import { NextResponse } from "next/server";
import { safeParseSessionDetailResponse } from "@/lib/agui/session-schema";
import { parseSessionUpstreamJson } from "@/app/api/agui/sessions/_response";
import {
  buildSessionDetailUpstreamUrl,
  parseSessionQueryScope,
  buildSessionUpstreamHeaders,
  getSessionAguiBaseUrl,
} from "@/app/api/agui/sessions/_request";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const baseUrl = getSessionAguiBaseUrl();
  if (baseUrl instanceof Response) {
    return baseUrl;
  }

  const scope = parseSessionQueryScope(request);
  if (scope instanceof Response) {
    return scope;
  }

  const { sessionId } = await params;
  const upstreamUrl = buildSessionDetailUpstreamUrl(baseUrl, {
    appName: scope.appName,
    userId: scope.userId,
    sessionId,
  });

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: buildSessionUpstreamHeaders(request, "json-read"),
      cache: "no-store",
    });
  } catch (error) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      `Upstream connection failed: ${String(error)}`,
    );
  }

  const parsed = await parseSessionUpstreamJson({
    upstreamResponse,
    parse: safeParseSessionDetailResponse,
    invalidPayloadMessage: "Invalid upstream session detail payload",
    invalidJsonMessage: "Invalid upstream session detail JSON",
  });
  if (parsed instanceof Response) {
    return parsed;
  }

  return NextResponse.json(parsed.data, { status: parsed.status });
}
