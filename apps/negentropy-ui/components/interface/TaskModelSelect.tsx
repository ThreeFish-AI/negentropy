"use client";

/**
 * TaskModelSelect — task_model_settings 专用的 model 下拉。
 *
 * 与 components/ui/LlmModelSelect.tsx 的差异：
 *   - LlmModelSelect 的 value 是 ``vendor/model_name`` 字符串（Home/SubAgent 在 state 中存这个）
 *   - TaskModelSelect 的 value 是 model_configs.id（task_model_settings.model_config_id）
 *
 * 这里通过 useMemo 在内部做双向映射，对外暴露 id↔id 的契约，避免对公用 LlmModelSelect 做破坏性修改。
 */

import { useMemo } from "react";

import type { ModelConfigRecord } from "@/types/interface-models";

type TaskModelSelectProps = {
  /** 候选模型列表（按 model_type 已过滤）。 */
  models: ModelConfigRecord[];
  /** 当前绑定的 model_config_id；空串 = 未绑定，回退到全局默认。 */
  value: string;
  /** 选中后回调：传入新的 model_config_id；空串表示用户选择"使用全局默认"。 */
  onChange: (modelConfigId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

function buildLabel(item: ModelConfigRecord): string {
  const display = item.display_name?.trim();
  return display || `${item.vendor}/${item.model_name}`;
}

export function TaskModelSelect({
  models,
  value,
  onChange,
  placeholder = "使用全局默认",
  disabled,
  className,
  ariaLabel,
}: TaskModelSelectProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, ModelConfigRecord[]>();
    for (const item of models) {
      if (!map.has(item.vendor)) {
        map.set(item.vendor, []);
      }
      map.get(item.vendor)!.push(item);
    }
    return Array.from(map.entries());
  }, [models]);

  const knownIds = useMemo(() => new Set(models.map((m) => m.id)), [models]);
  const showUnknown = Boolean(value) && !knownIds.has(value);

  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={ariaLabel ?? "Task Model"}
      onChange={(event) => onChange(event.target.value)}
      className={
        className ??
        "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-zinc-400 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
      }
    >
      <option value="">{placeholder}</option>
      {showUnknown && (
        <option value={value} className="text-muted-foreground">
          {value}（未知或已禁用）
        </option>
      )}
      {grouped.map(([vendor, items]) => (
        <optgroup key={vendor} label={vendor}>
          {items.map((item) => (
            <option key={item.id} value={item.id} disabled={!item.enabled}>
              {buildLabel(item)}
              {item.is_default ? "（默认）" : ""}
              {!item.enabled ? "（已禁用）" : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
