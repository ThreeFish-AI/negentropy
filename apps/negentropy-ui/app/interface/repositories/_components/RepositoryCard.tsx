"use client";

import { GitBranch, Github } from "lucide-react";
import type { RepositoryDTO } from "@/features/repositories";

interface RepositoryCardProps {
  repository: RepositoryDTO;
  onEdit: () => void;
  onDelete: () => void;
}

export function RepositoryCard({
  repository,
  onEdit,
  onDelete,
}: RepositoryCardProps) {
  const displayLabel = repository.display_name || repository.name;

  return (
    <div className="group relative flex h-[196px] flex-col rounded-xl border border-border bg-card p-4">
      {/* 卡片整体覆盖按钮：点击空白区进入编辑（操作按钮以更高 z-index 覆盖其上） */}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${displayLabel}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      />

      <div className="relative z-20 flex min-h-0 flex-1 flex-col pointer-events-none">
        <div className="mb-1 flex min-w-0 items-start justify-between gap-2">
          <h3 className="truncate text-lg font-semibold text-foreground">
            {displayLabel}
          </h3>
          <div className="flex shrink-0 items-center gap-2 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Edit Repository"
              aria-label={`Edit ${displayLabel}`}
              className="rounded-md p-2 text-text-muted hover:bg-muted hover:text-text-secondary"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete Repository"
              aria-label={`Delete ${displayLabel}`}
              className="rounded-md p-2 text-text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* 状态徽章行 */}
        <div className="mb-2 flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden whitespace-nowrap">
          {repository.is_enabled ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Enabled
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
              Disabled
            </span>
          )}
          {repository.is_builtin && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Built-In
            </span>
          )}
          <span className="inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {repository.visibility}
          </span>
        </div>

        {/* 本地路径（等宽小字、truncate、悬浮提示全文） */}
        <p
          className="mb-2 min-w-0 truncate font-mono text-xs text-text-muted"
          title={repository.local_path}
        >
          {repository.local_path}
        </p>

        {/* 基线分支 + GitHub 地址 */}
        <div className="mt-auto flex min-w-0 flex-col gap-1.5 pt-1 text-xs text-text-muted">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate font-mono" title={repository.baseline_branch}>
              {repository.baseline_branch}
            </span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Github className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate" title={repository.github_url}>
              {repository.github_url}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
