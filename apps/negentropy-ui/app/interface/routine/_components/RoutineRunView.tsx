"use client";

import { useMemo, useState } from "react";

import type { LiveActionsByIteration, RoutineDTO, RoutineIterationDTO } from "@/features/routine";

import { IterationAuditDrawer } from "./IterationAuditDrawer";
import { ReflectionFlow } from "./ReflectionFlow";
import { RoutineConvergenceChart } from "./RoutineConvergenceChart";
import { RoutineGuardPanel } from "./RoutineGuardPanel";
import { RoutineIterationTimeline } from "./RoutineIterationTimeline";
import { RoutineLoopDiagram } from "./RoutineLoopDiagram";
import { RoutinePrCard } from "./RoutinePrCard";
import { RoutineRunGantt } from "./RoutineRunGantt";
import { loopStageOf } from "./routine-loop";

/**
 * 单任务「全过程」视图主体 —— 闭环图 + 守卫面板 + 收敛趋势 + 甘特时间线 + 反思流 + 迭代明细。
 * 置于深链路由 ``/interface/routine/[id]``（外层由 ClockProvider 包裹以驱动实时计时）。
 *
 * 迭代明细的每张卡片可下钻「全过程」审计抽屉，按时间线还原该轮所有动作（工具调用/结果/
 * 中间消息/门控/评估）的输入/输出/上下文，并叠加在途迭代的实时动作流。
 */
export function RoutineRunView({
  routine,
  onApproveIteration,
  onRejectIteration,
  liveActionsByIteration,
  busy,
}: {
  routine: RoutineDTO;
  onApproveIteration: (iterationId: string) => void;
  onRejectIteration: (iterationId: string) => void;
  liveActionsByIteration?: LiveActionsByIteration;
  busy?: boolean;
}) {
  const iterations = useMemo(() => routine.iterations ?? [], [routine.iterations]);
  const asc = useMemo(() => [...iterations].sort((a, b) => a.seq - b.seq), [iterations]);
  const desc = useMemo(() => [...iterations].sort((a, b) => b.seq - a.seq), [iterations]);
  const latest = asc[asc.length - 1];
  const snapshot = loopStageOf(latest, routine);

  // 「全过程」审计抽屉：选中迭代下钻。从最新 routine.iterations 派生当前迭代，使在途状态/评分
  // 随详情重拉同步更新（抽屉据此在终态回查权威事件列表）。
  const [auditId, setAuditId] = useState<string | null>(null);
  const auditIteration = useMemo(
    () => (auditId ? (iterations.find((it) => it.id === auditId) ?? null) : null),
    [auditId, iterations],
  );

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

      {/* Pull Request（FINALIZE 产出，等待人工 Merge）*/}
      {routine.pr_url && (
        <section className="rounded-card border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Pull Request</h3>
          <RoutinePrCard prUrl={routine.pr_url} />
        </section>
      )}

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
          onAudit={(it: RoutineIterationDTO) => setAuditId(it.id)}
          busy={busy}
        />
      </section>

      {/* 「全过程」审计抽屉 */}
      <IterationAuditDrawer
        open={auditId != null}
        onClose={() => setAuditId(null)}
        routineId={routine.id}
        iteration={auditIteration}
        liveActions={auditId ? liveActionsByIteration?.[auditId] : undefined}
      />
    </div>
  );
}
