"use client";

import { useState } from "react";
import { ListTree } from "lucide-react";

import type { RoutineIterationDTO } from "@/features/routine";

import { LiveElapsed, StaticDuration } from "./ElapsedClock";
import { ACTIVE_TIMING } from "./routine-loop";
import { iterationDotClass, phaseClass, phaseLabel, scoreColorClass, verdictClass } from "./status-style";

interface RoutineIterationTimelineProps {
  iterations: RoutineIterationDTO[];
  onApprove: (iterationId: string) => void;
  onReject: (iterationId: string) => void;
  /** 打开某迭代的「全过程」审计抽屉。 */
  onAudit?: (iteration: RoutineIterationDTO) => void;
  busy?: boolean;
}

export function RoutineIterationTimeline({
  iterations,
  onApprove,
  onReject,
  onAudit,
  busy,
}: RoutineIterationTimelineProps) {
  if (iterations.length === 0) {
    return <p className="text-[11px] text-text-muted">No iterations yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {iterations.map((it) => (
        <IterationCard key={it.id} it={it} onApprove={onApprove} onReject={onReject} onAudit={onAudit} busy={busy} />
      ))}
    </ol>
  );
}

function IterationCard({
  it,
  onApprove,
  onReject,
  onAudit,
  busy,
}: {
  it: RoutineIterationDTO;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onAudit?: (iteration: RoutineIterationDTO) => void;
  busy?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPendingApproval = it.status === "pending_approval";
  const isActive = !it.finished_at && ACTIVE_TIMING.has(it.status);

  return (
    <li
      className={`rounded-lg border p-3 ${
        isActive ? "border-sky-400/50 bg-sky-500/[0.03]" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${iterationDotClass(it.status)}`} />
          <span className="text-xs font-semibold text-foreground">#{it.seq}</span>
          {it.phase && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${phaseClass(it.phase)}`}
            >
              {phaseLabel(it.phase)}
            </span>
          )}
          <span className="text-[10px] text-text-muted">{it.status}</span>
        </div>
        <div className="flex items-center gap-2">
          {it.verdict && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${verdictClass(it.verdict)}`}>
              {it.verdict}
            </span>
          )}
          {it.score != null && (
            <span className={`text-sm font-bold tabular-nums ${scoreColorClass(it.score)}`}>{it.score}</span>
          )}
          {onAudit && (
            <button
              type="button"
              onClick={() => onAudit(it)}
              aria-label={`查看迭代 #${it.seq} 全过程`}
              title="查看全过程（所有动作的输入/输出/上下文）"
              className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ListTree className="h-3 w-3" aria-hidden />
              全过程
            </button>
          )}
        </div>
      </div>

      {/* PLAN 阶段：摘要即「执行计划」，加标签以便人工审批前定位 */}
      {it.phase === "plan" && it.summary && (
        <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          📋 执行计划 (Plan)
        </div>
      )}

      {/* 执行摘要 */}
      {it.summary && (
        <p
          className={`${it.phase === "plan" ? "mt-1" : "mt-2"} whitespace-pre-wrap break-words text-[11px] text-text-secondary`}
        >
          {expanded || it.summary.length <= 280 ? it.summary : `${it.summary.slice(0, 280)}…`}
          {it.summary.length > 280 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="ml-1 cursor-pointer text-sky-600 hover:underline dark:text-sky-400"
            >
              {expanded ? "收起" : "展开"}
            </button>
          )}
        </p>
      )}

      {/* 执行失败信息 */}
      {it.exec_error && (
        <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-red-500/5 p-2 text-[10px] text-red-600 dark:text-red-400">
          {it.exec_error}
        </pre>
      )}

      {/* 评估反思 */}
      {it.reflection && (
        <p className="mt-2 rounded bg-muted/40 p-2 text-[11px] italic text-text-secondary">
          💡 {it.reflection}
        </p>
      )}

      {/* 指标行 */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-muted">
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

      {/* 审批门控操作 */}
      {isPendingApproval && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-500/5 p-2">
          <span className="text-[10px] text-amber-700 dark:text-amber-300">
            {it.phase === "implement"
              ? "审批后开始实现（请先确认上方 PLAN 方案）"
              : it.phase === "plan"
                ? "审批后开始执行规划"
                : "等待审批后执行"}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => onApprove(it.id)}
            disabled={busy}
            className="cursor-pointer rounded-md border border-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-400"
          >
            Approve
          </button>
          <button
            onClick={() => onReject(it.id)}
            disabled={busy}
            className="cursor-pointer rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
          >
            Reject
          </button>
        </div>
      )}
    </li>
  );
}
