"use client";

import { useMemo } from "react";

import type { ModelConfigItem } from "@/features/knowledge/utils/knowledge-api";

type LlmModelSelectProps = {
  models: ModelConfigItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

function buildFullModelName(vendor: string, modelName: string): string {
  return `${vendor}/${modelName}`;
}

export function LlmModelSelect({
  models,
  value,
  onChange,
  placeholder = "Default",
  allowClear = true,
  disabled,
  className,
  ariaLabel,
}: LlmModelSelectProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, ModelConfigItem[]>();
    for (const item of models) {
      if (!map.has(item.vendor)) {
        map.set(item.vendor, []);
      }
      map.get(item.vendor)!.push(item);
    }
    return Array.from(map.entries());
  }, [models]);

  const knownValues = useMemo(
    () =>
      new Set(
        models.map((item) => buildFullModelName(item.vendor, item.model_name)),
      ),
    [models],
  );

  const showUnknown = Boolean(value) && !knownValues.has(value);

  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={ariaLabel ?? "LLM Model"}
      onChange={(event) => onChange(event.target.value)}
      className={
        className ??
        "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-zinc-400 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
      }
    >
      {allowClear && <option value="">{placeholder}</option>}
      {showUnknown && (
        <option value={value} className="text-muted">
          {value}（未知）
        </option>
      )}
      {grouped.map(([vendor, items]) => (
        <optgroup key={vendor} label={vendor}>
          {items.map((item) => {
            const full = buildFullModelName(item.vendor, item.model_name);
            const label = item.display_name?.trim() ? item.display_name : full;
            return (
              <option key={item.id} value={full}>
                {label}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}
