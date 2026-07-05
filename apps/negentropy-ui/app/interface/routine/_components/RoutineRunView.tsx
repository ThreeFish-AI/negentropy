"use client";

import { useMemo, useState } from "react";

import type { LiveActionsByIteration, RoutineDTO, RoutineIterationDTO } from "@/features/routine";

import { BaseDrawer } from "@/components/ui/BaseDrawer";
import { EdgePanelRail, type EdgePanelDef } from "@/components/ui/EdgePanelRail";

import { IterationAuditDrawer } from "./IterationAuditDrawer";
import { ReflectionFlow } from "./ReflectionFlow";
import { RoutineConvergenceChart } from "./RoutineConvergenceChart";
import { RoutineGuardPanel } from "./RoutineGuardPanel";
import { RoutineIterationTimeline } from "./RoutineIterationTimeline";
import { RoutineLoopDiagram } from "./RoutineLoopDiagram";
import { RoutinePrCard } from "./RoutinePrCard";
import { RoutineRunGantt } from "./RoutineRunGantt";
import { RoutineWorkspaceCard } from "./RoutineWorkspaceCard";
import { loopStageOf } from "./routine-loop";

/**
 * 单任务「全过程」视图主体。
 *
 * 信息架构（渐进披露）：主列仅置**闭环过程**（顶部）+ **迭代明细**（其下）两块核心内容；
 * 其余模块（目标 / 验收标准 / 隔离工作区 / PR / 守卫预算 / 收敛趋势 / 执行时间线 / 反思记忆流）
 * 收敛为**右缘竖排标签**呼出的右侧抽屉（仿 Knowledge Graph 页 PanelRail 交互），按需查看、互不干扰。
 *
 * 迭代明细每张卡片可下钻「全过程」审计抽屉，按时间线还原该轮所有动作的输入/输出/上下文，
 * 并叠加在途迭代的实时动作流。模块抽屉与审计抽屉**互斥**（同一时刻仅一个开启，避免双遮罩叠加）。
 *
 * 置于深链路由 ``/interface/routine/[id]``（外层由 ClockProvider 包裹以驱动实时计时）。
 */

type ModuleKey =
  | "goal"
  | "acceptance"
  | "workspace"
  | "pr"
  | "guard"
  | "convergence"
  | "timeline"
  | "reflexion";

/** 模块抽屉宽度：收敛图/甘特/反思流受益于更宽视口，小屏回退 90vw 区间。 */
const MODULE_DRAWER_WIDTH = "[width:clamp(360px,66vw,1100px)]";

