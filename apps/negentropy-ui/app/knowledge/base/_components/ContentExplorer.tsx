"use strict";

import { useEffect, useState } from "react";
import { fetchKnowledgeItems, KnowledgeItem } from "@/features/knowledge";

interface ContentExplorerProps {
  corpusId: string;
}

export function ContentExplorer({ corpusId }: ContentExplorerProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    let mounted = true;

    const loadItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const offset = (page - 1) * pageSize;
        const data = await fetchKnowledgeItems(corpusId, {
          limit: pageSize,
          offset,
        });
        if (mounted) {
          setItems(data.items);
          setTotal(data.count); // Note: count from backend is for the page, we might need total count for proper pagination but current API returns page count?
          // Actually backend returns "count": len(knowledge_items), which is just page count.
          // To implement proper pagination we would need a total count endpoint or modify list_knowledge to return total.
          // For now, we'll just show "Next" if we got a full page.
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
  }, [corpusId, page]);

  // Handle page change
  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => p + 1);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          Knowledge Content
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            disabled={page === 1 || loading}
            className="rounded border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs self-center">Page {page}</span>
          <button
            onClick={handleNext}
            disabled={items.length < pageSize || loading}
            className="rounded border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
          >
            Next
          </button>
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
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
