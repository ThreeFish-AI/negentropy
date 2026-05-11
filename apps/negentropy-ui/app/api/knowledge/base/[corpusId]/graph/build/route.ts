import { DEFAULT_PROXY_TIMEOUT_MS, proxyPost } from "../../../../_proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  // 后端 fire-and-forget：_init_build_run 即刻返回 run_id，实际构建在后台 async Task 执行。
  // 30s 足以覆盖 init 阶段（DB insert + extractor 创建）；进度通过轮询 build-runs/latest 获取。
  return proxyPost(
    request,
    `/knowledge/base/${encodeURIComponent(corpusId)}/graph/build`,
    { timeoutMs: DEFAULT_PROXY_TIMEOUT_MS },
  );
}
