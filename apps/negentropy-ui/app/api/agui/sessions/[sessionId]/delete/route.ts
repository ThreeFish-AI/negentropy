import { safeParseSessionDeleteResponse } from "@/lib/agui/session-schema";
import { parseSessionUpstreamJson } from "@/app/api/agui/sessions/_response";
import {
  buildSessionDeleteUpstreamUrl,
  parseSessionScopeBody,
  buildSessionUpstreamHeaders,
  getSessionAguiBaseUrl,
} from "@/app/api/agui/sessions/_request";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

/**
 * 硬删除会话（POST /api/agui/sessions/{id}/delete）：从数据库永久移除，不可恢复。
 *
 * 与同目录 ``archive`` / ``unarchive`` 同构（``app_name`` / ``user_id`` 走 body），
 * 转发到上游 ``POST /apps/{app}/users/{user}/sessions/{id}/delete``。
 *
 * 为何走 POST 而非 HTTP DELETE：ADK Web Server 已在
 * ``DELETE /apps/{app}/users/{user}/sessions/{id}`` 上注册其自身的处理器（其调用
 * 被本仓库重写为"归档"的 ``delete_session``），路由匹配会先命中 ADK 版本，让我
 * 们的硬删除路由形同虚设。改走 ``POST .../delete`` 既绕开冲突，又与
 * ``archive`` / ``unarchive`` 模板保持一致。
 *
 * 调用方（``useSessionListService.deleteSession``）配合 destructive 二次确认对
 * 话框使用，避免误触。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const baseUrl = getSessionAguiBaseUrl();
  if (baseUrl instanceof Response) {
    return baseUrl;
  }

  const body = await parseSessionScopeBody(request);
  if (body instanceof Response) {
    return body;
  }

  const { sessionId } = await params;
  const upstreamUrl = buildSessionDeleteUpstreamUrl(baseUrl, {
    appName: body.appName,
    userId: body.userId,
    sessionId,
  });

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: buildSessionUpstreamHeaders(request, "json-write"),
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
    parse: safeParseSessionDeleteResponse,
    invalidPayloadMessage: "Invalid upstream session delete payload",
    invalidJsonMessage: "Invalid upstream session delete JSON",
  });
  if (parsed instanceof Response) {
    return parsed;
  }

  return Response.json(parsed.data, { status: parsed.status });
}
