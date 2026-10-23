/**
 * Memory 域 BFF 代理工具（薄绑定层）
 *
 * 实现收敛至单一事实源 `app/api/_lib/proxy.ts`（三域能力并集），本文件仅绑定
 * 域配置并保持导出面不变。
 *
 * 行为增强说明：本域原实现无超时，收敛后 JSON 方法族默认 30s 超时
 * （memory 域全部为快查询端点：search / facts / audit / job 控制面动作）。
 */

import { getMemoryBaseUrl } from "@/lib/server/backend-url";
import { createBffProxy, DEFAULT_PROXY_TIMEOUT_MS } from "@/app/api/_lib/proxy";

const proxy = createBffProxy({
  codePrefix: "MEMORY",
  envName: "MEMORY_BASE_URL",
  baseUrl: getMemoryBaseUrl,
  defaultTimeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
});

export const proxyGet = proxy.proxyGet;
export const proxyPost = proxy.proxyPost;
export const proxyDelete = proxy.proxyDelete;
