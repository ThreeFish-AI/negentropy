"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoreBlockItem } from "@/features/memory";

/**
 * 单个 Core Block 卡片 —— 借鉴 FactCard 的标签徽章 + 元信息脚注布局。
 * 永久块（λ=0.0，always-injected）；展示 label / scope / version / token_count / content。
 */

const SCOPE_STYLES: Record<string, string> = {
  user: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  app: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  thread: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

const CONTENT_PREVIEW = 220;

interface CoreBlockCardProps {
  block: CoreBlockItem;
  onEdit: (block: CoreBlockItem) => void;
  onDelete: (block: CoreBlockItem) => void;
  deleting?: boolean;
}

export function CoreBlockCard({
  block,
  onEdit,
  onDelete,
  deleting,
}: CoreBlockCardProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = block.content.length > CONTENT_PREVIEW;
  const scopeStyle = SCOPE_STYLES[block.scope] ?? "bg-muted text-text-secondary";

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">
            {block.label}
          </p>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-micro font-medium",
              scopeStyle,
            )}
          >
            {block.scope}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(block)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label="Edit core block"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(block)}
            disabled={deleting}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-rose-400"
            aria-label="Delete core block"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
          {canExpand && !expanded
            ? [...block.content].slice(0, CONTENT_PREVIEW).join("") + "…"
            : block.content}
        </p>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="mt-1.5 inline-flex items-center gap-1 text-micro font-semibold text-text-muted hover:text-text-secondary"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                收起
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                展开全文
              </>
            )}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-caption text-text-muted">
        <span className="tabular-nums">v{block.version}</span>
        <span className="tabular-nums">{block.token_count} tokens</span>
        {block.thread_id && (
          <span className="font-mono text-micro">thread {block.thread_id.slice(0, 8)}…</span>
        )}
        {block.updated_by && <span>by {block.updated_by}</span>}
      </div>
    </article>
  );
}
