"use strict";

import { useEffect, useState } from "react";
import { fetchKnowledgeItems, KnowledgeItem } from "@/features/knowledge";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

interface ContentExplorerProps {
  corpusId: string;
  appName: string;
}

export function ContentExplorer({ corpusId, appName }: ContentExplorerProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    let mounted = true;

    const loadItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const offset = (page - 1) * pageSize;
        const data = await fetchKnowledgeItems(corpusId, {
          appName,
          limit: pageSize,
          offset,
        });
        if (mounted) {
          setItems(data.items);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadItems();

    return () => {
      mounted = false;
    };
  }, [corpusId, appName, page, pageSize]);

  // Handle page change
  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => p + 1);
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1); // Reset to first page when changing page size
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-card-foreground">
          Knowledge Content
        </h2>
        <div className="flex items-center gap-3">
          {/* Page size selector */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="page-size" className="text-xs text-muted">
              Rows
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-ring"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              disabled={page === 1 || loading}
              className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50 hover:bg-muted/50"
            >
              Previous
            </button>
            <span className="text-xs text-muted">Page {page}</span>
            <button
              onClick={handleNext}
              disabled={items.length < pageSize || loading}
              className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50 hover:bg-muted/50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {loading && items.length === 0 ? (
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
        <div className="mt-4 max-h-[calc(100vh-20rem)] overflow-y-auto overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-muted">
                <th className="pb-2 font-medium">Source</th>
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
                  <td
                    className="max-w-[150px] truncate py-2 pr-4 text-muted"
                    title={item.source_uri || ""}
                  >
                    {item.source_uri || "-"}
                  </td>
                  <td className="max-w-[300px] py-2 pr-4">
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
