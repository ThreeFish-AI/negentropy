"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import {
  fetchWikiNavTree,
  type WikiNavTreeItem,
  type WikiPublication,
} from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";
import { WikiEntriesList } from "./WikiEntriesList";

interface WikiEntriesPreviewProps {
  publication: WikiPublication | null;
}

export interface WikiEntriesPreviewHandle {
  /** 由父组件在「发布」（同步）成功后调用，刷新导航树。 */
  refresh: () => void;
}

export const WikiEntriesPreview = forwardRef<
  WikiEntriesPreviewHandle,
  WikiEntriesPreviewProps
>(function WikiEntriesPreview({ publication }, ref) {
  const [navTree, setNavTree] = useState<WikiNavTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const pubId = publication?.id ?? null;

  const loadNavTree = useCallback(async () => {
    if (!pubId) {
      setNavTree([]);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetchWikiNavTree(pubId);
      setNavTree(resp.nav_tree?.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导航树加载失败");
    } finally {
      setLoading(false);
    }
  }, [pubId]);

  useEffect(() => {
    if (pubId && open) {
      loadNavTree();
    } else if (!pubId) {
      setNavTree([]);
    }
  }, [pubId, open, loadNavTree]);

  useImperativeHandle(
    ref,
    () => ({
      refresh: () => {
        if (pubId && open) {
          void loadNavTree();
        }
      },
    }),
    [pubId, open, loadNavTree],
  );

  if (!publication) return null;

  const entryCount = publication.entries_count;

  return (
    <div className="border-t border-border bg-card/40">
      <div className="flex items-center justify-between px-5 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
          aria-expanded={open}
          aria-controls="wiki-entries-preview-body"
        >
          <span className="text-xs text-muted-foreground">{open ? "▾" : "▸"}</span>
          <span className="font-medium">该发布包含 {entryCount} 个条目</span>
          <span className="text-xs text-muted-foreground">（展开查看导航结构）</span>
        </button>
        {open && (
          <button
            type="button"
            onClick={() => void loadNavTree()}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            刷新
          </button>
        )}
      </div>
      {open && (
        <div id="wiki-entries-preview-body" className="px-5 pb-4">
          <WikiEntriesList navTree={navTree} loading={loading} />
        </div>
      )}
    </div>
  );
});
