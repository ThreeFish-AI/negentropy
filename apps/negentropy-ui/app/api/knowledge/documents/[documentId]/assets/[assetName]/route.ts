import { proxyGetBinary } from "../../../../_proxy";

/**
 * GET /api/knowledge/documents/{documentId}/assets/{assetName}
 * 代理库文档衍生资产（图片等）
 */
export async function GET(
  request: Request,
  context: {
    params: Promise<{ documentId: string; assetName: string }>;
  },
) {
  const { documentId, assetName } = await context.params;
  return proxyGetBinary(
    request,
    `/knowledge/documents/${documentId}/assets/${encodeURIComponent(assetName)}`,
  );
}
