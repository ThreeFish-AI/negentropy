import { proxyDelete } from "../../../../_proxy";

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
