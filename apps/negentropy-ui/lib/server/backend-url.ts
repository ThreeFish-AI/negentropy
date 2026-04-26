/**
 * Negentropy BFF 后端基址单一事实源（SSOT）。
 *
 * 所有 Next.js Route Handler 统一通过 getAguiBaseUrl / getAuthBaseUrl /
 * getKnowledgeBaseUrl / getMemoryBaseUrl 解析后端服务地址，避免多处文件
 * 各自读取 process.env 造成漂移。
 *
 * 该模块仅应被 app/api/** 下的服务端代码 import，不应出现在任何
 * "use client" 组件中，以免意外被打包进客户端 bundle。
 */

export const DEFAULT_BACKEND_BASE_URL = "http://localhost:3292";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveFromEnvChain(envNames: readonly string[]): string {
  for (const name of envNames) {
    const value = readEnv(name);
    if (value !== undefined) return value;
  }
  return DEFAULT_BACKEND_BASE_URL;
}

/**
 * AGUI / 通用数据面后端基址。
 *
 * 读取优先级：AGUI_BASE_URL → NEXT_PUBLIC_AGUI_BASE_URL → 默认值。
 */
export function getAguiBaseUrl(): string {
  return resolveFromEnvChain(["AGUI_BASE_URL", "NEXT_PUBLIC_AGUI_BASE_URL"]);
}

/**
 * 认证面后端基址。
 *
 * 若显式设置 AUTH_BASE_URL 则优先使用；否则回落到 AGUI / 通用数据面基址，
 * 保证单体部署下的零配置体验。
 */
export function getAuthBaseUrl(): string {
  return resolveFromEnvChain([
    "AUTH_BASE_URL",
    "AGUI_BASE_URL",
    "NEXT_PUBLIC_AGUI_BASE_URL",
  ]);
}

/**
 * Knowledge 领域后端基址。
 *
 * 支持通过 KNOWLEDGE_BASE_URL 将知识库请求指向独立后端；否则复用 AGUI 基址。
 */
export function getKnowledgeBaseUrl(): string {
  return resolveFromEnvChain([
    "KNOWLEDGE_BASE_URL",
    "AGUI_BASE_URL",
    "NEXT_PUBLIC_AGUI_BASE_URL",
  ]);
}

/**
 * Memory 领域后端基址。
 *
 * 支持通过 MEMORY_BASE_URL 将记忆服务请求指向独立后端；否则复用 AGUI 基址。
 */
export function getMemoryBaseUrl(): string {
  return resolveFromEnvChain([
    "MEMORY_BASE_URL",
    "AGUI_BASE_URL",
    "NEXT_PUBLIC_AGUI_BASE_URL",
  ]);
}
