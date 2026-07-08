"use client";

import { TextTooltip } from "@/components/ui/TextTooltip";
import { KnowledgeItem } from "@/features/knowledge";

interface ContentExplorerProps {
  items: KnowledgeItem[];
  loading?: boolean;
  error?: string | null;
  offset?: number;
}

export function ContentExplorer({ items, loading, error, offset = 0 }: ContentExplorerProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card p-5">
      <h2 className="shrink-0 text-sm font-semibold text-card-foreground">
        Knowledge Content
      </h2>

      {loading ? (
        <div className="mt-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-muted/50" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 rounded bg-error/10 p-3 text-xs text-error">
          {error}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No items found.</p>
      ) : (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
          <table className="w-full table-fixed text-sm">
            {/* 固定列宽（合计 100%）：# 10 · Content Preview 65 · Created At 25。
                3 列须与下方 3 个 <th> 严格对齐；colgroup 内不得夹带空白文本节点。 */}
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[65%]" />
              <col className="w-[25%]" />
            </colgroup>
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs uppercase tracking-overline text-text-secondary">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Content Preview</th>
                <th className="px-4 py-2.5 font-medium">Created At</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={item.id}
                  className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3 tabular-nums text-text-secondary">
                    {offset + index + 1}
                  </td>
                  <td className="px-4 py-3">
                    {/* 单行截断 + 悬浮全文（对齐 Routine/Scheduler 表格规范）。 */}
                    <TextTooltip content={item.content}>
                      <span className="block truncate text-foreground">{item.content}</span>
                    </TextTooltip>
                  </td>
                  <td className="px-4 py-3">
                    <TextTooltip content={new Date(item.created_at).toLocaleString()}>
                      <span className="block truncate text-text-secondary">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </TextTooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
