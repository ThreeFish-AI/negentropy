"use client";

import { useEffect, useRef } from "react";
import { PanelRight, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConnectionState, LogEntry } from "@/types/common";
import { StateSnapshot } from "./StateSnapshot";
import { EventTimeline, type TimelineItem } from "./EventTimeline";
import { LogBufferPanel } from "./LogBufferPanel";

type StateDrawerProps = {
  /** 抽屉是否展开（由 home-body 的 showRightPanel 驱动）。 */
  open: boolean;
  /** 收起抽屉（工具栏 toggle / 头部 X / ESC 共用同一出口）。 */
  onClose: () => void;
  /** 当前选中的历史消息节点；非空即「历史视图」。 */
  selectedNodeId: string | null;
  /** 返回实时视图（清空 selectedNodeId）。 */
  onReturnToLive: () => void;
  snapshot: Record<string, unknown> | null;
  connection: ConnectionState;
  timelineItems: TimelineItem[];
  logEntries: LogEntry[];
  onExportLogs: () => void;
};

/**
 * State 观测抽屉 —— 非模态浮层。
 *
 * 设计要点（详见方案文档 Part A）：
 * - **非模态**：外层 `pointer-events-none` 全屏容器仅用于定位，唯有 `<aside>` 捕获指针；
 *   抽屉左侧留白区对中栏对话保持可点击，从而**保留「点消息 → 历史视图」**的核心交互。
 *   因此不复用 `OverlayDismissLayer`（其全屏遮罩会拦截一切外部点击）。
 * - **层级**：`z-40` 居于工具栏（`z-10`）之上、真模态（`ApprovalDialog` 等 `z-50`）之下。
 * - **动画**：用 `transform`+`opacity`（非 `width`）滑入/滑出，200ms，进 ease-out / 出 ease-in；
 *   `prefers-reduced-motion` 由 globals.css 全局归零，无需额外处理。
 * - **常驻挂载**：合拢时靠 `translate-x-full opacity-0` + `inert` 移出视图与可达性树，
 *   以便播放退出动画；`pointer-events` 双层控制确保合拢时不拦截点击。
 * - **可达性**：`role="dialog"` + `aria-label`，**不设 `aria-modal`**（非模态、不做焦点陷阱，
 *   用户须能 Tab 回对话区点选消息）。展开时把焦点移入抽屉。
 */
export function StateDrawer({
  open,
  onClose,
  selectedNodeId,
  onReturnToLive,
  snapshot,
  connection,
  timelineItems,
  logEntries,
  onExportLogs,
}: StateDrawerProps) {
  const asideRef = useRef<HTMLElement | null>(null);

  // 展开时把焦点移入抽屉（非陷阱：用户仍可 Tab 回对话区点选消息）。
  useEffect(() => {
    if (open) {
      asideRef.current?.focus();
    }
  }, [open]);

  return (
    <div
      // 外层全屏但 click-through：仅 <aside> 捕获指针，留白区对对话仍可点击。
      className="pointer-events-none fixed inset-y-0 right-0 z-40 flex justify-end"
    >
      <aside
        ref={asideRef}
        role="dialog"
        aria-label="State 观测面板"
        tabIndex={-1}
        inert={!open ? true : undefined}
        className={cn(
          // 宽度 2.5×（320 → 800）：窄屏全宽、≥sm 固定 800、永不超 90vw。
          "pointer-events-auto relative flex h-full w-full max-w-[90vw] flex-col border-l border-border bg-card shadow-2xl sm:w-[800px]",
          // transform+opacity 动画（非 width，规避属性能反模式）。
          "transition-[transform,opacity] duration-200 will-change-transform",
          open
            ? "translate-x-0 opacity-100 ease-out"
            : "translate-x-full opacity-0 ease-in",
        )}
      >
        {/* 左边缘收起指示条：hover 展开 + 点击关闭。 */}
        {open && (
          <button
            type="button"
            onClick={onClose}
            aria-label="收起 State 栏"
            className="group/edge absolute inset-y-0 -left-0 z-10 flex w-1.5 cursor-pointer items-center justify-center rounded-none transition-[width,background-color] duration-200 hover:w-3 hover:bg-primary/30"
          >
            <span className="pointer-events-none h-8 rounded-full bg-text-muted/30 transition-[height,background-color] duration-200 group-hover/edge:h-12 group-hover/edge:bg-primary/60" />
          </button>
        )}

        {/* 头部：标题 + 关闭 X（呼应 ActivityDrawer 的头部节奏） */}
        <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <PanelRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
            State
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="收起 State 栏 (⌘/Ctrl+J)"
            title="收起 State 栏 (⌘/Ctrl+J)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-border-muted/60 text-text-secondary transition-[background-color,color,transform] duration-150 hover:bg-border-muted hover:text-text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {/* 主体：纵向叠放布局（#739 审定，State Snapshot / Runtime Logs / Event Timeline 各占满宽）。 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            {/* 视图模式提示 */}
            <div>
              {selectedNodeId ? (
                <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-200">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                        aria-hidden="true"
                      />
                      历史视图
                    </span>
                    <button
                      type="button"
                      onClick={onReturnToLive}
                      className="rounded text-xs font-medium text-amber-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-300"
                    >
                      返回实时
                    </button>
                  </div>
                  <p className="mt-1 text-micro text-amber-700/80 dark:text-amber-300/80">
                    显示选定消息的观察数据
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-border-muted/50 p-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-text-muted"
                      aria-hidden="true"
                    />
                    实时视图
                  </span>
                  <p className="mt-1 text-micro text-text-muted">
                    点击任意消息进入历史视图，再次点击或点「返回实时」回到实时
                  </p>
                </div>
              )}
            </div>

            <StateSnapshot snapshot={snapshot} connection={connection} />
            <LogBufferPanel entries={logEntries} onExport={onExportLogs} />
            <EventTimeline events={timelineItems} />
          </div>
        </div>
      </aside>
    </div>
  );
}
