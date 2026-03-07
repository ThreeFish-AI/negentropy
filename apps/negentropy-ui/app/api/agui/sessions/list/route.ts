import { NextResponse } from "next/server";
import { safeParseSessionListResponse } from "@/lib/agui/session-schema";
import { parseSessionUpstreamJson } from "@/app/api/agui/sessions/_response";
import {
  buildSessionListUpstreamUrl,
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

  const { searchParams } = new URL(request.url);
  const appName = searchParams.get("app_name");
  const userId = searchParams.get("user_id");
  const archived = searchParams.get("archived");

  if (!appName || !userId) {
    return aguiErrorResponse(AGUI_ERROR_CODES.BAD_REQUEST, "app_name and user_id are required");
  }

  const upstreamUrl = buildSessionListUpstreamUrl(baseUrl, {
    appName,
    userId,
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
  if (archived !== "true" && archived !== "false") {
    return NextResponse.json(sessions, { status: parsed.status });
  }

  const includeArchived = archived === "true";
  const filtered = sessions.filter((session) => {
    const isArchived = session?.state?.metadata?.archived === true;
    return includeArchived ? isArchived : !isArchived;
  });

  return NextResponse.json(filtered, { status: parsed.status });
}
