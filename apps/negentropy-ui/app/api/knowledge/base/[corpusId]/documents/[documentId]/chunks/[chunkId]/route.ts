import { proxyGet, proxyPatch } from "../../../../../../_proxy";

export async function GET(
  request: Request,
  context: { params: Promise<{ corpusId: string; documentId: string; chunkId: string }> },
) {
  const { corpusId, documentId, chunkId } = await context.params;
  return proxyGet(
    request,
    `/knowledge/base/${corpusId}/documents/${documentId}/chunks/${chunkId}`,
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ corpusId: string; documentId: string; chunkId: string }> },
) {
  const { corpusId, documentId, chunkId } = await context.params;
  return proxyPatch(
    request,
    `/knowledge/base/${corpusId}/documents/${documentId}/chunks/${chunkId}`,
  );
}
