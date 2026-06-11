import { proxyPost } from "../../_proxy";

/**
 * POST /api/knowledge/documents/import_url
 * 导入 URL 至文档库（仅转换为 Markdown 并存储，不做索引）
 */
export async function POST(request: Request) {
  return proxyPost(request, "/knowledge/documents/import_url");
}
