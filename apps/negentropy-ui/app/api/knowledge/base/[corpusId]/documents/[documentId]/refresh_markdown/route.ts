import { proxyPost } from "../../../../../_proxy";

/**
 * POST /api/knowledge/base/{corpusId}/documents/{documentId}/refresh_markdown
 * Re-parse markdown content from source document in GCS
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
