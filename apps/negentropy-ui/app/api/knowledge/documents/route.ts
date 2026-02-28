import { proxyGet } from "../_proxy";

/**
 * GET /api/knowledge/documents
 * List all documents across corpora
 */
export async function GET(request: Request) {
  return proxyGet(request, "/knowledge/documents");
}
