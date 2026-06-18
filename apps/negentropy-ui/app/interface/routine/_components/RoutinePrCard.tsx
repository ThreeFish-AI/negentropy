"use client";

import { GitPullRequest } from "lucide-react";

/**
 * PR 卡片 —— FINALIZE 阶段 Claude Code 创建 PR 后，展示「查看 PR」与「在 GitHub 合并」。
 *
 * 安全：合并是人工动作，此处仅 link-out 到 GitHub（不调用任何后端 merge 接口、不自动合并）。
 */
export function RoutinePrCard({ prUrl }: { prUrl: string | null | undefined }) {
  if (!prUrl) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/[0.04] p-3">
      <GitPullRequest className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
      <a
        href={prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate text-body font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
        title={prUrl}
      >
        查看 PR
      </a>
      <a
        href={prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 dark:border-emerald-800 dark:text-emerald-400"
      >
        在 GitHub 合并 →
      </a>
    </div>
  );
}