export function RoutineRunView({
  routine,
  onApproveIteration,
  onRejectIteration,
  onCleanupWorktree,
  onSyncPr,
  liveActionsByIteration,
  busy,
}: {
  routine: RoutineDTO;
  onApproveIteration: (iterationId: string) => void;
  onRejectIteration: (iterationId: string) => void;
  onCleanupWorktree?: () => void;
  /** 手动同步 PR 合并状态（PR 抽屉「同步状态」按钮回调）。 */
  onSyncPr?: () => void | Promise<void>;
  liveActionsByIteration?: LiveActionsByIteration;
  busy?: boolean;
}) {
  const iterations = useMemo(() => routine.iterations ?? [], [routine.iterations]);
  const asc = useMemo(() => [...iterations].sort((a, b) => a.seq - b.seq), [iterations]);
  const desc = useMemo(() => [...iterations].sort((a, b) => b.seq - a.seq), [iterations]);
  const latest = asc[asc.length - 1];
  const snapshot = loopStageOf(latest, routine);

  // 模块抽屉（右缘标签呼出）。从最新 routine.iterations 派生当前迭代，使在途状态/评分随详情重拉同步。
  const [openModule, setOpenModule] = useState<ModuleKey | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const auditIteration = useMemo(
    () => (auditId ? (iterations.find((it) => it.id === auditId) ?? null) : null),
    [auditId, iterations],
  );

  // 互斥：打开任一抽屉即关闭另一类，避免两个 z-[45] 遮罩叠加（双重变暗 + 焦点陷阱冲突）。
  const toggleModule = (key: ModuleKey) => {
    setAuditId(null);
    setOpenModule((prev) => (prev === key ? null : key));
  };
  const closeModule = () => setOpenModule(null);
  const openAudit = (it: RoutineIterationDTO) => {
    setOpenModule(null);
    setAuditId(it.id);
  };

  const panels: EdgePanelDef<ModuleKey>[] = [
    { key: "goal", label: "Goal" },
    { key: "acceptance", label: "验收" },
    { key: "workspace", label: "工作区" },
    { key: "pr", label: "PR", visible: !!routine.pr_url },
    { key: "guard", label: "守卫" },
    { key: "convergence", label: "收敛" },
    { key: "timeline", label: "时间线" },
    { key: "reflexion", label: "反思" },
  ];

  return (
    <>
      {/* 主列：顶部闭环图 + 其下迭代明细（右侧留白为竖排标签让位）*/}
      <div className="space-y-6 pr-12">
        {/* 闭环过程 */}
        <RoutineLoopDiagram snapshot={snapshot} latest={latest} routine={routine} />

        {/* 迭代明细 */}
        <section className="rounded-card border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-xs uppercase tracking-overline text-text-secondary">
            迭代明细 · Iterations ({iterations.length})
          </h3>
          <RoutineIterationTimeline
            iterations={desc}
            onApprove={onApproveIteration}
            onReject={onRejectIteration}
            onAudit={openAudit}
            busy={busy}
          />
        </section>
      </div>

      {/* 右缘竖排标签轨道（fixed 常驻，垂直居中，避开顶部导航）*/}
      <div className="fixed right-0 top-1/2 z-40 max-h-[calc(100vh-7rem)] -translate-y-1/2 overflow-y-auto">
        <EdgePanelRail
          panels={panels}
          openKey={openModule}
          onToggle={toggleModule}
          ariaLabel="模块面板"
        />
      </div>

      {/* 模块抽屉（单开，宽·模态，标题统一由抽屉头提供）*/}
      <BaseDrawer
        open={openModule === "goal"}
        onClose={closeModule}
        title="Goal · 目标"
        widthClassName={MODULE_DRAWER_WIDTH}
      >
        <div className="px-5 py-5">
          <p className="max-w-prose whitespace-pre-wrap break-words text-body text-foreground">
            {routine.goal}
          </p>
        </div>
      </BaseDrawer>

      <BaseDrawer
        open={openModule === "acceptance"}
        onClose={closeModule}
        title="Acceptance Criteria · 验收标准"
        widthClassName={MODULE_DRAWER_WIDTH}
      >
        <div className="px-5 py-5">
          <p className="max-w-prose whitespace-pre-wrap break-words text-body text-text-secondary">
            {routine.acceptance_criteria}
          </p>
        </div>
      </BaseDrawer>

      <BaseDrawer
        open={openModule === "workspace"}
        onClose={closeModule}
        title="ISOLATED WORKSPACE · 隔离工作区"
        widthClassName={MODULE_DRAWER_WIDTH}
      >
        <div className="px-5 py-5">
          <RoutineWorkspaceCard
            routine={routine}
            onCleanup={onCleanupWorktree ?? (() => {})}
            cleanupBusy={busy}
            bare
          />
        </div>
      </BaseDrawer>

      {routine.pr_url && (
        <BaseDrawer
          open={openModule === "pr"}
          onClose={closeModule}
          title="PULL REQUEST"
          widthClassName={MODULE_DRAWER_WIDTH}
        >
          <div className="px-5 py-5">
            <RoutinePrCard
              prUrl={routine.pr_url}
              merged={routine.pr_merged}
              prState={routine.pr_state}
              onSync={onSyncPr}
            />
          </div>
        </BaseDrawer>
      )}

      <BaseDrawer
        open={openModule === "guard"}
        onClose={closeModule}
        title="守卫 / 预算 · Why will it stop?"
        widthClassName={MODULE_DRAWER_WIDTH}
      >
        <div className="px-5 py-5">
          <RoutineGuardPanel routine={routine} iterations={asc} bare />
        </div>
      </BaseDrawer>

      <BaseDrawer
        open={openModule === "convergence"}
        onClose={closeModule}
        title="评分收敛趋势 · Convergence"
        widthClassName={MODULE_DRAWER_WIDTH}
      >
        <div className="px-5 py-5">
          <RoutineConvergenceChart
            iterations={asc}
            threshold={routine.success_score_threshold}
            bestScore={routine.best_score}
            bare
          />
        </div>
      </BaseDrawer>

      <BaseDrawer
        open={openModule === "timeline"}
        onClose={closeModule}
        title="迭代时间线 · Run Timeline"
        widthClassName={MODULE_DRAWER_WIDTH}
      >
        <div className="px-5 py-5">
          <RoutineRunGantt iterations={asc} bare />
        </div>
      </BaseDrawer>

      <BaseDrawer
        open={openModule === "reflexion"}
        onClose={closeModule}
        title="反思记忆流 · Reflexion"
        widthClassName={MODULE_DRAWER_WIDTH}
      >
        <div className="px-5 py-5">
          <ReflectionFlow iterations={asc} bare />
        </div>
      </BaseDrawer>

      {/* 「全过程」审计抽屉（迭代卡片下钻，与模块抽屉互斥）*/}
      <IterationAuditDrawer
        open={auditId != null}
        onClose={() => setAuditId(null)}
        routineId={routine.id}
        iteration={auditIteration}
        liveActions={auditId ? liveActionsByIteration?.[auditId] : undefined}
        projectPath={routine.cwd}
      />
    </>
  );
}
