import { proxyPost } from "../../_proxy";

/**
 * POST /api/knowledge/documents/translate
 * 批量翻译文档（Documents 页 Translate 按钮）
 */
export async function POST(request: Request) {
  return proxyPost(request, "/knowledge/documents/translate");
}
