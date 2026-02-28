import { proxyGet } from "../../../_proxy";

/**
 * GET /api/knowledge/base/{corpusId}/documents
 * List documents in a corpus
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  return proxyGet(request, `/knowledge/base/${corpusId}/documents`);
}
