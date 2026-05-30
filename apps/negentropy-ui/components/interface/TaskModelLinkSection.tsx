/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集。
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TaskModelSelect } from "@/components/interface/TaskModelSelect";
import { Button } from "@/components/ui/Button";
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

interface TaskModelLinkSectionProps {
  models: ModelConfigRecord[];
}

export function TaskModelLinkSection({ models }: TaskModelLinkSectionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskSlot[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [registryRes, settingsRes] = await Promise.all([
        fetch("/api/interface/task-models/registry"),
        fetch("/api/interface/task-models/settings"),
      ]);
      if (!registryRes.ok) throw new Error(`registry: HTTP ${registryRes.status}`);
      if (!settingsRes.ok) throw new Error(`settings: HTTP ${settingsRes.status}`);
      const registry = await registryRes.json();
      const settingsBody = await settingsRes.json();
      const allTasks: TaskSlot[] = registry.tasks || [];
      const allSettings: TaskSetting[] = settingsBody.settings || [];
      setTasks(allTasks.filter((t) => t.scope === "global"));
      const settingsMap: Record<string, string> = {};
      for (const s of allSettings) {
        settingsMap[s.task_key] = s.model_config_id;
      }
      setSettings(settingsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const timers = debounceTimers.current;
    return () => {
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

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Model Link
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            为 Memory Consolidation / Session 等后台任务绑定模型，留空使用全局默认。
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
          <Button
            variant="link"
            size="sm"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-text-muted">Loading...</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, items]) => (
            <section
              key={category}
              className="rounded-xl border border-border bg-card"
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
                          <code className="rounded bg-muted px-1.5 py-0.5 text-micro text-text-muted">
                            {task.task_key}
                          </code>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-micro uppercase tracking-overline text-text-muted">
                            {task.model_type}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-xs text-text-muted">{task.description}</p>
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
                          <span className="text-micro text-text-muted">
                            保存中…
                          </span>
                        )}
                        {savedKey === task.task_key && (
                          <span className="text-micro text-emerald-600 dark:text-emerald-400">
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
          {grouped.length === 0 && (
            <div className="text-sm text-text-muted">
              暂无可配置的全局任务槽位。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
