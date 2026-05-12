"use client";

import { useEffect, useState } from "react";

import {
  type CorpusModelsConfig,
  type ModelConfigItem,
  fetchModelConfigs,
  updateCorpus,
} from "@/features/knowledge";

interface ModelConfigPanelProps {
  corpusId: string;
  corpusConfig: Record<string, unknown> | undefined;
  onConfigSaved: () => void;
  llmModels?: ModelConfigItem[];
}

export function ModelConfigPanel({
  corpusId,
  corpusConfig,
  onConfigSaved,
  llmModels: llmModelsProp,
}: ModelConfigPanelProps) {
  const corpusModels = (corpusConfig?.models ?? {}) as CorpusModelsConfig;
  const [llmConfigId, setLlmConfigId] = useState<string>(
    corpusModels?.llm_config_id ?? "",
  );
  const [embeddingConfigId, setEmbeddingConfigId] = useState<string>(
    corpusModels?.embedding_config_id ?? "",
  );
  const [llmModels, setLlmModels] = useState<ModelConfigItem[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<ModelConfigItem[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (llmModelsProp) {
      setLlmModels(llmModelsProp);
    } else {
      fetchModelConfigs({ modelType: "llm", enabled: true })
        .then(setLlmModels)
        .catch(() => {});
    }
    fetchModelConfigs({ modelType: "embedding", enabled: true })
      .then(setEmbeddingModels)
      .catch(() => {});
  }, [llmModelsProp]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const models: CorpusModelsConfig = {
        llm_config_id: llmConfigId || undefined,
        embedding_config_id: embeddingConfigId || undefined,
      };
      const existing = corpusConfig ?? {};
      await updateCorpus(corpusId, {
        config: { ...existing, models },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onConfigSaved();
    } catch (err) {
      setSaveError("保存失败，请重试");
      console.error("save_model_config_failed", err);
    } finally {
      setSaving(false);
    }
  };

  const selectedEmbedding = embeddingModels.find(
    (m) => m.id === embeddingConfigId,
  );
  const dims =
    typeof selectedEmbedding?.config?.dimensions === "number"
      ? selectedEmbedding.config.dimensions
      : null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Model Settings
      </h3>
      <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
        LLM 用于图谱实体/关系抽取与社区摘要；Embedding 用于向量化与检索
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            LLM Model
          </label>
          <select
            value={llmConfigId}
            onChange={(e) => setLlmConfigId(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">(使用全局默认)</option>
            {llmModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name} · {m.vendor}/{m.model_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Embedding Model
          </label>
          <select
            value={embeddingConfigId}
            onChange={(e) => setEmbeddingConfigId(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">(使用全局默认)</option>
            {embeddingModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name} · {m.vendor}/{m.model_name}
              </option>
            ))}
          </select>
          {dims != null && (
            <span className="mt-1 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {dims} dims
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        {saving ? "保存中..." : saved ? "已保存" : "保存"}
      </button>
      {saveError && (
        <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">{saveError}</p>
      )}
    </div>
  );
}
