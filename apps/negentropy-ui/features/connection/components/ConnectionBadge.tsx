/**
 * 连接状态指示器组件
 *
 * 从 app/page.tsx 提取的连接状态显示逻辑
 * 遵循 AGENTS.md 原则：模块化、复用驱动、单一职责
 */

"use client";

import type { SessionRecord } from "@/types/common";

/**
 * ConnectionBadge 组件属性
 */
export interface ConnectionBadgeProps {
  /** 当前活动会话 */
  activeSession: SessionRecord | null;
  /** 是否显示左侧面板 */
  showLeftPanel: boolean;
  /** 是否显示右侧面板 */
  showRightPanel: boolean;
  /** 切换左侧面板回调 */
  onToggleLeftPanel: () => void;
  /** 切换右侧面板回调 */
  onToggleRightPanel: () => void;
  /** 应用名称 */
  appName?: string;
}

/**
 * 连接状态指示器组件
 *
 * 显示应用名称、侧边栏切换按钮
 */
export function ConnectionBadge({
  activeSession,
  showLeftPanel,
  showRightPanel,
  onToggleLeftPanel,
  onToggleRightPanel,
  appName = "Negentropy",
}: ConnectionBadgeProps) {
  return (
    <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-zinc-200/50 bg-white/50 backdrop-blur-sm z-10 w-full dark:border-zinc-800/50 dark:bg-zinc-900/50">
      {/* 左侧面板切换按钮 */}
      <button
        onClick={onToggleLeftPanel}
        className="group p-1.5 rounded-md hover:bg-zinc-200/80 text-zinc-500 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800/80"
        title={showLeftPanel ? "Close Sidebar" : "Open Sidebar"}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
          />
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>

      {/* 当前会话标签 */}
      <div className="text-xs font-medium text-zinc-400 max-w-md truncate mx-4 dark:text-zinc-500">
        {activeSession ? activeSession.label : appName}
      </div>

      {/* 右侧面板切换按钮 */}
      <button
        onClick={onToggleRightPanel}
        className="group p-1.5 rounded-md hover:bg-zinc-200/80 text-zinc-500 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800/80"
        title={showRightPanel ? "Close Panel" : "Open Panel"}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </button>
    </div>
  );
}

/**
 * 默认导出
 */
export default ConnectionBadge;
