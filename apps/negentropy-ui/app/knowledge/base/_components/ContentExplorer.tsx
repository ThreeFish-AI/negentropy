"use client";

import { useState } from "react";
import { KnowledgeItem } from "@/features/knowledge";

interface ContentExplorerProps {
  items: KnowledgeItem[];
  loading?: boolean;
  error?: string | null;
  offset?: number;
}

export function ContentExplorer({ items, loading, error, offset = 0 }: ContentExplorerProps) {
  const [expandedState, setExpandedState] = useState<{
    id: string;
    contextToken: string;
  } | null>(null);

  const contextToken = `${offset}:${items.length}:${items[0]?.id ?? "empty"}`;

  const toggleRow = (id: string) => {
    setExpandedState((prev) => {
      if (prev?.id === id && prev.contextToken === contextToken) {
        return null;
      }
      return { id, contextToken };
    });
  };

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
                <th className="pb-2 font-medium w-12">#</th>
                <th className="pb-2 font-medium">Content Preview</th>
                <th className="pb-2 font-medium">Created At</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {items.map((item, index) => {
                const isExpanded =
                  expandedState?.id === item.id &&
                  expandedState.contextToken === contextToken;
                return (
                <tr
                  key={item.id}
                  className={`border-b border-border last:border-0 transition-colors ${
                    isExpanded ? "bg-muted/30" : "hover:bg-muted/50"
                  }`}
                >
                  <td className="whitespace-nowrap py-2 pr-2 text-muted/70">
                    {offset + index + 1}
                  </td>
                  <td className="max-w-[400px] py-2 pr-4 align-top">
                    <button
                      type="button"
                      data-testid={`content-toggle-${item.id}`}
                      aria-expanded={isExpanded}
                      aria-controls={`content-body-${item.id}`}
                      onClick={() => toggleRow(item.id)}
                      className="w-full rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border/70 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <div className="relative">
                        <div
                          id={`content-body-${item.id}`}
                          data-testid={`content-body-${item.id}`}
                          className={`text-xs leading-5 break-words transition-all duration-200 ease-out ${
                            isExpanded
                              ? "max-h-[1000rem] scale-100 opacity-100 whitespace-pre-wrap"
                              : "line-clamp-2 max-h-10 scale-[0.99] opacity-90"
                          }`}
                          title={isExpanded ? undefined : item.content}
                        >
                          {item.content}
                        </div>
                        {!isExpanded && (
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-card to-transparent"
                          />
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-muted/80">
                        {isExpanded ? "Collapse" : "Expand"}
                      </div>
                    </button>
                  </td>
                  <td className="whitespace-nowrap py-2 text-muted/70">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
