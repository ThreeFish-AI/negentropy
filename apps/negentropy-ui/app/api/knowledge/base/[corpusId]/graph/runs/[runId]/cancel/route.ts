import { proxyPost } from "../../../../../../_proxy";

/**
 * KG Build Run Cancel BFF 代理
 *
 * 后端：POST /knowledge/base/{corpus_id}/graph/runs/{run_id}/cancel
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ corpusId: string; runId: string }> },
) {
  const { corpusId, runId } = await params;
  return proxyPost(
    request,
    `/knowledge/base/${encodeURIComponent(corpusId)}/graph/runs/${encodeURIComponent(runId)}/cancel`,
  );
}
