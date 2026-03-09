import { proxyPost } from "../../../../../../../_proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ corpusId: string; documentId: string; chunkId: string }> },
) {
  const { corpusId, documentId, chunkId } = await context.params;
  return proxyPost(
    request,
    `/knowledge/base/${corpusId}/documents/${documentId}/chunks/${chunkId}/regenerate-family`,
  );
}
