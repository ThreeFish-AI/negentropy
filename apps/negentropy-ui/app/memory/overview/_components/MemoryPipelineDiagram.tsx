"use client";

import { ChevronRight } from "lucide-react";
import type {
  MemoryDashboard,
  MemoryHealth,
  MemorySystemMetrics,
} from "@/features/memory";
import { boolTone, type FeatureFlagTone } from "../../_shared/FeatureFlagChip";
import { StageColumn, type StageFlag, type StageStat } from "./StageColumn";

/**
 * Memory 生命周期 Pipeline 可视化 —— Overview 页脊柱。
 *
 * 把 Memory 系统的认知模型（docs/concepts/025-the-memory-system.md §2.3）
 * 「Formation → Evolution → Retrieval」三阶段渲染为可点击的阶段列，并叠加实时标注：
 * - 计数来自 /metrics（admin）或 /dashboard（fallback）
 * - feature flag 三态来自 /health.checks.features
 *
 * 选用纯 React/SVG 而非 Mermaid：MermaidDiagram 在模块加载时固定 theme:"default" 且不随
 * 主题切换重渲染，深色模式失真；React 组件天然 token 驱动、支持 live annotation 与 <Link>。
 */

interface MemoryPipelineDiagramProps {
  dashboard: MemoryDashboard | null;
  health: MemoryHealth | null;
  metrics: MemorySystemMetrics | null;
}

function pct(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function num(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

export function MemoryPipelineDiagram({
  dashboard,
  health,
  metrics,
}: MemoryPipelineDiagramProps) {
  const features = health?.checks.features;
  // health 不可用时，flag 状态未知（unknown 三态）
  const tone = (v: boolean | undefined): FeatureFlagTone =>
    features ? boolTone(v) : "unknown";

  // PII 引擎降级探测：配置值 ≠ 实际探测值 → warn
  const piiTone: FeatureFlagTone = !features
    ? "unknown"
    : features.pii_engine_actual && features.pii_engine_actual !== features.pii_engine
      ? "warn"
      : "active";
  const piiTitle = features
    ? `configured: ${features.pii_engine}` +
      (features.pii_engine_actual
        ? ` · actual: ${features.pii_engine_actual}`
        : "")
    : "health endpoint unavailable";

  // ---- Formation ----
  const formationStats: StageStat[] = [
    {
      label: "memories",
      value: num(metrics?.memory_total ?? dashboard?.memory_count),
    },
    { label: "facts", value: num(metrics?.fact_count ?? dashboard?.fact_count) },
    ...(metrics
      ? [{ label: "consolidated/24h", value: num(metrics.consolidation_total_24h) }]
      : []),
  ];
  const formationFlags: StageFlag[] = [
    {
      label: "6-step consolidation",
      tone: features ? (features.consolidation_legacy ? "warn" : "active") : "unknown",
      title: features
        ? `policy: ${features.consolidation_policy}` +
          (features.consolidation_legacy ? " · legacy 2-step active" : "")
        : undefined,
    },
    {
      label: "Reflexion",
      tone: tone(features?.reflection),
      title: "F2 episodic reflection",
    },
  ];

  // ---- Evolution ----
  const evolutionStats: StageStat[] = [
    {
      label: "avg retention",
      value: pct(metrics?.retention_score_avg ?? dashboard?.avg_retention_score),
    },
    {
      label: "low-retention",
      value: num(metrics?.low_retention_count ?? dashboard?.low_retention_count),
    },
    ...(metrics
      ? [{ label: "retain rate", value: pct(metrics.consolidation_retain_rate) }]
      : []),
  ];
  const evolutionFlags: StageFlag[] = [
    { label: `PII: ${features?.pii_engine ?? "?"}`, tone: piiTone, title: piiTitle },
    {
      label: "Gatekeeper",
      tone: tone(features?.gatekeeper_enabled),
      title: "F4 PII 低权限脱敏门控",
    },
  ];

  // ---- Retrieval ----
  const retrievalStats: StageStat[] = [
    ...(metrics
      ? [
          { label: "ref rate/24h", value: pct(metrics.search_reference_rate) },
          { label: "helpful", value: pct(metrics.search_helpful_rate) },
          { label: "associations", value: num(metrics.association_count) },
        ]
      : []),
  ];
  const retrievalFlags: StageFlag[] = [
    {
      label: "HippoRAG PPR",
      tone: tone(features?.hipporag),
      title: "F1 entity-seeded Personalized PageRank",
    },
    {
      label: "Rocchio rerank",
      tone: tone(features?.relevance_enabled),
      title: "F5 feedback-driven 重排",
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold tracking-heading text-foreground">
          Memory Lifecycle Pipeline
        </h2>
        <span className="text-micro text-muted-foreground">
          {metrics
            ? "live · /dashboard + /metrics + /health"
            : "live · /dashboard + /health"}
        </span>
      </div>

      {/* 桌面横向三列 + 箭头连接；窄屏堆叠（连接符旋转向下） */}
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        <StageColumn
          index={1}
          accent="formation"
          title="Formation"
          subtitle="写入路径：会话经巩固管线沉淀为记忆与事实"
          steps={[
            "Consolidation 6-step",
            "extract → normalize → cluster",
            "dedup → summarize → auto-link",
          ]}
          stats={formationStats}
          flags={formationFlags}
          href="/memory/timeline"
          hrefLabel="Timeline & Facts"
        />

        <Connector />

        <StageColumn
          index={2}
          accent="evolution"
          title="Evolution"
          subtitle="治理路径：遗忘曲线衰减、重要性评分、冲突消解"
          steps={[
            "Ebbinghaus decay (5-factor)",
            "Importance (ACT-R)",
            "Conflict resolution (AGM)",
          ]}
          stats={evolutionStats}
          flags={evolutionFlags}
          href="/memory/conflicts"
          hrefLabel="Conflicts & Audit"
        />

        <Connector />

        <StageColumn
          index={3}
          accent="retrieval"
          title="Retrieval"
          subtitle="读取路径：意图路由、混合检索、关联扩展、重排"
          steps={[
            "Intent routing",
            "4-level hybrid search",
            "Assoc. expansion → Rocchio",
          ]}
          stats={retrievalStats}
          flags={retrievalFlags}
          href="/memory/insights"
          hrefLabel="Insights"
        />
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div
      className="flex shrink-0 items-center justify-center text-muted-foreground"
      aria-hidden
    >
      <ChevronRight className="h-5 w-5 rotate-90 lg:rotate-0" />
    </div>
  );
}
