"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ListTree } from "lucide-react";

import type { RoutineIterationDTO } from "@/features/routine";
import { AGENT_ROLE_META, deriveIterationDriver } from "@/features/routine";

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
      <ol className="space-y-2">
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
  const [expanded, setExpanded] = useState(false);
  const isPendingApproval = it.status === "pending_approval";
  const isActive = !it.finished_at && ACTIVE_TIMING.has(it.status);

  return (
    <li
      onClick={() => onAudit?.(it)}
      className={`rounded-lg border p-4 transition-colors ${
        onAudit ? "cursor-pointer hover:border-primary/40 hover:bg-muted/30" : ""
      } ${
        isActive ? "border-sky-500/60 bg-sky-500/[0.05] ring-1 ring-sky-500/20" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${iterationDotClass(it.status)}`} />
          <span className="text-xs font-semibold text-foreground">#{it.seq}</span>
          {it.phase && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${phaseClass(it.phase)}`}
            >
              {phaseLabel(it.phase)}
            </span>
          )}
          <span className="text-xs text-text-secondary">{it.status}</span>
        </div>
        <div className="flex items-center gap-2">
          {it.verdict && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${verdictClass(it.verdict)}`}>
              {it.verdict}
            </span>
          )}
          {it.score != null && (
            <span className={`text-sm font-bold tabular-nums ${scoreColorClass(it.score)}`}>{it.score}</span>
          )}
          {onAudit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAudit(it);
              }}
              aria-label={`Iteration #${it.seq} Full View`}
              title="Full View (all actions I/O & context)"
              className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-text-secondary transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ListTree className="h-3 w-3" aria-hidden />
              View Details
            </button>
          )}
        </div>
      </div>

      {/* PLAN 阶段：摘要即「执行计划」，加标签以便人工审批前定位 */}
      {it.phase === "plan" && it.summary && (
        <div className="mt-2 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          📋 执行计划 (Plan)
        </div>
      )}

      {/* 执行摘要（Markdown 渲染） */}
      {it.summary && (
        <div className={it.phase === "plan" ? "mt-1" : "mt-2"}>
          <MarkdownText
            content={expanded || it.summary.length <= 280 ? it.summary : `${it.summary.slice(0, 280)}…`}
          />
          {it.summary.length > 280 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              className="ml-1 cursor-pointer text-sky-600 hover:underline dark:text-sky-400"
            >
              {expanded ? "收起" : "展开"}
            </button>
          )}
        </div>
      )}

      {/* 执行失败信息 */}
      {it.exec_error && (
        <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-red-500/5 p-2 text-caption text-red-600 dark:text-red-400">
          {it.exec_error}
        </pre>
      )}

      {/* 评估反思（Markdown 渲染） */}
      {it.reflection && (
        <div className="mt-2 rounded bg-muted/40 p-2">
          <span className="mr-1">💡</span>
          <MarkdownText content={it.reflection} className="[&_p]:inline" />
        </div>
      )}

      {/* 指标行 */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary">
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
        <div className="mt-2 flex items-center gap-2 rounded-md bg-sky-500/5 p-2">
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
            onClick={(e) => { e.stopPropagation(); onApprove(it.id); }}
            disabled={busy}
            className="cursor-pointer rounded-md border border-border px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-muted/50 disabled:opacity-50"
          >
            Manual Approve
          </button>
        </div>
      )}
    </li>
  );
}
