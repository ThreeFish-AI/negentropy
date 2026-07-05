import { proxyGetBinary } from "../../../_proxy";

/**
 * GET /api/knowledge/documents/{documentId}/preview
 *
 * 内联预览文档原始文件（库文档 / 跨 corpus 直达）。
 * 与 corpus 作用域 preview 同构：复用后端 `/download` 字节，BFF 层改写
 * `Content-Disposition` 为 `inline`，供 PDF 原文视图内联渲染。
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  return proxyGetBinary(
    request,
    `/knowledge/documents/${documentId}/download`,
    { responseDisposition: "inline" },
  );
}
