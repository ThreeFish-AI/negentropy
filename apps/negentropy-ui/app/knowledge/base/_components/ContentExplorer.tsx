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
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          Knowledge Content
        </h2>
        <div className="flex items-center gap-3">
          {/* Page size selector */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="page-size" className="text-xs text-zinc-400">
              Rows
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-700 outline-none focus:border-zinc-400"
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
              className="rounded border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-zinc-500">Page {page}</span>
            <button
              onClick={handleNext}
              disabled={items.length < pageSize || loading}
              className="rounded border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="mt-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-zinc-100" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 rounded bg-rose-50 p-3 text-xs text-rose-600">
          {error}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500">No items found.</p>
      ) : (
        <div className="mt-4 max-h-[500px] overflow-y-auto overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-zinc-100 text-zinc-500">
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Content Preview</th>
                <th className="pb-2 font-medium">Created At</th>
              </tr>
            </thead>
            <tbody className="text-zinc-700">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50"
                >
                  <td
                    className="max-w-[150px] truncate py-2 pr-4 text-zinc-500"
                    title={item.source_uri || ""}
                  >
                    {item.source_uri || "-"}
                  </td>
                  <td className="max-w-[300px] py-2 pr-4">
                    <p className="line-clamp-2" title={item.content}>
                      {item.content}
                    </p>
                  </td>
                  <td className="whitespace-nowrap py-2 text-zinc-400">
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
