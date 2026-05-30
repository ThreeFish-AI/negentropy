"use client";

import { LOOP_STAGES, LOOP_STAGE_META, type LoopSnapshot, type LoopStage } from "./routine-loop";

/**
 * Evaluator-Optimizer 闭环阶段条 —— 4 段等宽步进器（Dispatch→Execute→Evaluate→Decide）。
 *
 * 复用于 Fleet 卡片（compact）与 Run 循环图（md，带标签）。颜色取自 [[routine-loop]] 的
 * ``LOOP_STAGE_META.dot``，与时间线点位同源。活动段描边 + 可选脉冲；done 模式下 Decide 段
 * 按终态着色（succeeded 绿 / failed 红 / cancelled 灰），避免「全绿误读为成功」。
 */

interface RoutineLoopBarProps {
  snapshot: LoopSnapshot;
  size?: "sm" | "md";
  /** 是否在段下方渲染阶段标签（Run 视图用）。 */
  showLabels?: boolean;
  className?: string;
}

/** done 模式下 Decide 段的终态着色。 */
function decideDoneDot(routineStatus: LoopSnapshot["routineStatus"]): string {
  switch (routineStatus) {
    case "succeeded":
      return "bg-emerald-500";
    case "failed":
      return "bg-red-500";
    case "cancelled":
      return "bg-text-muted";
    default:
      return "bg-emerald-500";
  }
}

function segClass(
  stage: LoopStage,
  snapshot: LoopSnapshot,
): { cls: string; pulse: boolean } {
  const state = snapshot.stageStates[stage];
  if (state === "pending") return { cls: "bg-muted", pulse: false };

  let dot = LOOP_STAGE_META[stage].dot;
  if (snapshot.mode === "done" && stage === "decide") {
    dot = decideDoneDot(snapshot.routineStatus);
  }
  if (state === "active") {
    return { cls: `${dot} ring-2 ring-foreground/20`, pulse: snapshot.pulsing };
  }
  return { cls: dot, pulse: false }; // done
}

export function RoutineLoopBar({ snapshot, size = "sm", showLabels = false, className }: RoutineLoopBarProps) {
  const barH = size === "md" ? "h-2.5" : "h-1.5";
  const ariaLabel =
    snapshot.mode === "looping" && snapshot.activeStage
      ? `当前阶段：${LOOP_STAGE_META[snapshot.activeStage].label}`
      : `闭环：${snapshot.mode}`;

  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <div className="flex items-center gap-1">
        {LOOP_STAGES.map((stage) => {
          const { cls, pulse } = segClass(stage, snapshot);
          const meta = LOOP_STAGE_META[stage];
          const isActive = snapshot.stageStates[stage] === "active";
          return (
            <div
              key={stage}
              title={`${meta.label} · ${snapshot.stageStates[stage]} · ${meta.desc}`}
              className={`flex-1 rounded-full ${barH} ${cls} ${pulse ? "animate-pulse" : ""} ${
                isActive ? "" : "opacity-90"
              } transition-colors`}
            />
          );
        })}
      </div>
      {showLabels && (
        <div className="mt-1.5 flex items-center gap-1">
          {LOOP_STAGES.map((stage) => {
            const isActive = snapshot.stageStates[stage] === "active";
            const isDone = snapshot.stageStates[stage] === "done";
            return (
              <div
                key={stage}
                className={`flex-1 text-center text-[10px] tracking-tight ${
                  isActive
                    ? "font-semibold text-foreground"
                    : isDone
                      ? "text-text-secondary"
                      : "text-text-muted"
                }`}
              >
                {LOOP_STAGE_META[stage].label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
