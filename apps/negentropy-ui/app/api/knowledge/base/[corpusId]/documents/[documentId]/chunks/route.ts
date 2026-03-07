import { proxyGet } from "../../../../../_proxy";

export async function GET(
  request: Request,
  context: { params: Promise<{ corpusId: string; documentId: string }> },
) {
  const { corpusId, documentId } = await context.params;
  return proxyGet(
    request,
    `/knowledge/base/${corpusId}/documents/${documentId}/chunks`,
  );
}
