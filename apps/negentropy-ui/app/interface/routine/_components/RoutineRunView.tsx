"use client";

import { useMemo } from "react";

import type { RoutineDTO } from "@/features/routine";

import { ReflectionFlow } from "./ReflectionFlow";
import { RoutineConvergenceChart } from "./RoutineConvergenceChart";
import { RoutineGuardPanel } from "./RoutineGuardPanel";
import { RoutineIterationTimeline } from "./RoutineIterationTimeline";
import { RoutineLoopDiagram } from "./RoutineLoopDiagram";
import { RoutineRunGantt } from "./RoutineRunGantt";
import { loopStageOf } from "./routine-loop";

/**
 * 单任务「全过程」视图主体 —— 闭环图 + 守卫面板 + 收敛趋势 + 甘特时间线 + 反思流 + 迭代明细。
 * 置于深链路由 ``/interface/routine/[id]``（外层由 ClockProvider 包裹以驱动实时计时）。
 */
export function RoutineRunView({
  routine,
  onApproveIteration,
  onRejectIteration,
  busy,
}: {
  routine: RoutineDTO;
  onApproveIteration: (iterationId: string) => void;
  onRejectIteration: (iterationId: string) => void;
  busy?: boolean;
}) {
  const iterations = useMemo(() => routine.iterations ?? [], [routine.iterations]);
  const asc = useMemo(() => [...iterations].sort((a, b) => a.seq - b.seq), [iterations]);
  const desc = useMemo(() => [...iterations].sort((a, b) => b.seq - a.seq), [iterations]);
  const latest = asc[asc.length - 1];
  const snapshot = loopStageOf(latest, routine);

  return (
    <div className="space-y-4">
      {/* 目标 / 验收标准 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Goal</h3>
          <p className="whitespace-pre-wrap break-words text-xs text-foreground">{routine.goal}</p>
        </section>
        <section className="rounded-card border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Acceptance Criteria
          </h3>
          <p className="whitespace-pre-wrap break-words text-xs text-text-secondary">
            {routine.acceptance_criteria}
          </p>
        </section>
      </div>

      {/* 闭环过程 */}
      <RoutineLoopDiagram snapshot={snapshot} latest={latest} routine={routine} />

      {/* 守卫 / 预算 */}
      <RoutineGuardPanel routine={routine} iterations={asc} />

      {/* 收敛趋势 + 甘特 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RoutineConvergenceChart
          iterations={asc}
          threshold={routine.success_score_threshold}
          bestScore={routine.best_score}
        />
        <RoutineRunGantt iterations={asc} />
      </div>

      {/* 反思记忆流 */}
      <ReflectionFlow iterations={asc} />

      {/* 迭代明细 */}
      <section className="rounded-card border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          迭代明细 · Iterations ({iterations.length})
        </h3>
        <RoutineIterationTimeline
          iterations={desc}
          onApprove={onApproveIteration}
          onReject={onRejectIteration}
          busy={busy}
        />
      </section>
    </div>
  );
}
