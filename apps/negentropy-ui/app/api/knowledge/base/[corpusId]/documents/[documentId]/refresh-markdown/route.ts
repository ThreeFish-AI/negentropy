import { proxyPost } from "../../../../../_proxy";

/**
 * POST /api/knowledge/base/{corpusId}/documents/{documentId}/refresh-markdown
 * Backward-compatible alias for markdown refresh endpoint.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ corpusId: string; documentId: string }> },
) {
  const { corpusId, documentId } = await context.params;
  return proxyPost(
    request,
    `/knowledge/base/${corpusId}/documents/${documentId}/refresh_markdown`,
  );
}
