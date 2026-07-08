import { proxyPost } from "../../../../../_proxy";

/**
 * POST /api/knowledge/base/{corpusId}/documents/{documentId}/reset-patrol
 * 重置 corpus 文档 PDF 巡检态为「未巡检」（二次巡检入口）。
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ corpusId: string; documentId: string }> },
) {
  const { corpusId, documentId } = await context.params;
  return proxyPost(
    request,
    `/knowledge/base/${corpusId}/documents/${documentId}/reset-patrol`,
  );
}
