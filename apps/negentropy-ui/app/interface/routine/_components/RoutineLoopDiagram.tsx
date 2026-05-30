"use client";

import { Repeat } from "lucide-react";

import type { RoutineDTO, RoutineIterationDTO } from "@/features/routine";

import { LiveElapsed } from "./ElapsedClock";
import { RoutineLoopBar } from "./RoutineLoopBar";
import { LOOP_STAGE_META, type LoopSnapshot } from "./routine-loop";
import { verdictClass } from "./status-style";

const ACTIVE_TIMING: ReadonlySet<string> = new Set(["dispatched", "in_flight", "executed"]);

/**
 * Evaluator-Optimizer 闭环图 —— 4 阶段步进器 + 实时状态行 + Reflexion 反馈说明。
 * 把「Decide → reflection → Dispatch」的反思反馈边显式呈现（区别于普通流水线）。
 */
export function RoutineLoopDiagram({
  snapshot,
  latest,
  routine,
}: {
  snapshot: LoopSnapshot;
  latest: RoutineIterationDTO | undefined;
  routine: RoutineDTO;
}) {
  const timing = !!latest && ACTIVE_TIMING.has(latest.status) && !latest.finished_at;

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground">
          闭环过程 · Evaluator–Optimizer Loop
        </h3>
        {snapshot.mode === "looping" && snapshot.activeStage && (
          <span className="text-[11px] font-medium text-foreground">
            {LOOP_STAGE_META[snapshot.activeStage].label}
            {snapshot.pulsing && <span className="ml-1 text-text-muted">进行中…</span>}
          </span>
        )}
      </div>

      <RoutineLoopBar snapshot={snapshot} size="md" showLabels />

      {/* 实时 / 终态状态行 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary">
        {timing && latest ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
              迭代 #{latest.seq}
            </span>
            <LiveElapsed startedAt={latest.started_at} prefix="⏱ " className="text-foreground" />
            <span className="text-text-muted">{latest.turn_count} turns</span>
            <span className="text-text-muted">${latest.cost_usd.toFixed(4)}</span>
          </>
        ) : snapshot.mode === "done" ? (
          <span className="text-text-muted">
            已结束{snapshot.terminationReason ? ` · 终止原因：${snapshot.terminationReason}` : ""}
          </span>
        ) : snapshot.mode === "paused" ? (
          <span className="text-amber-600 dark:text-amber-400">已暂停 · 恢复后继续迭代</span>
        ) : snapshot.mode === "waiting-approval" ? (
          <span className="text-amber-600 dark:text-amber-400">等待人工审批后派发下一轮迭代</span>
        ) : snapshot.mode === "idle" ? (
          <span className="text-text-muted">尚未启动</span>
        ) : null}
        {latest?.verdict && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${verdictClass(latest.verdict)}`}>
            {latest.verdict}
          </span>
        )}
      </div>

      {/* Reflexion 反馈边 */}
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-2.5">
        <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 text-[11px] text-text-secondary">
          <span className="font-medium text-foreground">Reflexion 反馈</span>
          ：Decide 后将上轮反思注入下轮 Dispatch 提示，驱动自迭代。
          {latest?.reflection && (
            <span className="mt-1 block italic text-text-muted">💡 最近反思：{latest.reflection}</span>
          )}
          {!latest?.reflection && routine.reflections.length > 0 && (
            <span className="mt-1 block italic text-text-muted">💡 {routine.reflections[routine.reflections.length - 1]}</span>
          )}
        </div>
      </div>
    </section>
  );
}
