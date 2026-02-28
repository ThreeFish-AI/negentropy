import { proxyGetBinary } from "../../../../../_proxy";

/**
 * GET /api/knowledge/base/{corpusId}/documents/{documentId}/download
 * 下载文档原始文件
 */
export async function GET(
  request: Request,
  context: {
    params: Promise<{ corpusId: string; documentId: string }>;
  },
) {
  const { corpusId, documentId } = await context.params;
  return proxyGetBinary(
    request,
    `/knowledge/base/${corpusId}/documents/${documentId}/download`,
  );
}
