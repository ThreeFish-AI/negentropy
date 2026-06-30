"use client";

import { useState } from "react";
import { GitMerge, GitPullRequest, Loader2, RefreshCw, X } from "lucide-react";

/**
 * PR 卡片 —— FINALIZE 阶段 Claude Code 创建 PR 后，展示「查看 PR」与 PR 状态。
 *
 * 三态（由 pr_state 决定，merged 为派生快捷入参）：
 * - ``merged`` 为真：violet「已合并 ✓」终态（合并是人工动作，已完成即不再提供合并入口）。
 * - ``prState === "closed"``：muted「已关闭」终态（已关闭未合并，不能合并 → 无合并链接、无同步按钮）。
 * - 否则（open / null）：保留「在 GitHub 合并 →」外链 + 「同步状态」按钮（合并后即时回写）。
 *
 * 安全：合并是人工动作，本组件仅 link-out 到 GitHub + 只读状态同步（不调用任何后端 merge 接口、不自动合并）。
 */
export function RoutinePrCard({
  prUrl,
  merged,
  prState,
  onSync,
}: {
  prUrl: string | null | undefined;
  merged?: boolean | null;
  prState?: "open" | "closed" | "merged" | null;
  onSync?: () => void | Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  if (!prUrl) return null;

  const isMerged = !!merged || prState === "merged";
  const isClosed = !isMerged && prState === "closed";

  const handleSync = async () => {
    if (syncing || !onSync) return;
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  };

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
      {isMerged ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-300 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:border-violet-700 dark:text-violet-300">
          <GitMerge className="h-3.5 w-3.5" aria-hidden />
          已合并 ✓
        </span>
      ) : isClosed ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-text-secondary">
          <X className="h-3.5 w-3.5" aria-hidden />
          已关闭
        </span>
      ) : (
        <>
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 dark:border-emerald-800 dark:text-emerald-400"
          >
            在 GitHub 合并 →
          </a>
          {onSync && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
              title="合并后点此即时回写 Merged 状态（无需等心跳轮询）"
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              同步状态
            </button>
          )}
        </>
      )}
    </div>
  );
}
