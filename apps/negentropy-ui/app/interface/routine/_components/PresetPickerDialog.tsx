/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useEffect, useState } from "react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import type { RoutinePresetSummary } from "@/features/routine";
import { createRoutineFromPreset, fetchPresets } from "@/features/routine";
import { toast } from "sonner";

interface PresetPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/** approval_mode → 中文标签 + 颜色 */
const APPROVAL_BADGE: Record<string, { label: string; cls: string }> = {
  auto: { label: "全自动", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  first: { label: "首次审批", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  every: { label: "每轮审批", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
};

/**
 * 「Demo 预设...」对话框：列出内置 Routine Demo 预设，
 * 用户选择后填写 key + cwd 即可一键创建。
 *
 * 设计：
 * - 数据通过 BFF GET /api/routine/presets 获取；
 * - 创建走 BFF POST /api/routine/from-preset，用户仅需提供 key + cwd；
 * - 不在此处缓存预设列表，每次 open 重新拉取以反映 backend 端 yaml 变化。
 */
export function PresetPickerDialog({ open, onClose, onCreated }: PresetPickerDialogProps) {
  const [presets, setPresets] = useState<RoutinePresetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 选中态
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [cwd, setCwd] = useState("");
  const [creating, setCreating] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // 打开时拉取预设列表
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setKey("");
    setCwd("");
    setFieldError(null);
    fetchPresets()
      .then((data) => {
        if (cancelled) return;
        setPresets(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "An error occurred");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 选中预设时自动生成 key
  const handleSelect = (preset: RoutinePresetSummary) => {
    if (selectedId === preset.preset_id) {
      // 取消选中
      setSelectedId(null);
      setKey("");
      setCwd("");
      setFieldError(null);
      return;
    }
    setSelectedId(preset.preset_id);
    const hex = crypto.randomUUID().slice(0, 4);
    setKey(`demo-${preset.preset_id}-${hex}`);
    setCwd("");
    setFieldError(null);
  };

  const handleCreate = async () => {
    if (!selectedId) return;
    if (!cwd.trim()) {
      setFieldError("Working Directory is required");
      return;
    }
    if (!key.trim()) {
      setFieldError("Key is required");
      return;
    }
    setCreating(true);
    setFieldError(null);
    try {
      await createRoutineFromPreset({ preset_id: selectedId, key: key.trim(), cwd: cwd.trim() });
      const preset = presets.find((p) => p.preset_id === selectedId);
      toast.success(`Routine created from "${preset?.display_name ?? selectedId}"`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const busy = creating;

  const inputCls =
    "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
  const labelCls = "mb-1 block text-xs font-medium text-text-secondary";

  return (
    <OverlayDismissLayer
      open={open}
      onClose={onClose}
      busy={busy}
      containerClassName="flex min-h-full items-start justify-center overflow-y-auto p-4 sm:p-6"
      contentClassName="my-3 flex max-h-[calc(100vh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-modal border border-border bg-card shadow-xl sm:max-h-[calc(100vh-2rem)]"
    >
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">Demo 预设</h2>
        <p className="mt-1 text-sm text-text-muted">
          选择一个内置 Demo 场景，快速体验 Routine 的全部核心能力
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
        {loading && (
          <div className="text-sm text-text-muted">Loading presets…</div>
        )}
        {error && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && presets.length === 0 && (
          <div className="text-sm text-text-muted">No built-in presets available.</div>
        )}

        <ul className="space-y-3">
          {presets.map((preset) => {
            const isSelected = selectedId === preset.preset_id;
            const badge = APPROVAL_BADGE[preset.approval_mode];
            return (
              <li key={preset.preset_id}>
                <button
                  type="button"
                  onClick={() => handleSelect(preset)}
                  className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-foreground/30 bg-muted/50"
                      : "border-border hover:border-foreground/15 hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {preset.display_name}
                    </h3>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-micro text-text-secondary">
                      v{preset.version}
                    </span>
                    <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-micro text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      {preset.category}
                    </span>
                    {badge && (
                      <span className={`rounded-full px-1.5 py-0.5 text-micro ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-micro text-text-secondary">
                      Gate: {preset.has_verification_command ? "✓" : "✗"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted line-clamp-3">
                    {preset.description}
                  </p>
                  {preset.features_showcase.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {preset.features_showcase.map((f, i) => (
                        <span
                          key={i}
                          className="rounded bg-muted px-1.5 py-0.5 text-micro text-text-secondary"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </button>

                {/* 选中后展示 key + cwd 输入 */}
                {isSelected && (
                  <div className="mt-2 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                    <div>
                      <label className={labelCls}>
                        Key <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="unique_routine_key"
                        className={`${inputCls} ${fieldError && !key.trim() ? "border-red-400" : ""}`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        Working Directory <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={cwd}
                        onChange={(e) => setCwd(e.target.value)}
                        placeholder="/path/to/project"
                        className={`${inputCls} ${fieldError && !cwd.trim() ? "border-red-400" : ""}`}
                      />
                      {fieldError && (
                        <p className="mt-0.5 text-[10px] text-red-500">{fieldError}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        Routine 执行的工作目录，指向你要操作的项目根路径
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={creating || !key.trim() || !cwd.trim()}
                      onClick={handleCreate}
                      className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {creating ? "Creating…" : "Create Routine"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-card px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-muted disabled:opacity-50"
        >
          Close
        </button>
      </div>
    </OverlayDismissLayer>
  );
}
