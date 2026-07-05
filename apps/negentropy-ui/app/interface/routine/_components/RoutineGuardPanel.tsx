"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { RoutineDTO, RoutineIterationDTO } from "@/features/routine";
import { updateRoutine } from "@/features/routine/api";

import { useClock } from "./ClockProvider";
import { RoutineMeter } from "./RoutineMeter";
import { formatDuration, remainingMs } from "./routine-format";
import { limitFillClass, scoreFillClass } from "./status-style";

const TERMINAL: ReadonlySet<string> = new Set(["succeeded", "failed", "cancelled"]);

/**
 * 守卫 / 预算面板 —— 可视化「为何/何时会停」：迭代、成本、成功分、截止、无进展、震荡。
 * 最逼近极限者标注为「预计停因」；终态后以实际 termination_reason 替换预测。
 *
 * 非终态下 Success Score 阈值支持内联编辑（点击徽章 → 数字输入框 → Enter/Blur 确认），
 * 让用户在 Running 状态下即可动态调整成功阈值。
 */
export function RoutineGuardPanel({
  routine,
  iterations,
  bare = false,
}: {
  routine: RoutineDTO;
  iterations: RoutineIterationDTO[];
  /** 抽屉内渲染：省去卡片外壳与标题（标题由抽屉头提供）。 */
  bare?: boolean;
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
    <section className={bare ? "" : "rounded-card border border-border bg-card p-4 shadow-sm"}>
      {!bare && (
        <h3 className="mb-2 text-xs uppercase tracking-overline text-text-secondary">
          守卫 / 预算 · Why will it stop?
        </h3>
      )}

      {isTerminal ? (
        <div className="mb-3 rounded-lg border border-border bg-muted/40 p-2.5 text-body">
          <span className="text-text-secondary">实际终止原因：</span>
          <span className="font-semibold text-foreground">{routine.termination_reason ?? "—"}</span>
        </div>
      ) : predicted ? (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-body text-amber-700 dark:text-amber-300">
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
        <SuccessScoreMeter routine={routine} />
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
          <div className="flex items-baseline justify-between text-xs text-text-secondary">
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
            <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
              震荡风险
            </span>
          )}
          {unrecoverable && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
              不可恢复信号
            </span>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Success Score 内联阈值编辑器
// ---------------------------------------------------------------------------

/** 非终态下可内联编辑阈值的 Success Score 行 */
function SuccessScoreMeter({ routine }: { routine: RoutineDTO }) {
  const isTerminal = TERMINAL.has(routine.status);
  const threshold = routine.success_score_threshold;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(threshold));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openEditor = useCallback(() => {
    if (isTerminal) return;
    setDraft(String(threshold));
    setEditing(true);
    // Focus after React renders the input
    requestAnimationFrame(() => inputRef.current?.select());
  }, [isTerminal, threshold]);

  const commit = useCallback(async () => {
    const next = Math.max(0, Math.min(100, Number.parseInt(draft, 10)));
    if (Number.isNaN(next) || next === threshold) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateRoutine(routine.id, { success_score_threshold: next });
      // SSE debounced refetch 或父组件刷新会自然更新 routine prop
    } catch {
      // revert on failure
      setDraft(String(threshold));
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, routine.id, threshold]);

  const cancel = useCallback(() => {
    setDraft(String(threshold));
    setEditing(false);
  }, [threshold]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel],
  );

  // 阈值文字区：终态 → 纯文本；非终态 → 可点击徽章 / 编辑态
  const thresholdElement = isTerminal ? (
    <span className="tabular-nums">阈值 {threshold}</span>
  ) : editing ? (
    <input
      ref={inputRef}
      type="number"
      min={0}
      max={100}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      disabled={saving}
      className="h-4 w-12 rounded border border-border bg-background px-1 text-right text-xs tabular-nums text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
      autoFocus
    />
  ) : (
    <button
      type="button"
      onClick={openEditor}
      className="inline-flex items-center gap-0.5 rounded px-1 text-xs tabular-nums text-text-secondary transition-colors hover:bg-muted hover:text-foreground"
      title="点击调整 Success Score 阈值"
    >
      阈值 <span className="font-semibold">{threshold}</span>
      <svg
        className="h-2.5 w-2.5 opacity-40"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M11.5 2.5l2 2L5.5 12.5H3.5v-2l8-8z" />
      </svg>
    </button>
  );

  return (
    <RoutineMeter
      label="Success Score"
      valueText={`best ${routine.best_score ?? "—"}`}
      ratio={routine.best_score != null ? routine.best_score / 100 : null}
      fillClass={scoreFillClass(routine.best_score, routine.success_score_threshold)}
      notchPct={routine.success_score_threshold}
      rightElement={thresholdElement}
    />
  );
}
