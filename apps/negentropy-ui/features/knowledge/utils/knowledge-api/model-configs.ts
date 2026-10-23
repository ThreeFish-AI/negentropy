/**
 * 模型配置与 Corpus 抽取器路由（extractor routes）的读取、规范化与组装
 */
import type { ChunkingConfig } from "./chunking-config";

export type ExtractorSourceKind = "url" | "file_pdf" | "file_md";

export interface McpExtractorTargetConfig {
  server_id: string;
  tool_name: string;
  priority: number;
  enabled: boolean;
  timeout_ms?: number;
  tool_options?: Record<string, unknown>;
}

export interface CorpusExtractorRouteConfig {
  targets: McpExtractorTargetConfig[];
}

export type CorpusExtractorRouteKey = "url" | "file_pdf" | "file_md";
export type CorpusExtractorTargets = McpExtractorTargetConfig[];
export type ExtractorDraftTarget = McpExtractorTargetConfig;
export type ExtractorDraftRoute = [ExtractorDraftTarget, ExtractorDraftTarget];
export type ExtractorDraftRoutes = Record<CorpusExtractorRouteKey, ExtractorDraftRoute>;

export interface ModelConfigItem {
  id: string;
  model_type: "llm" | "embedding" | "rerank";
  display_name: string;
  vendor: string;
  model_name: string;
  is_default: boolean;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface CorpusModelsConfig {
  llm_config_id?: string | null;
  embedding_config_id?: string | null;
}

export interface CorpusExtractorRoutes {
  url?: CorpusExtractorRouteConfig;
  file_pdf?: CorpusExtractorRouteConfig;
  file_md?: CorpusExtractorRouteConfig;
}

export type NormalizedCorpusExtractorRoutes = Record<
  CorpusExtractorRouteKey,
  CorpusExtractorRouteConfig
>;

export function createEmptyExtractorDraftTarget(
  priority: number,
): ExtractorDraftTarget {
  return {
    server_id: "",
    tool_name: "",
    priority,
    enabled: true,
  };
}

function createExtractorDraftRoute(
  targets: ReadonlyArray<McpExtractorTargetConfig>,
): ExtractorDraftRoute {
  return [0, 1].map((priority) => {
    const existing =
      targets.find((item) => item.priority === priority) || targets[priority];
    return existing
      ? {
          ...existing,
          priority,
          enabled: existing.enabled !== false,
        }
      : createEmptyExtractorDraftTarget(priority);
  }) as ExtractorDraftRoute;
}

function normalizeExtractorTargets(
  value: unknown,
): McpExtractorTargetConfig[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => ({
      server_id: String(item.server_id || ""),
      tool_name: String(item.tool_name || ""),
      priority: Number(item.priority || 0),
      enabled: item.enabled !== false,
      timeout_ms:
        item.timeout_ms === undefined ? undefined : Number(item.timeout_ms),
      tool_options:
        typeof item.tool_options === "object" && item.tool_options !== null
          ? (item.tool_options as Record<string, unknown>)
          : {},
    }))
    .filter((item) => item.server_id && item.tool_name)
    .sort((a, b) => a.priority - b.priority);
}

export function normalizeCorpusExtractorRoutes(
  config?: Record<string, unknown> | null,
): NormalizedCorpusExtractorRoutes {
  const raw =
    typeof config?.extractor_routes === "object" &&
    config.extractor_routes !== null
      ? (config.extractor_routes as Record<string, unknown>)
      : {};

  const normalizeRoute = (route: unknown): CorpusExtractorRouteConfig => ({
    targets: normalizeExtractorTargets(
      typeof route === "object" && route !== null
        ? (route as Record<string, unknown>).targets
        : undefined,
    ),
  });

  return {
    url: normalizeRoute(raw.url),
    file_pdf: normalizeRoute(raw.file_pdf),
    file_md: normalizeRoute(raw.file_md),
  };
}

export function normalizeExtractorDraftRoutes(
  config?: Record<string, unknown> | null,
): ExtractorDraftRoutes {
  const normalized = normalizeCorpusExtractorRoutes(config);
  return {
    url: createExtractorDraftRoute(normalized.url.targets),
    file_pdf: createExtractorDraftRoute(normalized.file_pdf.targets),
    file_md: createExtractorDraftRoute(normalized.file_md?.targets || []),
  };
}

export function buildExtractorRoutesFromDraft(
  draft: ExtractorDraftRoutes,
): NormalizedCorpusExtractorRoutes {
  const buildTargets = (targets: ExtractorDraftRoute | undefined) =>
    (targets || [])
      .filter((item) => item.server_id && item.tool_name)
      .map((item, priority) => ({
        ...item,
        priority,
        enabled: item.enabled !== false,
      }));

  return {
    url: { targets: buildTargets(draft.url) },
    file_pdf: { targets: buildTargets(draft.file_pdf) },
    file_md: { targets: buildTargets(draft.file_md) },
  };
}

export function buildCorpusConfig(
  chunkingConfig: ChunkingConfig,
  extractorRoutes?: CorpusExtractorRoutes | NormalizedCorpusExtractorRoutes,
  models?: CorpusModelsConfig | null,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ...(chunkingConfig as unknown as Record<string, unknown>),
    extractor_routes: {
      url: { targets: extractorRoutes?.url?.targets || [] },
      file_pdf: { targets: extractorRoutes?.file_pdf?.targets || [] },
      file_md: { targets: extractorRoutes?.file_md?.targets || [] },
    },
  };
  if (models) {
    const clean: Record<string, string> = {};
    if (models.llm_config_id) clean.llm_config_id = models.llm_config_id;
    if (models.embedding_config_id) clean.embedding_config_id = models.embedding_config_id;
    if (Object.keys(clean).length > 0) result.models = clean;
  }
  return result;
}
export async function fetchModelConfigs(params?: {
  modelType?: string;
  enabled?: boolean;
}): Promise<ModelConfigItem[]> {
  const qs = new URLSearchParams();
  if (params?.modelType) qs.set("model_type", params.modelType);
  if (params?.enabled !== undefined) qs.set("enabled", String(params.enabled));
  const query = qs.toString();
  const res = await fetch(`/api/interface/models/configs${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    // 该端点目前以 admin 鉴权读取（详见 `/admin` rebuild 路径）；
    // 普通用户以 401/403 命中是符合后端预期的"无权读取"语义，不构成错误：返回
    // 空数组让调用方静默降级到系统默认模型，避免在控制台抛 [error]/WARN。
    // 500 等其它错误仍照旧抛出，触发 UI 兜底告警。
    // TODO(评审 #3): 后续可拆分 401（异常路径→抛出保留排障线索）vs
    // 403（角色拒绝→静默降级），但当前 E2E CI 对 401 抛出的容错不足，
    // 先保持与之前行为一致（401/403 一概静默），待 admin 排障路径成熟后再拆。
    if (res.status === 401 || res.status === 403) {
      return [];
    }
    throw new Error(`Failed to fetch model configs: ${res.statusText}`);
  }
  const data = await res.json();
  return data.items || [];
}
