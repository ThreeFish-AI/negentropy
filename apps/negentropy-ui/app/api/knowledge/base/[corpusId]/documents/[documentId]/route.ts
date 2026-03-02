import { proxyDelete, proxyGet } from "../../../../_proxy";

/**
 * GET /api/knowledge/base/{corpusId}/documents/{documentId}
 * Get single document detail with markdown content
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ corpusId: string; documentId: string }> },
) {
  const { corpusId, documentId } = await context.params;
  return proxyGet(request, `/knowledge/base/${corpusId}/documents/${documentId}`);
}

/**
 * DELETE /api/knowledge/base/{corpusId}/documents/{documentId}
 * Delete a document (soft delete by default, hard delete with hard_delete=true)
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ corpusId: string; documentId: string }> },
) {
  const { corpusId, documentId } = await context.params;
  return proxyDelete(
    request,
    `/knowledge/base/${corpusId}/documents/${documentId}`,
  );
}
