"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";

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
    <div className={className ?? "relative inline-flex items-center"}>
      <select
        value={value}
        disabled={disabled}
        aria-label={ariaLabel ?? "LLM Model"}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 appearance-none rounded-md border border-border/50 bg-transparent pl-2 pr-6 text-xs text-foreground outline-none transition-colors hover:border-border hover:bg-muted disabled:opacity-40 cursor-pointer"
      >
        {allowClear && <option value="">{placeholder}</option>}
        {showUnknown && (
          <option value={value} className="text-text-muted">
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
      <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-text-muted" aria-hidden />
    </div>
  );
}
