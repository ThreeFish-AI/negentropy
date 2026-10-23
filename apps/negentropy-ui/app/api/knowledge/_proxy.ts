/**
 * Knowledge 域 BFF 代理工具（薄绑定层）
 *
 * 用于将前端 `/api/knowledge/*` 请求转发到后端 `/knowledge/*`。
 * 实现收敛至单一事实源 `app/api/_lib/proxy.ts`（三域能力并集），本文件仅绑定
 * 域配置（错误码前缀 / 环境变量名 / 基址解析器 / 默认超时）并保持导出面不变。
 *
 * ### 上游路径约定（SSOT）
 *
 * 跨域一致：Memory / Interface / Knowledge 三个 `_proxy.ts` 均使用
 * `new URL(path, baseUrl)` 构造上游 URL，**不会**在代理层拼接域前缀。
 * 因此本文件导出的 `proxyGet` / `proxyPost` / `proxyPatch` / `proxyDelete` /
 * `proxyPostFormData` / `proxyGetBinary` 等函数的 `path` 参数**必须**为
 * 含 `/knowledge` 前缀的后端绝对路径（与后端 `APIRouter(prefix="/knowledge")`
 * 声明对齐），否则会命中后端 FastAPI 404。
 *
 * ✅ 正确：`proxyPost(request, "/knowledge/catalog/nodes")`
 * ✅ 正确：`` proxyGet(request, `/knowledge/wiki/publications/${pubId}`) ``
 * ❌ 错误：`proxyPost(request, "/catalog/nodes")`          // 缺 `/knowledge`
 * ❌ 错误：`proxyGet(request, `/wiki/publications/${id}`)` // 缺 `/knowledge`
 *
 * 同构参考：`app/api/memory/_proxy.ts`（path 必含 `/memory/`）、
 * `app/api/interface/_proxy.ts`（path 必含 `/interface/` 或 `/routines/`、`/scheduler/`）。
 */

import { getKnowledgeBaseUrl } from "@/lib/server/backend-url";
import {
  createBffProxy,
  DEFAULT_PROXY_TIMEOUT_MS,
} from "@/app/api/_lib/proxy";

const proxy = createBffProxy({
  codePrefix: "KNOWLEDGE",
  envName: "KNOWLEDGE_BASE_URL",
  baseUrl: getKnowledgeBaseUrl,
  // 域内既有契约：JSON 方法族默认 30s（长任务端点按需传 timeoutMs 覆盖）
  defaultTimeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
});

export const proxyGet = proxy.proxyGet;
export const proxyPost = proxy.proxyPost;
export const proxyPostFormData = proxy.proxyPostFormData;
export const proxyPatch = proxy.proxyPatch;
export const proxyDelete = proxy.proxyDelete;
export const proxyGetBinary = proxy.proxyGetBinary;

export {
  DEFAULT_PROXY_TIMEOUT_MS,
  DEFAULT_BINARY_PROXY_TIMEOUT_MS,
  LONG_TASK_PROXY_TIMEOUT_MS,
  POLLING_RETRY,
} from "@/app/api/_lib/proxy";
export type { RetryOptions } from "@/app/api/_lib/proxy";
