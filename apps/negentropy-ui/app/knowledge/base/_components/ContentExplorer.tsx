"use strict";

import { KnowledgeItem } from "@/features/knowledge";

interface ContentExplorerProps {
  items: KnowledgeItem[];
  loading?: boolean;
  error?: string | null;
}

export function ContentExplorer({ items, loading, error }: ContentExplorerProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
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
        <p className="mt-4 text-xs text-muted">No items found.</p>
      ) : (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-muted">
                <th className="pb-2 font-medium">Content Preview</th>
                <th className="pb-2 font-medium">Created At</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-muted/50"
                >
                  <td className="max-w-[400px] py-2 pr-4">
                    <p className="line-clamp-2" title={item.content}>
                      {item.content}
                    </p>
                  </td>
                  <td className="whitespace-nowrap py-2 text-muted/70">
                    {new Date(item.created_at).toLocaleString()}
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
