"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TaskModelSelect } from "@/components/interface/TaskModelSelect";
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

interface TaskSlot {
  task_key: string;
  model_type: "llm" | "embedding";
  scope: "global" | "corpus";
  label: string;
  category: string;
  description: string;
}

interface TaskSetting {
  scope_corpus_id: string | null;
  task_key: string;
  model_config_id: string;
}

const TASK_SAVE_DEBOUNCE_MS = 400;

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

  // Per-corpus task → model 映射状态
  const [taskSlots, setTaskSlots] = useState<TaskSlot[]>([]);
  const [taskSettings, setTaskSettings] = useState<Record<string, string>>({});
  const [taskSavingKey, setTaskSavingKey] = useState<string | null>(null);
  const [taskSavedKey, setTaskSavedKey] = useState<string | null>(null);
  const taskDebounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

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

  useEffect(() => {
    // 拉取 task 注册表（仅 scope=corpus）+ 当前 Corpus 的已绑定映射
    let cancelled = false;
    (async () => {
      try {
        const [regRes, settingsRes] = await Promise.all([
          fetch("/api/interface/task-models/registry"),
          fetch(
            `/api/knowledge/corpus/${encodeURIComponent(corpusId)}/task-models`,
          ),
        ]);
        if (!regRes.ok || !settingsRes.ok) return;
        const registry = await regRes.json();
        const settingsBody = await settingsRes.json();
        if (cancelled) return;
        const slots: TaskSlot[] = (registry.tasks || []).filter(
          (s: TaskSlot) => s.scope === "corpus",
        );
        setTaskSlots(slots);
        const map: Record<string, string> = {};
        for (const s of (settingsBody.settings || []) as TaskSetting[]) {
          map[s.task_key] = s.model_config_id;
        }
        setTaskSettings(map);
      } catch {
        // 静默：网络/未登录时该模块降级为隐藏
      }
    })();
    // 把 ref 当前值 snapshot 到局部变量，避免 cleanup 时 ref 已变（react-hooks/exhaustive-deps）。
    const timers = taskDebounceTimers.current;
    return () => {
      cancelled = true;
      for (const t of timers.values()) clearTimeout(t);
    };
  }, [corpusId]);

  const persistTaskSetting = useCallback(
    async (taskKey: string, modelConfigId: string) => {
      setTaskSavingKey(taskKey);
      setTaskSavedKey(null);
      try {
        const base = `/api/knowledge/corpus/${encodeURIComponent(corpusId)}/task-models/${encodeURIComponent(taskKey)}`;
        if (modelConfigId === "") {
          const res = await fetch(base, { method: "DELETE" });
          if (!res.ok) throw new Error(`DELETE failed: HTTP ${res.status}`);
        } else {
          const res = await fetch(base, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model_config_id: modelConfigId }),
          });
          if (!res.ok) {
            const body = await res.text();
            throw new Error(body || `PUT failed: HTTP ${res.status}`);
          }
        }
        setTaskSavedKey(taskKey);
        setTimeout(() => {
          setTaskSavedKey((current) => (current === taskKey ? null : current));
        }, 1500);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Task model 保存失败");
      } finally {
        setTaskSavingKey((current) => (current === taskKey ? null : current));
      }
    },
    [corpusId],
  );

  const handleTaskChange = useCallback(
    (taskKey: string, modelConfigId: string) => {
      setTaskSettings((prev) => ({ ...prev, [taskKey]: modelConfigId }));
      const existing = taskDebounceTimers.current.get(taskKey);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        taskDebounceTimers.current.delete(taskKey);
        persistTaskSetting(taskKey, modelConfigId);
      }, TASK_SAVE_DEBOUNCE_MS);
      taskDebounceTimers.current.set(taskKey, timer);
    },
    [persistTaskSetting],
  );

  const taskSlotsByType = useMemo(() => {
    return taskSlots.map((slot) => ({
      slot,
      candidates:
        slot.model_type === "llm" ? llmModels : embeddingModels,
    }));
  }, [taskSlots, llmModels, embeddingModels]);

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

      {taskSlotsByType.length > 0 && (
        <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            Task Models（per-task overrides）
          </h4>
          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            为该 Corpus 的子任务（实体/关系抽取、文档抽取）单独指定模型；留空 =
            回退到上方 LLM Model 与全局默认。
          </p>
          <div className="mt-2 space-y-2">
            {taskSlotsByType.map(({ slot, candidates }) => (
              <div
                key={slot.task_key}
                className="flex flex-col gap-1.5 rounded-lg border border-zinc-100 px-2 py-2 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {slot.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <TaskModelSelect
                      models={candidates}
                      value={taskSettings[slot.task_key] ?? ""}
                      onChange={(id) => handleTaskChange(slot.task_key, id)}
                      disabled={taskSavingKey === slot.task_key}
                      placeholder="使用 Corpus 默认"
                      ariaLabel={`Task model for ${slot.task_key}`}
                    />
                    {taskSavingKey === slot.task_key && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        保存中…
                      </span>
                    )}
                    {taskSavedKey === slot.task_key && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        已保存
                      </span>
                    )}
                  </div>
                </div>
                {slot.description && (
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {slot.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
