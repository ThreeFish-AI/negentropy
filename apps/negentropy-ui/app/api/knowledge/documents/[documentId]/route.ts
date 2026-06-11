import { proxyDelete, proxyGet, proxyPatch } from "../../_proxy";

/**
 * GET /api/knowledge/documents/{documentId}
 * 获取文档详情（库文档 / 跨 corpus 直达，按 app_name 限界）
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  return proxyGet(request, `/knowledge/documents/${documentId}`);
}

/**
 * PATCH /api/knowledge/documents/{documentId}
 * 更新文档元信息（display_name / Wiki 文章元数据）
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  return proxyPatch(request, `/knowledge/documents/${documentId}`);
}

/**
 * DELETE /api/knowledge/documents/{documentId}
 * 删除文档（默认软删除，hard_delete=true 时同步删除 GCS 原始文件）
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  return proxyDelete(request, `/knowledge/documents/${documentId}`);
}
