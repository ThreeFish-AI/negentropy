import {
  getSessionAguiBaseUrl,
  buildSessionUpstreamHeaders,
  buildSessionDetailUpstreamUrl,
} from "@/app/api/agui/sessions/_request";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

/**
 * POST /api/agui/sessions/[sessionId]/approval_response
 *
 * BFF 代理：将前端 ApprovalDialog 的用户决策转发到后端 ADK session state。
 * 后端从 state.approval_responses 读取，完成审批闭环。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const baseUrl = getSessionAguiBaseUrl();
  if (baseUrl instanceof Response) {
    return baseUrl;
  }

  let body: {
    app_name?: string;
    user_id?: string;
    action_id?: string;
    decision?: string;
    reason?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch (error) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      `Invalid JSON body: ${String(error)}`
    );
  }

  if (!body?.app_name || !body?.user_id || !body?.action_id || !body?.decision) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      "app_name, user_id, action_id, and decision are required"
    );
  }

  const { sessionId } = await params;
  const upstreamUrl = new URL(
    `${buildSessionDetailUpstreamUrl(baseUrl, {
      appName: body.app_name,
      userId: body.user_id,
      sessionId,
    }).pathname}/approval_response`,
    baseUrl
  );

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: buildSessionUpstreamHeaders(request, "json-write"),
      body: JSON.stringify({
        action_id: body.action_id,
        decision: body.decision,
        reason: body.reason,
      }),
      cache: "no-store",
    });
  } catch (error) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      `Upstream connection failed: ${String(error)}`
    );
  }

  if (!upstreamResponse.ok) {
    const text = await upstreamResponse.text();
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      `Upstream error: ${upstreamResponse.status} ${text}`
    );
  }

  const data = await upstreamResponse.json();
  return Response.json(data, { status: upstreamResponse.status });
}
