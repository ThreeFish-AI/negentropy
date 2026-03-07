import { safeParseSessionTitleResponse } from "@/lib/agui/session-schema";
import { parseSessionUpstreamJson } from "@/app/api/agui/sessions/_response";
import {
  buildSessionTitleUpstreamUrl,
  parseSessionTitleBody,
  buildSessionUpstreamHeaders,
  getSessionAguiBaseUrl,
} from "@/app/api/agui/sessions/_request";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const baseUrl = getSessionAguiBaseUrl();
  if (baseUrl instanceof Response) {
    return baseUrl;
  }

  const body = await parseSessionTitleBody(request);
  if (body instanceof Response) {
    return body;
  }

  const { sessionId } = await params;
  const upstreamUrl = buildSessionTitleUpstreamUrl(baseUrl, {
    appName: body.appName,
    userId: body.userId,
    sessionId,
  });

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "PATCH",
      headers: buildSessionUpstreamHeaders(request, "json-write"),
      body: JSON.stringify({
        title: body.title,
      }),
      cache: "no-store",
    });
  } catch (error) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      `Upstream connection failed: ${String(error)}`
    );
  }

  const parsed = await parseSessionUpstreamJson({
    upstreamResponse,
    parse: safeParseSessionTitleResponse,
    invalidPayloadMessage: "Invalid upstream session title payload",
    invalidJsonMessage: "Invalid upstream session title JSON",
  });
  if (parsed instanceof Response) {
    return parsed;
  }

  return Response.json(parsed.data, { status: parsed.status });
}
