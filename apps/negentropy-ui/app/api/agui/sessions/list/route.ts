import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import { safeParseSessionListResponse } from "@/lib/agui/session-schema";
import { parseSessionUpstreamJson } from "@/app/api/agui/sessions/_response";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

function getBaseUrl() {
  return process.env.AGUI_BASE_URL || process.env.NEXT_PUBLIC_AGUI_BASE_URL;
}

export async function GET(request: Request) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return aguiErrorResponse(AGUI_ERROR_CODES.INTERNAL_ERROR, "AGUI_BASE_URL is not configured");
  }

  const { searchParams } = new URL(request.url);
  const appName = searchParams.get("app_name");
  const userId = searchParams.get("user_id");
  const archived = searchParams.get("archived");

  if (!appName || !userId) {
    return aguiErrorResponse(AGUI_ERROR_CODES.BAD_REQUEST, "app_name and user_id are required");
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
