import { proxyPost } from "../../../_proxy";

/**
 * KB Pipeline Run Retry BFF 代理（双入口：断点续传 / 重新开始）
 *
 * 后端：POST /knowledge/pipelines/{run_id}/retry
 * body: { app_name?, resume }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return proxyPost(
    request,
    `/knowledge/pipelines/${encodeURIComponent(runId)}/retry`,
  );
}
