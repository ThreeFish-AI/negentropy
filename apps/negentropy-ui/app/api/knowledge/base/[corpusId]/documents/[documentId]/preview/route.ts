import { proxyGetBinary } from "../../../../../_proxy";

/**
 * GET /api/knowledge/base/{corpusId}/documents/{documentId}/preview
 *
 * 内联预览文档原始文件（PDF 源文档「PDF 原文」视图）。
 * 复用后端 `/download` 端点（同一份字节），仅在 BFF 层把 `Content-Disposition`
 * 改写为 `inline`，使 `<object>`/`<iframe>` 能内联渲染而非触发下载。
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
    { responseDisposition: "inline" },
  );
}
