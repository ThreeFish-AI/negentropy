import { proxyGetBinary } from "../../../../../../_proxy";

/**
 * GET /api/knowledge/base/{corpusId}/documents/{documentId}/assets/{assetName}
 * 代理文档衍生资产（图片等）
 */
export async function GET(
  request: Request,
  context: {
    params: Promise<{ corpusId: string; documentId: string; assetName: string }>;
  },
) {
  const { corpusId, documentId, assetName } = await context.params;
  return proxyGetBinary(
    request,
    `/knowledge/base/${corpusId}/documents/${documentId}/assets/${encodeURIComponent(assetName)}`,
  );
}
