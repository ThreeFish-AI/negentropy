import { LONG_TASK_PROXY_TIMEOUT_MS, proxyPost } from "../../../../_proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  // KG build 是长任务（典型 1k chunk 数分钟）：默认 30s 不够；用长任务上限 15min。
  // UI 通过 SSE 订阅 progress 端点拿到 SSoT，POST 即便超时也不影响最终态显示。
  return proxyPost(
    request,
    `/knowledge/base/${encodeURIComponent(corpusId)}/graph/build`,
    { timeoutMs: LONG_TASK_PROXY_TIMEOUT_MS },
  );
}
