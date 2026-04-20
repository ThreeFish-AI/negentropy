"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  MODEL_KINDS,
  type ModelConfigRecord,
  type ModelKind,
} from "@/types/interface-models";
import { cn } from "@/lib/utils";

interface VendorModelsDisclosureProps {
  vendor: string;
  vendorLabel?: string;
  models: ModelConfigRecord[];
}

export function VendorModelsDisclosure({
  vendor,
  vendorLabel,
  models,
}: VendorModelsDisclosureProps) {
  const [expanded, setExpanded] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<ModelKind, ModelConfigRecord[]>();
    for (const mk of MODEL_KINDS) {
      map.set(mk.value, []);
    }
    for (const record of models) {
      if (record.vendor !== vendor) continue;
      if (!record.enabled) continue;
      map.get(record.model_type)?.push(record);
    }
    return map;
  }, [models, vendor]);

  const total = useMemo(() => {
    let sum = 0;
    for (const list of grouped.values()) sum += list.length;
    return sum;
  }, [grouped]);

  if (total === 0) return null;

  const contentId = `vendor-models-${vendor}`;
  const ariaLabel = vendorLabel
    ? `${vendorLabel} 已启用模型`
    : "已启用模型";

  return (
    <div className="mt-3 border-t border-zinc-200/70 pt-2 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls={contentId}
        aria-label={ariaLabel}
        className={cn(
          "group flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1",
          "text-[11px] font-medium text-zinc-600 transition-colors",
          "hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 text-zinc-400 transition-transform duration-150",
              expanded && "rotate-180",
            )}
          />
          <span>{expanded ? "收起" : "查看已启用模型"}</span>
        </span>
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {total}
        </span>
      </button>

      {expanded ? (
        <div id={contentId} className="mt-2 space-y-3">
          {MODEL_KINDS.map((mk) => {
            const items = grouped.get(mk.value) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={mk.value} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {mk.label}
                  </div>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {items.length}
                  </div>
                </div>
                <ul className="space-y-1">
                  {items.map((mc) => (
                    <li
                      key={mc.id}
                      className="flex items-center gap-2 rounded border border-zinc-100 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <span className="flex-1 min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-200">
                        {mc.display_name}
                        <span className="ml-1 font-normal text-zinc-400">
                          {mc.model_name}
                        </span>
                      </span>
                      {mk.value === "embedding" && mc.config?.dimensions != null ? (
                        <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {String(mc.config.dimensions)} dims
                        </span>
                      ) : null}
                      {mc.is_default ? (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          Default
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
