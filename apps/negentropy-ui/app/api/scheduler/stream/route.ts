import { buildAuthHeaders } from "@/lib/sso";
import { getAguiBaseUrl } from "@/lib/server/backend-url";

/**
 * /api/scheduler/stream — SSE 流式代理（独立路由，避开通用 proxy 的 .text() 缓冲）。
 *
 * 设计要点：
 * - 用 ``fetch`` + ``ReadableStream`` 直通转发，确保心跳 ``: ping`` 与 ``execution``
 *   事件能逐条到达浏览器；
 * - 鉴权 header 复用 buildAuthHeaders + X-Session-ID / X-User-ID 透传；
 * - 设置 ``no-cache, no-transform``、``X-Accel-Buffering: no`` 防止 Nginx/CDN 缓冲；
 * - ``dynamic = "force-dynamic"`` 关闭 Next.js 任何缓存层。
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const baseUrl = getAguiBaseUrl();
  if (!baseUrl) {
    return new Response("AGUI_BASE_URL is not configured", { status: 500 });
  }

  const headers = buildAuthHeaders(request);
  const sessionId = request.headers.get("x-session-id");
  if (sessionId) headers.set("x-session-id", sessionId);
  const userId = request.headers.get("x-user-id");
  if (userId) headers.set("x-user-id", userId);
  // 显式声明期望 SSE 响应；某些中间件依此协商不缓冲
  headers.set("accept", "text/event-stream");

  const upstreamUrl = new URL("/scheduler/stream", baseUrl);
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      // @ts-expect-error Next.js 流式 fetch — duplex 在 Node fetch 中合法
      duplex: "half",
    });
  } catch (error) {
    return new Response(`Upstream connection failed: ${String(error)}`, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(text || "Upstream returned non-OK status", { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
