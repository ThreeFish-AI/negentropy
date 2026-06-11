import { proxyPost } from "../../../_proxy";

/**
 * POST /api/knowledge/base/{corpusId}/ingest_document
 * 将既有 Document 的 Markdown 索引进目标 Corpus（跨 Corpus 摄入）
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  return proxyPost(request, `/knowledge/base/${corpusId}/ingest_document`);
}
