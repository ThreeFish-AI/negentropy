"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/activity-toast";
import {
  buildExtractorRoutesFromDraft,
  buildCorpusConfig,
  type CorpusRecord,
  type ChunkingConfig,
  type ExtractorDraftRoutes,
  type ExtractorDraftTarget,
  createEmptyExtractorDraftTarget,
  normalizeChunkingConfig,
  normalizeExtractorDraftRoutes,
  fetchModelConfigs,
  type ModelConfigItem,
  type CorpusModelsConfig,
} from "@/features/knowledge";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { ChunkingStrategyPanel } from "./ChunkingStrategyPanel";

function CorpusSettingsPanel({
  corpus,
  onSave,
}: {
  corpus: CorpusRecord;
  onSave: (config: Record<string, unknown>) => Promise<void>;
}) {
  const [formConfig, setFormConfig] = useState<ChunkingConfig>(
    normalizeChunkingConfig((corpus.config || {}) as Record<string, unknown>),
  );
  const [extractorDraftRoutes, setExtractorDraftRoutes] = useState<ExtractorDraftRoutes>(
    normalizeExtractorDraftRoutes((corpus.config || {}) as Record<string, unknown>),
  );
  const [servers, setServers] = useState<Array<{ id: string; name: string; display_name: string | null; is_enabled: boolean }>>([]);
  const [toolsByServer, setToolsByServer] = useState<Record<string, Array<{ name: string; display_name: string | null; is_enabled: boolean }>>>({});

  // Models settings
  const corpusModels = ((corpus.config || {}) as Record<string, unknown>).models as CorpusModelsConfig | undefined;
  const [llmConfigId, setLlmConfigId] = useState<string | "">(corpusModels?.llm_config_id ?? "");
  const [embeddingConfigId, setEmbeddingConfigId] = useState<string | "">(corpusModels?.embedding_config_id ?? "");
  const [llmModels, setLlmModels] = useState<ModelConfigItem[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<ModelConfigItem[]>([]);
  const [confirmDimensionDialog, setConfirmDimensionDialog] = useState<{ pending: Record<string, unknown>; newDims?: number; oldDims?: number } | null>(null);

  useEffect(() => {
    let active = true;

    const loadServers = async () => {
      const response = await fetch("/api/interface/mcp/servers");
      if (!response.ok) {
        throw new Error("Failed to load MCP servers");
      }
      const data = (await response.json()) as Array<{
        id: string;
        name: string;
        display_name: string | null;
        is_enabled: boolean;
      }>;
      if (!active) return;
      const enabledServers = data.filter((item) => item.is_enabled);
      setServers(enabledServers);

      const toolEntries = await Promise.all(
        enabledServers.map(async (server) => {
          const toolsResponse = await fetch(`/api/interface/mcp/servers/${server.id}/tools`);
          if (!toolsResponse.ok) {
            return [server.id, []] as const;
          }
          const tools = (await toolsResponse.json()) as Array<{
            name: string;
            display_name: string | null;
            is_enabled: boolean;
          }>;
          return [server.id, tools.filter((item) => item.is_enabled)] as const;
        }),
      );
      if (!active) return;
      setToolsByServer(Object.fromEntries(toolEntries));
    };

    void loadServers().catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load MCP servers");
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void fetchModelConfigs({ modelType: "llm", enabled: true })
      .then(setLlmModels)
      .catch(() => {});
    void fetchModelConfigs({ modelType: "embedding", enabled: true })
      .then(setEmbeddingModels)
      .catch(() => {});
  }, []);

  const modelsConfig: CorpusModelsConfig = {
    llm_config_id: llmConfigId || undefined,
    embedding_config_id: embeddingConfigId || undefined,
  };

  const handleSubmit = async () => {
    const config = buildCorpusConfig(
      formConfig,
      buildExtractorRoutesFromDraft(extractorDraftRoutes),
      modelsConfig,
    );

    // 维度变更校验
    const oldEid = corpusModels?.embedding_config_id;
    const newEid = embeddingConfigId || undefined;
    if (oldEid !== newEid && newEid && corpus.knowledge_count > 0) {
      const oldItem = embeddingModels.find((m) => m.id === oldEid);
      const newItem = embeddingModels.find((m) => m.id === newEid);
      const oldDims = oldItem?.config?.dimensions as number | undefined;
      const newDims = newItem?.config?.dimensions as number | undefined;
      if (oldDims != null && newDims != null && oldDims !== newDims) {
        setConfirmDimensionDialog({ pending: config, oldDims, newDims });
        return;
      }
    }

    await onSave(config);
  };

  return (
    <div className="space-y-3">
      <ChunkingStrategyPanel
        config={formConfig}
        onChange={setFormConfig}
        title="Chunking Settings"
        description="保存后作为该 Corpus 的默认分块配置。"
      />

      {/* Models Settings */}
      <div className="rounded-2xl border border-border bg-background p-4">
        <h3 className="text-sm font-semibold">Models Settings</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Embedding Model 影响 Embedding Indexing / Vector Search；LLM Model 影响 URL 与 PDF 文档抽取调用 MCP 时的 Plan LLM。
        </p>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Embedding Model
            </label>
            <select
              value={embeddingConfigId}
              onChange={(e) => setEmbeddingConfigId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">(使用全局默认)</option>
              {embeddingModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name?.trim() || `${m.vendor}/${m.model_name}`}
                </option>
              ))}
            </select>
            {embeddingConfigId && (() => {
              const sel = embeddingModels.find((m) => m.id === embeddingConfigId);
              const dims = typeof sel?.config?.dimensions === "number" ? sel.config.dimensions : null;
              return dims != null ? (
                <span className="mt-1 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {dims} dims
                </span>
              ) : null;
            })()}
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              LLM Model
            </label>
            <select
              value={llmConfigId}
              onChange={(e) => setLlmConfigId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">(使用全局默认)</option>
              {llmModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name?.trim() || `${m.vendor}/${m.model_name}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dimension change confirm dialog */}
      {confirmDimensionDialog && (
        <OverlayDismissLayer
          open
          onClose={() => setConfirmDimensionDialog(null)}
          containerClassName="p-4"
          contentClassName="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
          contentProps={{ role: "dialog", "aria-modal": true }}
        >
          <h3 className="text-base font-semibold text-red-600 dark:text-red-400 mb-2">
            Embedding 维度变更确认
          </h3>
          <p className="text-sm text-text-secondary">
            切换 Embedding Model 会导致现有{" "}
            <strong>{corpus.knowledge_count}</strong> 个 Knowledge 块的向量维度不匹配
            （{confirmDimensionDialog.oldDims} → {confirmDimensionDialog.newDims} dims），
            保存后系统将自动触发重建流水线，耗时取决于文档数量。
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setConfirmDimensionDialog(null)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:bg-muted"
            >
              取消
            </button>
            <button
              onClick={async () => {
                const { pending } = confirmDimensionDialog;
                setConfirmDimensionDialog(null);
                await onSave(pending);
              }}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-500"
            >
              确认继续
            </button>
          </div>
        </OverlayDismissLayer>
      )}

      <div className="rounded-2xl border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Document Extraction Settings</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              通过 MCP Tools 为当前 Corpus 注入 URL、PDF 等源文档解释器。
            </p>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              可用于此处的 Tool 需提供可发现的 input/output schema，并能返回正文 Markdown 或文本；当前兼容单文档扁平协议，以及单个
              sources 数组的 batch 协议，系统会自动把单个 URL/PDF 请求包装为对应格式。
            </p>
          </div>
        </div>

        {([
          ["url", "URL 文档", "页面抓取、正文抽取、Markdown 化"],
          ["file_pdf", "PDF 文档", "PDF 解析、Markdown 转换、图片提取"],
        ] as const).map(([routeKey, title, description]) => {
          const targets = extractorDraftRoutes[routeKey];
          return (
            <div key={routeKey} className="mt-4 rounded-xl border border-border p-3">
              <div className="mb-3">
                <div className="text-xs font-semibold">{title}</div>
                <div className="text-[11px] text-muted-foreground">{description}</div>
              </div>
              <div className="space-y-3">
                {[0, 1].map((index) => {
                  const target = targets[index];
                  const selectedServerId = target?.server_id || "";
                  const toolOptions = selectedServerId
                    ? (toolsByServer[selectedServerId] || [])
                    : [];
                  const selectedServer =
                    servers.find((server) => server.id === selectedServerId) || null;
                  const hasSelectedTool = toolOptions.some(
                    (tool) => tool.name === target.tool_name,
                  );

                  const serverOptions = selectedServerId && !selectedServer
                    ? [
                        {
                          id: selectedServerId,
                          name: selectedServerId,
                          display_name: "已配置 MCP（当前不可用）",
                          is_enabled: false,
                        },
                        ...servers,
                      ]
                    : servers;
                  const visibleToolOptions =
                    target.tool_name && !hasSelectedTool
                      ? [
                          {
                            name: target.tool_name,
                            display_name: "已配置 Tool（当前不可用）",
                            is_enabled: false,
                          },
                          ...toolOptions,
                        ]
                      : toolOptions;

                  const setTarget = (patch: Partial<ExtractorDraftTarget>) => {
                    setExtractorDraftRoutes((prev) => {
                      const nextRoute = [...prev[routeKey]] as typeof prev[typeof routeKey];
                      nextRoute[index] = {
                        ...nextRoute[index],
                        ...patch,
                        priority: index,
                        enabled: true,
                      };
                      return {
                        ...prev,
                        [routeKey]: nextRoute,
                      };
                    });
                  };

                  const clearTarget = () => {
                    setExtractorDraftRoutes((prev) => {
                      const nextRoute = [...prev[routeKey]] as typeof prev[typeof routeKey];
                      nextRoute[index] = createEmptyExtractorDraftTarget(index);
                      return {
                        ...prev,
                        [routeKey]: nextRoute,
                      };
                    });
                  };

                  return (
                    <div key={`${routeKey}-${index}`} className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[120px_1fr_1fr_auto]">
                      <div className="text-xs font-semibold text-text-secondary">
                        {index === 0 ? "主用" : "备用"}
                      </div>
                      <label className="text-xs">
                        <div className="mb-1 text-muted-foreground">MCP Server</div>
                        <select
                          value={selectedServerId}
                          onChange={(e) =>
                            setTarget({ server_id: e.target.value, tool_name: "" })
                          }
                          className="w-full rounded border border-border bg-background px-2 py-2"
                        >
                          <option value="">未配置</option>
                          {serverOptions.map((server) => (
                            <option key={server.id} value={server.id}>
                              {server.display_name || server.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs">
                        <div className="mb-1 text-muted-foreground">Tool</div>
                        <select
                          value={target?.tool_name || ""}
                          onChange={(e) => setTarget({ tool_name: e.target.value })}
                          disabled={!selectedServerId}
                          className="w-full rounded border border-border bg-background px-2 py-2 disabled:opacity-50"
                        >
                          <option value="">未配置</option>
                          {visibleToolOptions.map((tool) => (
                            <option key={tool.name} value={tool.name}>
                              {tool.display_name || tool.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={clearTarget}
                          className={outlineButtonClassName("neutral", "rounded px-3 py-2 text-[11px]")}
                        >
                          清空
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          className="rounded bg-foreground px-3 py-2 text-xs font-semibold text-background"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}

export { CorpusSettingsPanel };
