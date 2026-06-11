import { proxyPostFormData } from "../../_proxy";

/**
 * POST /api/knowledge/documents/import_file
 * 导入文件（PDF / Markdown）至文档库（仅转换为 Markdown 并存储，不做索引）
 */
export async function POST(request: Request) {
  return proxyPostFormData(request, "/knowledge/documents/import_file");
}
