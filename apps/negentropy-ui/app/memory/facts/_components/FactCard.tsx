"use client";

import {
  Clock,
  History,
  Lightbulb,
  Scale,
  Share2,
  SlidersHorizontal,
  Tag,
  User,
  type LucideIcon,
} from "lucide-react";

import type { FactItem } from "@/features/memory";

import {
  formatConfidenceColor,
  formatImportanceColor,
  formatPercent,
  formatShortDate,
  formatValidityLabel,
  isExpired,
} from "../_lib/fact-helpers";
import { FactValueView } from "./FactValueView";

// ============================================================================
// Sub-components
// ============================================================================

interface FactTypeMeta {
  icon: LucideIcon;
  className: string;
}

// 类型徽标：图标 + 文字（色不单独表意）。补齐后端实际写入的 relation/rule，
// 未知类型回退到中性 Tag 样式。
const FACT_TYPE_META: Record<string, FactTypeMeta> = {
  preference: {
    icon: SlidersHorizontal,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  profile: {
    icon: User,
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  knowledge: {
    icon: Lightbulb,
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  relation: {
    icon: Share2,
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  rule: {
    icon: Scale,
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
};

const DEFAULT_TYPE_META: FactTypeMeta = {
  icon: Tag,
  className: "bg-muted text-text-secondary",
};

function FactTypeBadge({ type }: { type: string }) {
  const meta = FACT_TYPE_META[type] ?? DEFAULT_TYPE_META;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-micro font-medium ${meta.className}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {type}
    </span>
  );
}

/** 置信度：紧凑迷你进度条 + 百分比（progressbar 语义保留给 e2e/可达性）。 */
function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percent = formatPercent(confidence);
  const colorClass = formatConfidenceColor(confidence);
  return (
    <span className="flex items-center gap-1.5" title={`置信度 ${percent}%`}>
      <span
        className="relative h-1 w-7 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`置信度 ${percent}%`}
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="text-micro font-mono tabular-nums text-text-muted">
        {percent}%
      </span>
    </span>
  );
}

/** 重要度：低强度圆点 + 百分比（配色对齐右侧 Legend）。 */
function ImportanceDot({ score }: { score: number }) {
  const percent = formatPercent(score);
  const colorClass = formatImportanceColor(score);
  return (
    <span className="flex items-center gap-1" title={`重要度 ${percent}%`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colorClass}`} aria-hidden />
      <span className="text-micro font-mono tabular-nums text-text-muted">
        {percent}%
      </span>
      <span className="sr-only">重要度 {percent}%</span>
    </span>
  );
}

function TemporalBadge({ fact }: { fact: FactItem }) {
  const label = formatValidityLabel(fact);
  if (!label) return null;

  const expired = isExpired(fact);
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        expired ? "text-rose-500 dark:text-rose-400" : "text-text-muted"
      }`}
    >
      <Clock className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

// ============================================================================
// FactCard
// ============================================================================

interface FactCardProps {
  fact: FactItem;
  userLabel?: string;
  onShowHistory: (factId: string) => void;
}

export function FactCard({ fact, userLabel, onShowHistory }: FactCardProps) {
  const accentClass = formatConfidenceColor(fact.confidence);

  return (
    <article className="group relative flex flex-col gap-2.5 overflow-hidden rounded-card border border-border bg-card p-4 text-card-foreground shadow-sm transition-[box-shadow,border-color] duration-150 ease-out hover:border-foreground/15 hover:shadow-md">
      {/* 顶部强调线 = 置信度等级色（装饰性，可达性由下方进度条承载） */}
      <span className={`absolute inset-x-0 top-0 h-0.5 ${accentClass}`} aria-hidden />

      {/* 行1：类型 · 置信度 · 重要度 */}
      <div className="flex items-center justify-between gap-2">
        <FactTypeBadge type={fact.fact_type} />
        <div className="flex shrink-0 items-center gap-2.5">
          <ConfidenceMeter confidence={fact.confidence} />
          {typeof fact.importance_score === "number" && (
            <ImportanceDot score={fact.importance_score} />
          )}
        </div>
      </div>

      {/* 行2：key 眼纹（弱化属性标签，title 显示全文） */}
      <p
        className="truncate font-mono text-micro uppercase tracking-wider text-text-muted"
        title={fact.key}
      >
        {fact.key}
      </p>

      {/* 行3：语义化 value（hero） */}
      <FactValueView value={fact.value} />

      {/* 行4：元信息 + History */}
      <div className="mt-0.5 flex items-center justify-between gap-2 text-caption text-text-muted">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <TemporalBadge fact={fact} />
          {fact.created_at && <span>{formatShortDate(fact.created_at)}</span>}
          {userLabel && (
            <span className="max-w-[10rem] truncate rounded-full border border-border px-1.5 py-px text-micro">
              {userLabel}
            </span>
          )}
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-text-muted transition-colors hover:bg-muted hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onShowHistory(fact.id)}
        >
          <History className="h-3 w-3 shrink-0" aria-hidden />
          History
        </button>
      </div>
    </article>
  );
}
