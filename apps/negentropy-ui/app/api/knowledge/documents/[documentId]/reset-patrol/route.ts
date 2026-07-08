import { proxyPost } from "../../../_proxy";

/**
 * POST /api/knowledge/documents/{documentId}/reset-patrol
 * 重置库文档 PDF 巡检态为「未巡检」（二次巡检入口）。
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  return proxyPost(request, `/knowledge/documents/${documentId}/reset-patrol`);
}
