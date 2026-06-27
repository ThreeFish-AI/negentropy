"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ListTree } from "lucide-react";

import type { RoutineIterationDTO } from "@/features/routine";
import { AGENT_ROLE_META, deriveIterationDriver } from "@/features/routine";
import { cn } from "@/lib/utils";

import { LiveElapsed, StaticDuration } from "./ElapsedClock";
import { MarkdownText } from "./MarkdownText";
import { ACTIVE_TIMING } from "./routine-loop";
import { iterationDotClass, phaseClass, phaseLabel, scoreColorClass, verdictClass } from "./status-style";

const PAGE_SIZE = 10;

interface RoutineIterationTimelineProps {
  iterations: RoutineIterationDTO[];
  onApprove: (iterationId: string) => void;
  onReject?: (iterationId: string) => void;
  /** 打开某迭代的「全过程」审计抽屉。 */
  onAudit?: (iteration: RoutineIterationDTO) => void;
  busy?: boolean;
}

export function RoutineIterationTimeline({
  iterations,
  onApprove,
  onAudit,
  busy,
}: RoutineIterationTimelineProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(iterations.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pageItems = iterations.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  if (iterations.length === 0) {
    return <p className="text-sm text-text-secondary">No iterations yet.</p>;
  }

  return (
    <>
      <ol className="space-y-1.5">
        {pageItems.map((it) => (
          <IterationCard key={it.id} it={it} onApprove={onApprove} onAudit={onAudit} busy={busy} />
        ))}
      </ol>
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 border-t border-border pt-3 text-xs text-text-secondary">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="上一页"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-medium tabular-nums">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="下一页"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

/** Iteration 状态 → 简短中文标签（收起态无 summary 时降级占位用）。 */
const ITERATION_STATUS_LABEL: Record<string, string> = {
  pending_approval: "待审批",
  dispatched: "已派发",
  in_flight: "执行中",
  executed: "已执行",
  evaluated: "已评估",
  reaped: "已收割",
  aborted: "已中止",
};

/** 收起态单行摘要：取 summary 首行、剥离常见 Markdown 记号、超长截断；
 * summary 为空时降级为「相位 · 状态」占位。纯机械处理，无 LLM。 */
function summaryHeadline(it: RoutineIterationDTO): { text: string; full: string | null } {
  const raw = it.summary?.trim();
  if (!raw) {
    const ph = it.phase ? phaseLabel(it.phase) : "";
    const st = ITERATION_STATUS_LABEL[it.status] ?? it.status;
    return { text: [ph, st].filter(Boolean).join(" · "), full: null };
  }
  // 取首条「有意义」行：跳过空行与纯分隔线（--- / *** / ___）
  const firstLine =
    raw.split("\n").map((l) => l.trim()).find((l) => l.length > 0 && !/^(?:[-*_]\s*){3,}$/.test(l)) ?? "";
  const stripped = firstLine
    .replace(/^#+\s*/, "") // ATX 标题
    .replace(/^[-*+]\s+/, "") // 列表项
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 链接 → 文本
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **加粗**
    .replace(/__([^_]+)__/g, "$1") // __加粗__
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1") // _斜体_（词边界，保留 PR_URL / file_name 等中间下划线）
    .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, "$1") // *斜体*
    .replace(/~~([^~]+)~~/g, "$1") // ~~删除线~~
    .replace(/`([^`]+)`/g, "$1") // `行内代码`
    .trim();
  const text = stripped.length > 100 ? `${stripped.slice(0, 100)}…` : stripped;
  return { text: text || raw.slice(0, 100), full: raw };
}

function IterationCard({
  it,
  onApprove,
  onAudit,
  busy,
}: {
  it: RoutineIterationDTO;
  onApprove: (id: string) => void;
  onAudit?: (iteration: RoutineIterationDTO) => void;
  busy?: boolean;
}) {
  const isActive = !it.finished_at && ACTIVE_TIMING.has(it.status);
  const isPendingApproval = it.status === "pending_approval";
  // 活跃迭代（待审批 / 执行中 / 已派发）默认展开以暴露实时计时与审批入口；已完成默认收起。
  const [expanded, setExpanded] = useState(isActive);
  const bodyId = `iter-${it.id}-body`;
  const headline = summaryHeadline(it);

  return (
    <li
      className={cn(
        "overflow-hidden rounded-lg border transition-colors",
        isActive
          ? "border-sky-500/60 bg-sky-500/[0.05] ring-1 ring-sky-500/20"
          : expanded
            ? "border-border"
            : "border-transparent hover:border-border/60",
      )}
    >
      {/* 头部单行：展开切换（chevron + 标识 + 摘要首行）+ 右侧操作区（避免 button 套 button） */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={expanded ? `收起迭代 #${it.seq} 详情` : `展开迭代 #${it.seq} 详情`}
          className="group/head flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-text-muted transition-transform duration-150 group-hover/head:text-foreground",
              expanded && "rotate-90",
            )}
            aria-hidden
          />
          <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", iterationDotClass(it.status))} />
          <span className="shrink-0 text-xs font-semibold text-foreground">#{it.seq}</span>
          {it.phase && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                phaseClass(it.phase),
              )}
            >
              {phaseLabel(it.phase)}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-text-secondary" title={headline.full ?? undefined}>
            {headline.text}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {it.verdict && (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", verdictClass(it.verdict))}>
              {it.verdict}
            </span>
          )}
          {it.score != null && (
            <span className={cn("text-sm font-bold tabular-nums", scoreColorClass(it.score))}>{it.score}</span>
          )}
          {/* 收起态核心元信息：turns · cost · elapsed（小屏隐藏，保留 verdict / score / View Full） */}
          <span className="hidden items-center gap-1.5 text-xs text-text-secondary sm:flex">
            <span className="tabular-nums">{it.turn_count}t</span>
            <span className="text-text-muted">·</span>
            <span className="tabular-nums">${it.cost_usd.toFixed(4)}</span>
            <span className="text-text-muted">·</span>
            {isActive ? (
              <LiveElapsed startedAt={it.started_at} />
            ) : (
              <StaticDuration startedAt={it.started_at} finishedAt={it.finished_at} />
            )}
          </span>
          {onAudit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAudit(it);
              }}
              aria-label={`Iteration #${it.seq} Full View`}
              title="Full View (all actions I/O & context)"
              className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ListTree className="h-3 w-3" aria-hidden />
              View Full
            </button>
          )}
        </div>
      </div>

      {/* 展开态明细框（头部 100% 复用，仅 chevron 翻转） */}
      {expanded && (
        <div
          id={bodyId}
          role="region"
          aria-label={`Iteration #${it.seq} 详情`}
          className="space-y-2 border-t border-border/60 px-4 py-3"
        >
          {/* PLAN 阶段：摘要即「执行计划」，加标签以便人工审批前定位 */}
          {it.phase === "plan" && it.summary && (
            <div className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              📋 执行计划 (Plan)
            </div>
          )}

          {/* 执行摘要（Markdown 全文渲染） */}
          {it.summary && (
            <div className={it.phase === "plan" ? "mt-1" : ""}>
              <MarkdownText content={it.summary} />
            </div>
          )}

          {/* 执行失败信息 */}
          {it.exec_error && (
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-red-500/5 p-2 text-caption text-red-600 dark:text-red-400">
              {it.exec_error}
            </pre>
          )}

          {/* 评估反思（Markdown 渲染） */}
          {it.reflection && (
            <div className="rounded bg-muted/40 p-2">
              <span className="mr-1">💡</span>
              <MarkdownText content={it.reflection} className="[&_p]:inline" />
            </div>
          )}

          {/* 完整指标行 */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary">
            {/* 当前阶段主导人指示 */}
            {(() => {
              const driver = deriveIterationDriver(it.status);
              if (!driver) return null;
              const meta = AGENT_ROLE_META[driver];
              const Icon = meta.icon;
              return (
                <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium ${meta.badgeClass}`}>
                  <Icon className="h-2.5 w-2.5" aria-hidden />
                  {meta.label}
                </span>
              );
            })()}
            {it.exec_status && <span>exec: {it.exec_status}</span>}
            <span>turns: {it.turn_count}</span>
            <span>cost: ${it.cost_usd.toFixed(4)}</span>
            {it.gate_exit_code != null && <span>gate exit: {it.gate_exit_code}</span>}
            {isActive ? (
              <LiveElapsed startedAt={it.started_at} prefix="⏱ " />
            ) : (
              <StaticDuration startedAt={it.started_at} finishedAt={it.finished_at} prefix="⏱ " />
            )}
            {it.started_at && (
              <span title={new Date(it.started_at).toLocaleString()}>
                {new Date(it.started_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* 审批门控：NegentropyEngine 自动审阅中 */}
          {isPendingApproval && (
            <div className="flex items-center gap-2 rounded-md bg-sky-500/5 p-2">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
              <span className="text-xs text-sky-700 dark:text-sky-300">
                {it.phase === "plan"
                  ? "NegentropyEngine 正在审阅此 Plan…"
                  : it.phase === "implement"
                    ? "NegentropyEngine 正在审阅实现方案…"
                    : "等待 NegentropyEngine 审阅…"}
              </span>
              <div className="flex-1" />
              {/* 手动审批按钮（fallback：当 Engine 未自动审阅时，人工仍可介入） */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(it.id);
                }}
                disabled={busy}
                className="cursor-pointer rounded-md border border-border px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-muted/50 disabled:opacity-50"
              >
                Manual Approve
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
