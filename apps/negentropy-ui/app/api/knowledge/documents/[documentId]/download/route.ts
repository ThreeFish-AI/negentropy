import { proxyGetBinary } from "../../../_proxy";

/**
 * GET /api/knowledge/documents/{documentId}/download
 * 下载文档原始文件（库文档 / 跨 corpus 直达）
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  return proxyGetBinary(request, `/knowledge/documents/${documentId}/download`);
}
