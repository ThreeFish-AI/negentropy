"use client";

import { GitBranch, Github, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  SortableCardWrapper,
  SortableDragHandle,
} from "@/components/ui/SortableCardWrapper";
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
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;
  const canEdit = isAdmin || !repository.is_builtin;

  const displayLabel = repository.display_name || repository.name;

  return (
    <SortableCardWrapper
      id={repository.id}
      onEdit={canEdit ? onEdit : undefined}
      canEdit={canEdit}
    >
      <div className="relative z-20 flex min-h-0 flex-1 flex-col pointer-events-none">
        {/* Header: drag handle + title + delete */}
        <div className="mb-1 flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-1">
            <SortableDragHandle />
            <h3 className="truncate text-lg font-semibold text-foreground">
              {displayLabel}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete Repository"
                aria-label={`Delete ${displayLabel}`}
                className="pointer-events-auto cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="mb-1 flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden whitespace-nowrap pl-6">
          {repository.is_enabled ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Enabled
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
              Disabled
            </span>
          )}
          <span className="inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {repository.visibility}
          </span>
          {repository.is_builtin && (
            <span
              className="inline-flex min-w-0 items-center truncate rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              title="系统内置：对全员可见，仅 admin 可编辑"
            >
              Built-In
            </span>
          )}
        </div>

        {/* Description */}
        <p
          className="mb-1 pl-6 pr-2 h-[60px] min-w-0 overflow-hidden leading-5 line-clamp-3 text-sm text-text-muted"
          title={repository.description || "No description"}
        >
          {repository.description || "No description"}
        </p>

        {/* Footer metadata：baseline branch + GitHub + 本地路径 */}
        <div className="mt-auto ml-6 flex min-w-0 flex-nowrap items-center gap-3 overflow-hidden whitespace-nowrap pt-1 text-xs text-text-muted">
          <span
            className="inline-flex min-w-0 items-center gap-1 truncate font-mono"
            title={repository.baseline_branch}
          >
            <GitBranch className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{repository.baseline_branch}</span>
          </span>
          <span
            className="inline-flex min-w-0 items-center gap-1 truncate"
            title={repository.github_url}
          >
            <Github className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{repository.github_url}</span>
          </span>
          <span
            className="inline-flex min-w-0 items-center gap-1 truncate font-mono"
            title={repository.local_path}
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span className="truncate">{repository.local_path}</span>
          </span>
        </div>
      </div>
    </SortableCardWrapper>
  );
}
