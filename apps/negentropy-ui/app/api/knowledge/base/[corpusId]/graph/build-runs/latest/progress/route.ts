/**
 * P3-1 · KG Build Progress SSE 代理（BFF）
 *
 * 前端 EventSource 通过本路由 → 转发到后端
 * `GET /knowledge/base/{corpus_id}/graph/build-runs/latest/progress/stream`，
 * 保留 ne_sso cookie 与 keep-alive 流式传输。
 *
 * 与普通 proxyGet 的差异：响应是 text/event-stream，不能 await text() —— 必须直接
 * 把 upstream Response.body 作为流转发。
 */

import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import { getKnowledgeBaseUrl } from "@/lib/server/backend-url";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await params;
  const baseUrl = getKnowledgeBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: { code: "KNOWLEDGE_INTERNAL_ERROR", message: "KNOWLEDGE_BASE_URL is not configured" } },
      { status: 500 },
    );
  }

  const upstreamUrl = new URL(
    `/knowledge/base/${encodeURIComponent(corpusId)}/graph/build-runs/latest/progress/stream`,
    baseUrl,
  );
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;

  const headers = buildAuthHeaders(request);
  headers.set("accept", "text/event-stream");

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      // @ts-expect-error - Next.js fetch supports `duplex: "half"` for streaming
      duplex: "half",
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "KNOWLEDGE_UPSTREAM_ERROR", message: `Upstream connection failed: ${String(error)}` } },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: { code: "KNOWLEDGE_UPSTREAM_ERROR", message: text || "Upstream returned non-OK status" } },
      { status: upstream.status || 502 },
    );
  }

  const responseHeaders = new Headers({
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no",
    connection: "keep-alive",
  });

  return new Response(upstream.body, {
    status: 200,
    headers: responseHeaders,
  });
}
