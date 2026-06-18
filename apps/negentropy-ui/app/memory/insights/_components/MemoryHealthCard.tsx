"use client";

import { cn } from "@/lib/utils";
import type { MemoryHealth } from "@/features/memory";
import { FeatureFlagChip, boolTone } from "../../_shared/FeatureFlagChip";

/**
 * Memory 健康卡 —— Insights 侧栏。
 * 展示整体状态、DB 连通、核心表行数，以及完整 feature flag 矩阵（含 PII 引擎降级告警）。
 */

interface MemoryHealthCardProps {
  health: MemoryHealth | null;
  loading: boolean;
}

export function MemoryHealthCard({ health, loading }: MemoryHealthCardProps) {
  if (loading && !health) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-xs text-muted-foreground">Checking system health…</p>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-foreground">System Health</h3>
        <p className="mt-2 text-caption text-muted-foreground">
          健康端点不可用（可能已禁用 memory.observability.health_enabled）。
        </p>
      </div>
    );
  }

  const { status, checks } = health;
  const f = checks.features;

  const statusStyle =
    status === "healthy"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
      : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300";

  const piiDegraded =
    !!f.pii_engine_actual && f.pii_engine_actual !== f.pii_engine;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-foreground">System Health</h3>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-micro font-semibold capitalize",
            statusStyle,
          )}
        >
          {status}
        </span>
      </div>

      {/* DB + tables */}
      <dl className="mt-3 space-y-1.5 text-caption">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Database</dt>
          <dd
            className={cn(
              "font-medium",
              checks.db.status === "ok"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {checks.db.status}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Memories</dt>
          <dd className="tabular-nums text-foreground">
            {checks.tables.memories ?? "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Facts</dt>
          <dd className="tabular-nums text-foreground">
            {checks.tables.facts ?? "—"}
          </dd>
        </div>
      </dl>

      {/* Feature matrix */}
      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-2 text-micro uppercase tracking-overline text-muted-foreground">
          Feature Flags
        </p>
        <div className="flex flex-wrap gap-1.5">
          <FeatureFlagChip label="HippoRAG (F1)" tone={boolTone(f.hipporag)} />
          <FeatureFlagChip label="Reflexion (F2)" tone={boolTone(f.reflection)} />
          <FeatureFlagChip
            label="Rocchio (F5)"
            tone={boolTone(f.relevance_enabled)}
          />
          <FeatureFlagChip
            label={`6-step ${f.consolidation_legacy ? "(legacy)" : ""}`}
            tone={f.consolidation_legacy ? "warn" : "active"}
            title={`policy: ${f.consolidation_policy}`}
          />
          <FeatureFlagChip
            label={`PII: ${f.pii_engine}`}
            tone={piiDegraded ? "warn" : "active"}
            title={
              piiDegraded
                ? `configured ${f.pii_engine}, running ${f.pii_engine_actual}（降级）`
                : `actual: ${f.pii_engine_actual ?? f.pii_engine}`
            }
          />
          <FeatureFlagChip
            label="Gatekeeper"
            tone={boolTone(f.gatekeeper_enabled)}
          />
        </div>
        {piiDegraded && (
          <p className="mt-2 text-micro text-amber-600 dark:text-amber-400">
            ⚠ PII 引擎配置为 {f.pii_engine}，实际运行 {f.pii_engine_actual}（依赖缺失触发降级）。
          </p>
        )}
      </div>
    </div>
  );
}
