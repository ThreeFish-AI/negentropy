"use client";

/**
 * /interface/task-models — 全局后台任务模型映射管理页（admin）。
 *
 * 负责：为 Memory Consolidation / Session 等"无 corpus 概念"的后台 LLM 调用
 * 单独绑定具体模型。模型源自 /interface/models 页配置的 model_configs。
 *
 * 该页面只展示 scope=global 的任务槽位；scope=corpus 的任务槽位在 Knowledge Graph
 * Corpus 设置页（ModelConfigPanel 的 task-models 区块）中按 corpus 单独管理。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/AuthProvider";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { TaskModelSelect } from "@/components/interface/TaskModelSelect";
import type { ModelConfigRecord } from "@/types/interface-models";

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
  updated_at?: string | null;
}

const SAVE_DEBOUNCE_MS = 400;

export default function TaskModelsPage() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!user?.roles?.includes("admin")) {
      router.replace("/interface");
    }
  }, [user, status, router]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskSlot[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [models, setModels] = useState<ModelConfigRecord[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [registryRes, settingsRes, modelsRes] = await Promise.all([
        fetch("/api/interface/task-models/registry"),
        fetch("/api/interface/task-models/settings"),
        fetch("/api/interface/models/configs"),
      ]);
      if (!registryRes.ok) throw new Error(`registry: HTTP ${registryRes.status}`);
      if (!settingsRes.ok) throw new Error(`settings: HTTP ${settingsRes.status}`);
      if (!modelsRes.ok) throw new Error(`models: HTTP ${modelsRes.status}`);
      const registry = await registryRes.json();
      const settingsBody = await settingsRes.json();
      const modelsBody = await modelsRes.json();
      const allTasks: TaskSlot[] = registry.tasks || [];
      const allSettings: TaskSetting[] = settingsBody.settings || [];
      setTasks(allTasks.filter((t) => t.scope === "global"));
      const settingsMap: Record<string, string> = {};
      for (const s of allSettings) {
        settingsMap[s.task_key] = s.model_config_id;
      }
      setSettings(settingsMap);
      setModels(modelsBody.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // 把 ref 当前值 snapshot 到局部变量，避免 cleanup 时 ref 已变（react-hooks/exhaustive-deps）。
    const timers = debounceTimers.current;
    return () => {
      // 卸载时清理所有未触发的 debounce
      for (const t of timers.values()) clearTimeout(t);
    };
  }, [fetchAll]);

  const handleSave = useCallback(
    async (taskKey: string, modelConfigId: string) => {
      setSavingKey(taskKey);
      setSavedKey(null);
      try {
        if (modelConfigId === "") {
          const res = await fetch(
            `/api/interface/task-models/settings/${encodeURIComponent(taskKey)}`,
            { method: "DELETE" },
          );
          if (!res.ok) throw new Error(`DELETE failed: HTTP ${res.status}`);
        } else {
          const res = await fetch(
            `/api/interface/task-models/settings/${encodeURIComponent(taskKey)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model_config_id: modelConfigId }),
            },
          );
          if (!res.ok) {
            const body = await res.text();
            throw new Error(body || `PUT failed: HTTP ${res.status}`);
          }
        }
        setSavedKey(taskKey);
        setTimeout(() => {
          setSavedKey((current) => (current === taskKey ? null : current));
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "save failed");
      } finally {
        setSavingKey((current) => (current === taskKey ? null : current));
      }
    },
    [],
  );

  const handleChange = useCallback(
    (taskKey: string, modelConfigId: string) => {
      setSettings((prev) => ({ ...prev, [taskKey]: modelConfigId }));
      const existing = debounceTimers.current.get(taskKey);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        debounceTimers.current.delete(taskKey);
        handleSave(taskKey, modelConfigId);
      }, SAVE_DEBOUNCE_MS);
      debounceTimers.current.set(taskKey, timer);
    },
    [handleSave],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TaskSlot[]>();
    for (const t of tasks) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return Array.from(map.entries());
  }, [tasks]);

  if (status === "loading" || !user?.roles?.includes("admin")) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <InterfaceNav title="Task Models" />
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="mx-auto max-w-4xl space-y-4">
          <header className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">
              后台任务模型映射
            </h1>
            <p className="text-xs text-muted">
              为 Memory Consolidation / Session 等后台 LLM
              调用分别指定模型。模型来源是{" "}
              <a className="underline" href="/interface/models">
                /interface/models
              </a>{" "}
              页配置的 LLM 列表。留空 = 使用全局默认模型。Knowledge Graph
              相关任务请在对应 Corpus 设置页内单独配置。
            </p>
          </header>

          {loading && (
            <div className="text-sm text-muted">Loading...</div>
          )}
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
              {error}
            </div>
          )}

          {!loading &&
            grouped.map(([category, items]) => (
              <section
                key={category}
                className="rounded-lg border border-border bg-card"
              >
                <div className="border-b border-border px-4 py-2 text-sm font-semibold text-foreground">
                  {category}
                </div>
                <div className="divide-y divide-border">
                  {items.map((task) => {
                    const filtered = models.filter(
                      (m) => m.model_type === task.model_type,
                    );
                    return (
                      <div
                        key={task.task_key}
                        className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {task.label}
                            </span>
                            <code className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted">
                              {task.task_key}
                            </code>
                            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] uppercase text-muted">
                              {task.model_type}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted">{task.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <TaskModelSelect
                            models={filtered}
                            value={settings[task.task_key] ?? ""}
                            onChange={(id) => handleChange(task.task_key, id)}
                            disabled={savingKey === task.task_key}
                            ariaLabel={`Model for ${task.task_key}`}
                          />
                          {savingKey === task.task_key && (
                            <span className="text-[10px] text-muted">
                              保存中…
                            </span>
                          )}
                          {savedKey === task.task_key && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              已保存
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

          {!loading && grouped.length === 0 && (
            <div className="text-sm text-muted">
              暂无可配置的全局任务槽位。Knowledge
              Graph 相关任务请在 Corpus 设置页内配置。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
