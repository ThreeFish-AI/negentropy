/**
 * Plugins / Interface 域 BFF 代理工具（薄绑定层）
 *
 * 用于将前端的 /api/interface/* 请求代理到后端 /interface/* API；
 * 另被 /api/routine/* 与 /api/scheduler/* 反向代理复用（SSE 流式端点除外）。
 * 实现收敛至单一事实源 `app/api/_lib/proxy.ts`（三域能力并集），本文件仅绑定
 * 域配置并保持导出面不变。
 *
 * 超时保守对齐：本域不设默认超时（defaultTimeoutMs 未配置）。后端 MCP
 * `tools:execute` 操作阶段超时上限为 120s（interface/mcp_client.py
 * DEFAULT_OPERATION_TIMEOUT_SECONDS），BFF 预设更短的默认值会先于后端自身的
 * 超时裁决截断合法长调用、并把「工具错误 JSON」改写成「BFF 504 信封」；
 * 需要超时的端点可显式传 `timeoutMs`。
 */

import { getAguiBaseUrl } from "@/lib/server/backend-url";
import { createBffProxy } from "@/app/api/_lib/proxy";

const proxy = createBffProxy({
  codePrefix: "PLUGINS",
  envName: "AGUI_BASE_URL",
  baseUrl: getAguiBaseUrl,
});

export const proxyGet = proxy.proxyGet;
export const proxyPost = proxy.proxyPost;
export const proxyPostFormData = proxy.proxyPostFormData;
export const proxyPatch = proxy.proxyPatch;
export const proxyPut = proxy.proxyPut;
export const proxyDelete = proxy.proxyDelete;
