/**
 * Negentropy BFF 后端基址单一事实源（SSOT）。
 *
 * 所有 Next.js Route Handler 统一通过 getAguiBaseUrl / getAuthBaseUrl /
 * getKnowledgeBaseUrl / getMemoryBaseUrl 解析后端服务地址，避免多处文件
 * 各自读取 process.env 造成漂移，并内置「遗留端口迁移守护」以保证端口
 * 迁移后的向后兼容。
 *
 * 该模块仅应被 app/api/** 下的服务端代码 import，不应出现在任何
 * "use client" 组件中，以免意外被打包进客户端 bundle。
 */

export const DEFAULT_BACKEND_BASE_URL = "http://localhost:3292";

/** 曾经作为后端默认端口、但已在后续迁移中弃用的本地端口列表。 */
export const LEGACY_LOCAL_PORTS: readonly string[] = ["6600", "6666"];

/** 迁移守护仅对本地环回地址生效。 */
const LOCAL_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

/** 当前后端默认监听端口（与 apps/negentropy/src/negentropy/cli.py 对齐）。 */
const CURRENT_BACKEND_PORT = "3292";

/** 同一 URL 只告警一次，避免每次 BFF 请求都打印导致日志噪音。 */
const warnedUrls = new Set<string>();

function isLegacyLocalhostUrl(raw: string): { host: string; port: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!LOCAL_HOSTS.includes(parsed.hostname)) {
    return null;
  }
  if (!parsed.port) {
    return null;
  }
  if (!LEGACY_LOCAL_PORTS.includes(parsed.port)) {
    return null;
  }
  return { host: parsed.hostname, port: parsed.port };
}

function applyLegacyPortMigration(raw: string, sourceLabel: string): string {
  const legacy = isLegacyLocalhostUrl(raw);
  if (!legacy) {
    return raw;
  }

  const warnKey = `${sourceLabel}::${raw}`;
  if (!warnedUrls.has(warnKey)) {
    warnedUrls.add(warnKey);
    console.warn(
      `[backend-url] 检测到 ${sourceLabel}=${raw} 指向已弃用端口 :${legacy.port}；` +
        `后端已迁移至 :${CURRENT_BACKEND_PORT}。请更新 apps/negentropy-ui/.env.local。`,
    );
  }

  if (process.env.NODE_ENV === "production") {
    return raw;
  }

  const rewritten = new URL(raw);
  rewritten.port = CURRENT_BACKEND_PORT;
  return rewritten.toString().replace(/\/$/, "");
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickFirstNonEmpty(
  candidates: ReadonlyArray<[string, string | undefined]>,
): { label: string; value: string } | null {
  for (const [label, value] of candidates) {
    if (value !== undefined) {
      return { label, value };
    }
  }
  return null;
}

function resolveFromEnvChain(envNames: readonly string[]): string {
  const picked = pickFirstNonEmpty(envNames.map((name) => [name, readEnv(name)] as const));
  if (!picked) {
    return DEFAULT_BACKEND_BASE_URL;
  }
  return applyLegacyPortMigration(picked.value, picked.label);
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

/**
 * 测试专用：清空告警去重缓存。
 * 生产代码请勿调用。
 */
export function __resetLegacyPortWarningsForTests(): void {
  warnedUrls.clear();
}
