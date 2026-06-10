import { proxyPost } from "../../../_proxy";

/**
 * POST /api/knowledge/documents/{documentId}/refresh_markdown
 * 从 GCS 源文档重新解析 Markdown（库文档走默认 extractor_routes）
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  return proxyPost(request, `/knowledge/documents/${documentId}/refresh_markdown`);
}
