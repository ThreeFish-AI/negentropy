"use client";

import { useAuth } from "@/components/providers/AuthProvider";

interface BuiltinTool {
  id: string;
  owner_id: string;
  visibility: string;
  name: string;
  display_name: string | null;
  description: string | null;
  tool_type: string;
  version: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  config_schema: Record<string, unknown>;
  is_enabled: boolean;
  is_system: boolean;
}

interface ToolCardProps {
  tool: BuiltinTool;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  toggling?: boolean;
}

const TOOL_TYPE_DISPLAY: Record<string, { label: string; className: string }> = {
  claude_code: {
    label: "Agent",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  search: {
    label: "Search",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  retrieval: {
    label: "Retrieval",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  custom: {
    label: "Custom",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
};

const DEFAULT_TOOL_TYPE_STYLE =
  "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400";

export function ToolCard({
  tool,
  onEdit,
  onDelete,
  onToggleEnabled,
  toggling = false,
}: ToolCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;
  // 系统内置工具仅 admin 可编辑（与 MCP / Skill / Agent 卡片语义对齐）。
  const canEdit = isAdmin || !tool.is_system;

  const displayLabel = tool.display_name || tool.name;

  const hasCredentials =
    tool.credentials &&
    typeof tool.credentials === "object" &&
    Object.keys(tool.credentials).length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-4">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex min-w-0 items-start justify-between gap-2">
          <h3 className="truncate text-lg font-semibold text-foreground">
            {displayLabel}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            {onToggleEnabled && (
              <button
                onClick={onToggleEnabled}
                disabled={toggling}
                title={tool.is_enabled ? "Disable tool" : "Enable tool"}
                aria-label={`${tool.is_enabled ? "Disable" : "Enable"} ${displayLabel}`}
                aria-pressed={tool.is_enabled}
                className={
                  "rounded-md p-2 disabled:opacity-50 " +
                  (tool.is_enabled
                    ? "text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300"
                    : "text-text-muted hover:bg-muted hover:text-text-secondary")
                }
              >
                {tool.is_enabled ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364a9 9 0 0 0-12.728 0M5.636 5.636a9 9 0 0 0 12.728 0m0 12.728L5.636 5.636m12.728 0L5.636 18.364" />
                  </svg>
                )}
              </button>
            )}
            {canEdit && (
              <button
                onClick={onEdit}
                title="Edit Tool"
                aria-label={`Edit ${displayLabel}`}
                className="rounded-md p-2 text-text-muted hover:bg-muted hover:text-text-secondary"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {!tool.is_system && (
              <button
                onClick={onDelete}
                title="Delete Tool"
                aria-label={`Delete ${displayLabel}`}
                className="rounded-md p-2 text-text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="mb-1 flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden whitespace-nowrap">
          {tool.is_enabled ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Enabled
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
              Disabled
            </span>
          )}
          {(() => {
            const display = TOOL_TYPE_DISPLAY[tool.tool_type];
            return (
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${display ? display.className : DEFAULT_TOOL_TYPE_STYLE}`}
              >
                {display ? display.label : tool.tool_type}
              </span>
            );
          })()}
          {tool.is_system && (
            <span
              className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              title="系统内置：对全员可见，仅 admin 可编辑"
            >
              Built-In
            </span>
          )}
          <span className="inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {tool.visibility}
          </span>
          {!hasCredentials && tool.is_enabled && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
              No credentials
            </span>
          )}
        </div>
        <p
          className="mb-1 h-20 min-w-0 w-full overflow-hidden break-words text-sm leading-5 text-text-muted line-clamp-4"
          title={tool.description || "No description"}
        >
          {tool.description || "No description"}
        </p>
        <div className="mt-auto flex min-w-0 flex-nowrap items-center gap-3 overflow-hidden whitespace-nowrap pt-1 text-xs text-text-muted">
          <span className="inline-flex shrink-0 items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            v{tool.version}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {tool.name}
          </span>
        </div>
      </div>
    </div>
  );
}
