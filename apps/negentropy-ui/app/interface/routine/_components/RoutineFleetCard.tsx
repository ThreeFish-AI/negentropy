"use client";

import { memo } from "react";

import { Card } from "@/components/ui/Card";
import type { RoutineDTO, RoutineIterationLite } from "@/features/routine";

import { LiveElapsed } from "./ElapsedClock";
import { RoutineLoopBar } from "./RoutineLoopBar";
import { RoutineMeter } from "./RoutineMeter";
import { LOOP_STAGE_META, loopStageOf } from "./routine-loop";
import { limitFillClass, routineStatusClass, scoreColorClass, scoreFillClass } from "./status-style";

interface RoutineFleetCardProps {
  routine: RoutineDTO;
  latest: RoutineIterationLite | undefined;
  /** 快速预览（右侧抽屉）。 */
  onOpenDetail: (r: RoutineDTO) => void;
  /** 打开全屏 Run 全过程页（深链路由）。 */
  onOpenFull: (r: RoutineDTO) => void;
}

const ACTIVE_TIMING: ReadonlySet<string> = new Set(["dispatched", "in_flight", "executed"]);

export const RoutineFleetCard = memo(function RoutineFleetCard({
  routine,
  latest,
  onOpenDetail,
  onOpenFull,
}: RoutineFleetCardProps) {
  const snapshot = loopStageOf(latest, routine);
  const needsApproval = latest?.status === "pending_approval";
  const timing = !!latest && ACTIVE_TIMING.has(latest.status) && !!latest.started_at;

  const iterRatio = routine.max_iterations
    ? routine.iteration_count / routine.max_iterations
    : null;
  const costRatio = routine.max_cost_usd ? routine.total_cost_usd / routine.max_cost_usd : null;

  return (
    <Card
      interactive
      onClick={() => onOpenDetail(routine)}
      className="flex flex-col gap-3 p-4"
    >
      {/* 标题 + 状态 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {routine.display_name || routine.title}
          </div>
          <div className="truncate text-[10px] text-text-muted">{routine.key}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {needsApproval && (
            <span className="inline-flex animate-pulse items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              待审批
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${routineStatusClass(routine.status)}`}
          >
            {routine.status}
          </span>
        </div>
      </div>

      {/* 闭环阶段条 */}
      <RoutineLoopBar snapshot={snapshot} size="sm" />

      {/* 实时/终态信息行 */}
      <div className="flex min-h-4 items-center gap-2 text-[11px] text-text-secondary">
        {timing ? (
          <>
            <span className="font-medium text-foreground">
              {snapshot.activeStage ? LOOP_STAGE_META[snapshot.activeStage].label : "运行中"}
            </span>
            <LiveElapsed startedAt={latest?.started_at ?? null} className="text-text-secondary" />
            {latest?.turn_count != null && (
              <span className="text-text-muted">· {latest.turn_count} turns</span>
            )}
          </>
        ) : snapshot.mode === "done" ? (
          <span className="text-text-muted">
            {snapshot.terminationReason ? `终止：${snapshot.terminationReason}` : "已结束"}
          </span>
        ) : snapshot.mode === "paused" ? (
          <span className="text-amber-600 dark:text-amber-400">已暂停</span>
        ) : snapshot.mode === "waiting-approval" ? (
          <span className="text-amber-600 dark:text-amber-400">等待审批后派发</span>
        ) : (
          <span className="text-text-muted">空闲</span>
        )}
      </div>

      {/* 指标条 */}
      <div className="space-y-2">
        <RoutineMeter
          label="Iterations"
          valueText={
            routine.max_iterations
              ? `${routine.iteration_count} / ${routine.max_iterations}`
              : `${routine.iteration_count}`
          }
          ratio={iterRatio}
          fillClass={iterRatio == null ? "bg-sky-500/60" : limitFillClass(iterRatio)}
        />
        <RoutineMeter
          label="Best Score"
          valueText={`best ${routine.best_score ?? "—"} · last ${routine.last_score ?? "—"}`}
          ratio={routine.best_score != null ? routine.best_score / 100 : null}
          fillClass={scoreFillClass(routine.best_score, routine.success_score_threshold)}
          notchPct={routine.success_score_threshold}
        />
        <RoutineMeter
          label="Cost"
          valueText={
            routine.max_cost_usd
              ? `$${routine.total_cost_usd.toFixed(3)} / $${routine.max_cost_usd}`
              : `$${routine.total_cost_usd.toFixed(3)}`
          }
          ratio={costRatio}
          fillClass={costRatio == null ? "bg-sky-500/60" : limitFillClass(costRatio)}
        />
      </div>

      {/* 页脚：打开全屏 */}
      <div className="flex items-center justify-between pt-0.5">
        <span className={`text-[10px] tabular-nums ${scoreColorClass(routine.last_score)}`}>
          {routine.last_score != null ? `score ${routine.last_score}` : ""}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenFull(routine);
          }}
          className="cursor-pointer rounded text-[11px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          全过程 →
        </button>
      </div>
    </Card>
  );
});
