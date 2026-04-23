"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteWikiPublication,
  fetchWikiNavTree,
  publishWiki,
  syncWikiEntriesFromCatalog,
  unpublishWiki,
  WikiNavTreeItem,
  WikiPublication,
} from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";
import { WikiStatusBadge } from "./WikiStatusBadge";
import { WikiEntriesList } from "./WikiEntriesList";
import { CatalogNodeSelectorDialog } from "./CatalogNodeSelectorDialog";

interface WikiPublicationDetailProps {
  publication: WikiPublication | null;
  onChanged: () => void;
  onDeleted: () => void;
}

type SyncMode = "sync-only" | "sync-and-publish";

export function WikiPublicationDetail({
  publication,
  onChanged,
  onDeleted,
}: WikiPublicationDetailProps) {
  const [navTree, setNavTree] = useState<WikiNavTreeItem[]>([]);
  const [navLoading, setNavLoading] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorMode, setSelectorMode] = useState<SyncMode>("sync-only");
  const [submitting, setSubmitting] = useState(false);

  const pubId = publication?.id;

  const loadNavTree = useCallback(async () => {
    if (!pubId) return;
    setNavLoading(true);
    try {
      const resp = await fetchWikiNavTree(pubId);
      setNavTree(resp.nav_tree);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导航树加载失败");
    } finally {
      setNavLoading(false);
    }
  }, [pubId]);

  useEffect(() => {
    if (pubId) {
      loadNavTree();
    } else {
      setNavTree([]);
    }
  }, [pubId, loadNavTree]);

  const handlePublish = useCallback(async () => {
    if (!pubId) return;
    setSubmitting(true);
    try {
      const resp = await publishWiki(pubId);
      toast.success(`发布成功：v${resp.version}，${resp.entries_count} 个条目`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发布失败");
    } finally {
      setSubmitting(false);
    }
  }, [pubId, onChanged]);

  const handleUnpublish = useCallback(async () => {
    if (!pubId) return;
    if (!confirm("确定取消发布吗？站点将回退为草稿状态。")) return;
    setSubmitting(true);
    try {
      await unpublishWiki(pubId);
      toast.success("已取消发布");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "取消发布失败");
    } finally {
      setSubmitting(false);
    }
  }, [pubId, onChanged]);

  const handleDelete = useCallback(async () => {
    if (!publication) return;
    if (
      !confirm(
        `确定删除发布「${publication.name}」吗？所有条目与历史版本将一并删除。`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await deleteWikiPublication(publication.id);
      toast.success("已删除");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setSubmitting(false);
    }
  }, [publication, onDeleted]);

  const handleSyncConfirm = useCallback(
    async (catalogNodeIds: string[]) => {
      if (!pubId) return;
      setSubmitting(true);
      try {
        const resp = await syncWikiEntriesFromCatalog(pubId, {
          catalog_node_ids: catalogNodeIds,
        });
        const parts = [
          `同步成功：新增/保留 ${resp.synced_count} 条`,
          resp.removed_count > 0 ? `移除 ${resp.removed_count} 条` : null,
          resp.errors.length > 0 ? `${resp.errors.length} 条告警` : null,
        ].filter(Boolean);
        toast.success(parts.join(" · "));
        if (resp.errors.length > 0) {
          console.warn("[wiki sync] errors:", resp.errors);
        }
        setSelectorOpen(false);
        await loadNavTree();
        if (selectorMode === "sync-and-publish") {
          const pubResp = await publishWiki(pubId);
          toast.success(`发布成功：v${pubResp.version}`);
        }
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "同步失败");
      } finally {
        setSubmitting(false);
      }
    },
    [pubId, selectorMode, loadNavTree, onChanged],
  );

  if (!publication) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-muted">请选择或新建一个 Wiki 发布</p>
      </div>
    );
  }

  const isPublished = publication.status === "published";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold truncate">
                {publication.name}
              </h2>
              <WikiStatusBadge status={publication.status} />
            </div>
            <p className="text-xs text-muted font-mono">
              /{publication.slug} · v{publication.version} ·{" "}
              {publication.entries_count} 个条目
            </p>
            {publication.description && (
              <p className="mt-2 text-sm text-muted">
                {publication.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSelectorMode("sync-only");
              setSelectorOpen(true);
            }}
            disabled={submitting}
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50"
          >
            从 Catalog 同步
          </button>
          <button
            onClick={() => {
              setSelectorMode("sync-and-publish");
              setSelectorOpen(true);
            }}
            disabled={submitting}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            同步并发布
          </button>
          {isPublished ? (
            <button
              onClick={handleUnpublish}
              disabled={submitting}
              className="px-3 py-1.5 text-sm rounded-md border border-border text-muted hover:bg-muted disabled:opacity-50"
            >
              取消发布
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={submitting}
              className="px-3 py-1.5 text-sm rounded-md border border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 disabled:opacity-50"
            >
              仅发布
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={submitting}
            className="ml-auto px-3 py-1.5 text-sm rounded-md border border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            删除
          </button>
        </div>

        <p className="mt-3 text-[11px] text-muted">
          💡 发布后 SSG 站点通过 ISR（5 分钟窗口）异步拉取，非即时可见；
          已提取的 Markdown 才会同步为条目。
        </p>
      </div>

      {/* Entries */}
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">导航结构</h3>
          <button
            onClick={loadNavTree}
            disabled={navLoading}
            className="text-xs text-muted hover:text-foreground disabled:opacity-50"
          >
            刷新
          </button>
        </div>
        <WikiEntriesList navTree={navTree} loading={navLoading} />
      </div>

      <CatalogNodeSelectorDialog
        open={selectorOpen}
        corpusId={publication.catalog_id}
        onClose={() => setSelectorOpen(false)}
        onConfirm={handleSyncConfirm}
        submitting={submitting}
        confirmLabel={
          selectorMode === "sync-and-publish" ? "同步并发布" : "确认同步"
        }
        title={
          selectorMode === "sync-and-publish"
            ? "选择同步源后直接发布"
            : "选择要同步的 Catalog 节点"
        }
      />
    </div>
  );
}
