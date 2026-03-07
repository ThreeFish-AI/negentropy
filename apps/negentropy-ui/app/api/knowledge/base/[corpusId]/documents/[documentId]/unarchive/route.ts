import { proxyPost } from "../../../../../_proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ corpusId: string; documentId: string }> },
) {
  const { corpusId, documentId } = await context.params;
  return proxyPost(
    request,
    `/knowledge/base/${corpusId}/documents/${documentId}/unarchive`,
  );
}
