import { proxyPost } from "../../../_proxy";

/**
 * KB Pipeline Run Cancel BFF 代理
 *
 * 后端：POST /knowledge/pipelines/{run_id}/cancel
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return proxyPost(
    request,
    `/knowledge/pipelines/${encodeURIComponent(runId)}/cancel`,
  );
}
