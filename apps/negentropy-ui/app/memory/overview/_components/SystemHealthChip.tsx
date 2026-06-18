"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemoryHealth } from "@/features/memory";

/**
 * Memory 系统健康胶囊 —— Overview 头部右上角。
 * health 为 null（端点禁用 / 网络失败）时显示 "Unknown"，绝不作为错误阻断页面。
 * 点击跳转 Insights 查看详情。
 */

interface SystemHealthChipProps {
  health: MemoryHealth | null;
  loading: boolean;
}

export function SystemHealthChip({ health, loading }: SystemHealthChipProps) {
  const status = health?.status;

  const { label, chip, dot } =
    status === "healthy"
      ? {
          label: "Healthy",
          chip: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
          dot: "bg-emerald-500",
        }
      : status === "degraded"
        ? {
            label: "Degraded",
            chip: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
            dot: "bg-amber-500",
          }
        : {
            label: loading ? "Checking…" : "Unknown",
            chip: "border-dashed border-border bg-transparent text-muted-foreground",
            dot: "bg-slate-300 dark:bg-slate-600",
          };

  return (
    <Link
      href="/memory/insights"
      title="View system health & metrics"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
        chip,
      )}
    >
      <Activity className="h-3.5 w-3.5" />
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {label}
      </span>
    </Link>
  );
}
