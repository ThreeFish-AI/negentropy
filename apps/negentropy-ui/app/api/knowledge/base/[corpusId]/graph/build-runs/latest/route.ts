import { POLLING_RETRY, proxyGet } from "../../../../../_proxy";

/**
 * KG Build Run 最新状态轮询端点（前端 ``KgBuildProgressPill`` 每 3s 调用一次）。
 *
 * 启用 ``POLLING_RETRY`` 让 BFF 在 fetch failed / 502 / 503 / 504 等瞬态故障时
 * 自动重试 2 次（首次 + 2 次退避），把 KG 构建期间后端连接池抖动产生的
 * ``Upstream connection failed: TypeError: fetch failed`` 误导性错误吸收在 BFF 层，
 * 不再透传给前端 Pill 组件。详见 ``_proxy.ts`` ``RetryOptions`` 文档。
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  return proxyGet(
    request,
    `/knowledge/base/${encodeURIComponent(corpusId)}/graph/build-runs/latest`,
    { retry: POLLING_RETRY },
  );
}
