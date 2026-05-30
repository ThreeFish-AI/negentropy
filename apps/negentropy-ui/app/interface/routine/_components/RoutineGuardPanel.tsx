"use client";

import { useMemo } from "react";

import type { RoutineDTO, RoutineIterationDTO } from "@/features/routine";

import { useClock } from "./ClockProvider";
import { RoutineMeter } from "./RoutineMeter";
import { formatDuration, remainingMs } from "./routine-format";
import { limitFillClass, scoreFillClass } from "./status-style";

const TERMINAL: ReadonlySet<string> = new Set(["succeeded", "failed", "cancelled"]);

/**
 * 守卫 / 预算面板 —— 可视化「为何/何时会停」：迭代、成本、成功分、截止、无进展、震荡。
 * 最逼近极限者标注为「预计停因」；终态后以实际 termination_reason 替换预测。
 */
export function RoutineGuardPanel({
  routine,
  iterations,
}: {
  routine: RoutineDTO;
  iterations: RoutineIterationDTO[];
}) {
  const now = useClock();
  const isTerminal = TERMINAL.has(routine.status);

  const iterRatio = routine.max_iterations ? routine.iteration_count / routine.max_iterations : null;
  const costRatio = routine.max_cost_usd ? routine.total_cost_usd / routine.max_cost_usd : null;

  // 截止逼近度：created_at → deadline_at 的已用比例。
  const deadline = useMemo(() => {
    if (!routine.deadline_at) return null;
    const remain = remainingMs(routine.deadline_at, now);
    if (remain == null) return null;
    const created = routine.created_at ? Date.parse(routine.created_at) : NaN;
    const dl = Date.parse(routine.deadline_at);
    const ratio =
      !Number.isNaN(created) && dl > created ? Math.min(1, (now - created) / (dl - created)) : null;
    return { remain, ratio };
  }, [routine.deadline_at, routine.created_at, now]);

  // 无进展尾部计数（近似：尾部 stalled/regressed 连续数）+ 震荡/不可恢复告警。
  const { streak, oscillation, unrecoverable } = useMemo(() => {
    const evaluated = [...iterations]
      .sort((a, b) => a.seq - b.seq)
      .filter((it) => it.status === "evaluated" && it.verdict != null);
    let s = 0;
    for (let i = evaluated.length - 1; i >= 0; i--) {
      const v = evaluated[i].verdict;
      if (v === "stalled" || v === "regressed") s++;
      else break;
    }
    const last4 = evaluated.slice(-4).map((it) => it.verdict);
    return {
      streak: s,
      oscillation: last4.includes("regressed") && last4.includes("progressing"),
      unrecoverable: last4.includes("unrecoverable"),
    };
  }, [iterations]);

  // 预计停因（非终态时）：取逼近度最高者。
  const predicted = useMemo(() => {
    if (isTerminal) return null;
    const cands: { label: string; ratio: number }[] = [];
    if (iterRatio != null) cands.push({ label: "max_iterations", ratio: iterRatio });
    if (costRatio != null) cands.push({ label: "max_cost", ratio: costRatio });
    if (deadline?.ratio != null) cands.push({ label: "deadline", ratio: deadline.ratio });
    if (routine.no_progress_patience > 0)
      cands.push({ label: "no_progress", ratio: streak / routine.no_progress_patience });
    cands.sort((a, b) => b.ratio - a.ratio);
    const top = cands[0];
    return top && top.ratio >= 0.85 ? top : null;
  }, [isTerminal, iterRatio, costRatio, deadline, streak, routine.no_progress_patience]);

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        守卫 / 预算 · Why will it stop?
      </h3>

      {isTerminal ? (
        <div className="mb-3 rounded-lg border border-border bg-muted/40 p-2.5 text-[11px]">
          <span className="text-text-muted">实际终止原因：</span>
          <span className="font-semibold text-foreground">{routine.termination_reason ?? "—"}</span>
        </div>
      ) : predicted ? (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
          ⚠ 预计停因：<span className="font-semibold">{predicted.label}</span>（
          {Math.round(predicted.ratio * 100)}%）
        </div>
      ) : null}

      <div className="space-y-2.5">
        <RoutineMeter
          label="Iterations"
          valueText={
            routine.max_iterations
              ? `${routine.iteration_count} / ${routine.max_iterations}`
              : `${routine.iteration_count}（无上限）`
          }
          ratio={iterRatio}
          fillClass={iterRatio == null ? "bg-sky-500/50" : limitFillClass(iterRatio)}
        />
        <RoutineMeter
          label="Cost (USD)"
          valueText={
            routine.max_cost_usd
              ? `$${routine.total_cost_usd.toFixed(3)} / $${routine.max_cost_usd}`
              : `$${routine.total_cost_usd.toFixed(3)}（无上限）`
          }
          ratio={costRatio}
          fillClass={costRatio == null ? "bg-sky-500/50" : limitFillClass(costRatio)}
        />
        <RoutineMeter
          label="Success Score"
          valueText={`best ${routine.best_score ?? "—"} → 阈值 ${routine.success_score_threshold}`}
          ratio={routine.best_score != null ? routine.best_score / 100 : null}
          fillClass={scoreFillClass(routine.best_score, routine.success_score_threshold)}
          notchPct={routine.success_score_threshold}
        />
        {deadline && (
          <RoutineMeter
            label="Deadline"
            valueText={deadline.remain > 0 ? `${formatDuration(deadline.remain)} 剩余` : "已到期"}
            ratio={deadline.ratio}
            fillClass={deadline.ratio == null ? "bg-sky-500/50" : limitFillClass(deadline.ratio)}
          />
        )}

        {/* 无进展计数 */}
        <div>
          <div className="flex items-baseline justify-between text-[10px] text-text-muted">
            <span>No-progress（停滞）</span>
            <span className="tabular-nums text-text-secondary">
              {streak} / {routine.no_progress_patience}
            </span>
          </div>
          <div className="mt-1 flex gap-1">
            {Array.from({ length: Math.max(1, routine.no_progress_patience) }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < streak ? "bg-amber-500" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 震荡 / 不可恢复告警 */}
      {(oscillation || unrecoverable) && !isTerminal && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {oscillation && (
            <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-300">
              震荡风险
            </span>
          )}
          {unrecoverable && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
              不可恢复信号
            </span>
          )}
        </div>
      )}
    </section>
  );
}
