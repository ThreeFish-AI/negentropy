import { NextResponse } from "next/server";
import { safeParseSessionListResponse } from "@/lib/agui/session-schema";
import { parseSessionUpstreamJson } from "@/app/api/agui/sessions/_response";
import {
  buildSessionListUpstreamUrl,
  parseSessionListQuery,
  buildSessionUpstreamHeaders,
  getSessionAguiBaseUrl,
} from "@/app/api/agui/sessions/_request";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

export async function GET(request: Request) {
  const baseUrl = getSessionAguiBaseUrl();
  if (baseUrl instanceof Response) {
    return baseUrl;
  }

  const query = parseSessionListQuery(request);
  if (query instanceof Response) {
    return query;
  }

  const upstreamUrl = buildSessionListUpstreamUrl(baseUrl, {
    appName: query.appName,
    userId: query.userId,
  });

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: buildSessionUpstreamHeaders(request, "json-read"),
      cache: "no-store",
    });
  } catch (error) {
    return aguiErrorResponse(AGUI_ERROR_CODES.UPSTREAM_ERROR, `Upstream connection failed: ${String(error)}`);
  }

  const parsed = await parseSessionUpstreamJson({
    upstreamResponse,
    parse: safeParseSessionListResponse,
    invalidPayloadMessage: "Invalid upstream session list payload",
    invalidJsonMessage: "Invalid upstream session list JSON",
  });
  if (parsed instanceof Response) {
    return parsed;
  }

  const sessions = parsed.data;
  if (typeof query.archived !== "boolean") {
    return NextResponse.json(sessions, { status: parsed.status });
  }

  const includeArchived = query.archived;
  const filtered = sessions.filter((session) => {
    const isArchived = session?.state?.metadata?.archived === true;
    return includeArchived ? isArchived : !isArchived;
  });

  return NextResponse.json(filtered, { status: parsed.status });
}
