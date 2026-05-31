"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemoryAssociation } from "../utils/memory-api";

/**
 * 单行关联 —— association_type 徽章 + weight 进度条 + source→target 类型与 ID 截断。
 * weight 条复用 timeline 卡片的 retention bar 习惯（h-1.5 圆角 + 百分比）。
 */

const TYPE_STYLES: Record<string, string> = {
  semantic: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  temporal: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  thread_shared:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  entity: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function weightColor(weight: number): string {
  if (weight >= 0.7) return "bg-emerald-500";
  if (weight >= 0.4) return "bg-blue-500";
  return "bg-slate-400";
}

interface AssociationRowProps {
  assoc: MemoryAssociation;
}

export function AssociationRow({ assoc }: AssociationRowProps) {
  const typeStyle =
    TYPE_STYLES[assoc.association_type] ?? "bg-muted text-text-secondary";

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-micro font-medium",
            typeStyle,
          )}
        >
          {assoc.association_type}
        </span>
        <span className="tabular-nums text-micro text-text-secondary">
          {(assoc.weight * 100).toFixed(0)}%
        </span>
      </div>

      {/* weight bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", weightColor(assoc.weight))}
          style={{ width: `${Math.max(assoc.weight * 100, 2)}%` }}
        />
      </div>

      {/* source → target */}
      <div className="mt-2 flex items-center gap-1.5 text-micro text-muted-foreground">
        <span className="font-mono">
          {assoc.source_type}:{assoc.source_id.slice(0, 8)}…
        </span>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <span className="font-mono">
          {assoc.target_type}:{assoc.target_id.slice(0, 8)}…
        </span>
      </div>
    </div>
  );
}
