/* eslint-disable react-hooks/set-state-in-effect --
 * 切换发布对象时复位 Pipeline 状态属于「同步外部信号到本地 state」的一次性事件，
 * 不会触发 cascading render 性能问题，是合理的 useEffect 用例。新版 React Compiler
 * 规则集（eslint-plugin-react-hooks v7+）严格度提升后此处会被误报，与项目内
 * CatalogNodeSelectorDialog / CreateWikiPublicationDialog 等保持一致的处理方式。
 * TODO(react-compiler): 后续与同模块文件一起按 useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteWikiPublication,
  publishWiki,
  syncWikiEntriesFromCatalog,
  unpublishWiki,
  type WikiPublication,
  type WikiRevalidationStatus,
} from "@/features/knowledge";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { toast } from "@/lib/activity-toast";
import { WikiStatusBadge } from "./WikiStatusBadge";
import { CatalogNodeSelectorDialog } from "./CatalogNodeSelectorDialog";
import { CreateWikiPublicationDialog } from "./CreateWikiPublicationDialog";
import { WikiPublishPipeline } from "./WikiPublishPipeline";

type SyncMode = "sync-only" | "sync-and-publish";

interface WikiPublishToolbarProps {
  catalogId: string;
  publications: WikiPublication[];
  selectedPub: WikiPublication | null;
  selectedId: string | null;
  publicationsLoading: boolean;
  onSelectPublication: (id: string) => void;
  onPublicationsChanged: () => void;
  onPublicationCreated: (pub: WikiPublication) => void;
  onPublicationDeleted: () => void;
  /** 同步条目成功后通知外部预览面板刷新导航树 */
  onAfterSync?: () => void;
}

export function WikiPublishToolbar({
  catalogId,
  publications,
  selectedPub,
  selectedId,
  publicationsLoading,
  onSelectPublication,
  onPublicationsChanged,
  onPublicationCreated,
  onPublicationDeleted,
  onAfterSync,
}: WikiPublishToolbarProps) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorMode, setSelectorMode] = useState<SyncMode>("sync-only");
  const [submitting, setSubmitting] = useState(false);
  const [pipelineActive, setPipelineActive] = useState(false);
  const [pipelineRevalidation, setPipelineRevalidation] =
    useState<WikiRevalidationStatus | null>(null);
  const [pipelineTargetVersion, setPipelineTargetVersion] = useState<number | null>(null);

  const pubId = selectedPub?.id ?? null;
  const isPublished = selectedPub?.status === "published";
  const hasPublications = publications.length > 0;
  const actionsDisabled = submitting || !pubId;

  // 切换发布对象时清空残留的 Pipeline 状态，避免上次发布的回执遗留到新对象。
  useEffect(() => {
    setPipelineActive(false);
    setPipelineRevalidation(null);
    setPipelineTargetVersion(null);
  }, [pubId]);

  const handlePublish = useCallback(async () => {
    if (!pubId) return;
    setSubmitting(true);
    setPipelineActive(true);
    try {
      const resp = await publishWiki(pubId);
      setPipelineRevalidation(resp.revalidation ?? null);
      setPipelineTargetVersion(resp.version);
      toast.success(`发布成功：v${resp.version}，${resp.entries_count} 个条目`);
      onPublicationsChanged();
    } catch (err) {
      setPipelineActive(false);
      toast.error(err instanceof Error ? err.message : "发布失败");
    } finally {
      setSubmitting(false);
    }
  }, [pubId, onPublicationsChanged]);

  const handleUnpublish = useCallback(async () => {
    if (!pubId) return;
    const confirmed = await confirm({
      title: "取消发布 Wiki 站点",
      message:
        "确定取消发布该 Wiki 站点吗？发布版本会回退为草稿，访客将无法继续访问。",
      confirmLabel: "确认取消发布",
      destructive: true,
    });
    if (!confirmed) return;
    setSubmitting(true);
    setPipelineActive(true);
    try {
      const resp = await unpublishWiki(pubId);
      setPipelineRevalidation(resp.revalidation ?? null);
      setPipelineTargetVersion(resp.version);
      toast.success("已取消发布");
      onPublicationsChanged();
    } catch (err) {
      setPipelineActive(false);
      toast.error(err instanceof Error ? err.message : "取消发布失败");
    } finally {
      setSubmitting(false);
    }
  }, [pubId, confirm, onPublicationsChanged]);

  const handleDelete = useCallback(async () => {
    if (!selectedPub) return;
    const confirmed = await confirm({
      title: "删除 Wiki 发布",
      message: `确定删除发布「${selectedPub.name}」吗？所有条目与历史版本将一并删除。`,
      confirmLabel: "删除",
      destructive: true,
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await deleteWikiPublication(selectedPub.id);
      toast.success("已删除");
      onPublicationDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setSubmitting(false);
    }
  }, [selectedPub, confirm, onPublicationDeleted]);

  const handleSyncConfirm = useCallback(
    async (catalogNodeIds: string[]) => {
      if (!pubId) return;
      setSubmitting(true);
      setPipelineActive(false);
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
        onAfterSync?.();
        if (selectorMode === "sync-and-publish") {
          setPipelineActive(true);
          const pubResp = await publishWiki(pubId);
          setPipelineRevalidation(pubResp.revalidation ?? null);
          setPipelineTargetVersion(pubResp.version);
          toast.success(`发布成功：v${pubResp.version}`);
        }
        onPublicationsChanged();
      } catch (err) {
        setPipelineActive(false);
        const msg = selectorMode === "sync-and-publish" ? "操作失败" : "同步失败";
        toast.error(err instanceof Error ? err.message : msg);
      } finally {
        setSubmitting(false);
      }
    },
    [pubId, selectorMode, onAfterSync, onPublicationsChanged],
  );

  return (
    <div className="border-b border-border bg-card/60 backdrop-blur-sm px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        {/* Publication 选择器 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-muted shrink-0">
            Wiki 发布
          </span>
          <select
            aria-label="选择 Wiki 发布对象"
            value={selectedId ?? ""}
            onChange={(e) => onSelectPublication(e.target.value)}
            disabled={publicationsLoading || !hasPublications}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 max-w-[260px]"
          >
            {publicationsLoading && <option value="">加载中…</option>}
            {!publicationsLoading && !hasPublications && (
              <option value="">暂无发布</option>
            )}
            {!publicationsLoading && hasPublications && !selectedId && (
              <option value="">— 请选择 —</option>
            )}
            {publications.map((pub) => (
              <option key={pub.id} value={pub.id}>
                {pub.name} (/{pub.slug})
              </option>
            ))}
          </select>
          <button
            onClick={() => setCreateOpen(true)}
            disabled={!catalogId || submitting}
            className="px-2.5 py-1 text-xs rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50"
            title="新建一个 Wiki 发布对象"
          >
            + 新建
          </button>
        </div>

        {/* 状态徽章与元信息 */}
        {selectedPub && (
          <div className="flex items-center gap-2 text-xs text-muted min-w-0">
            <WikiStatusBadge status={selectedPub.status} />
            <span className="font-mono shrink-0">
              v{selectedPub.version} · {selectedPub.entries_count} 个条目
            </span>
            {selectedPub.description && (
              <span
                className="truncate max-w-[280px] text-muted/80"
                title={selectedPub.description}
              >
                · {selectedPub.description}
              </span>
            )}
          </div>
        )}

        {/* 操作按钮组 */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectorMode("sync-only");
              setSelectorOpen(true);
            }}
            disabled={actionsDisabled}
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50"
          >
            从 Catalog 同步
          </button>
          <button
            onClick={() => {
              setSelectorMode("sync-and-publish");
              setSelectorOpen(true);
            }}
            disabled={actionsDisabled}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            同步并发布
          </button>
          {isPublished ? (
            <button
              onClick={handleUnpublish}
              disabled={actionsDisabled}
              className="px-3 py-1.5 text-sm rounded-md border border-border text-muted hover:bg-muted disabled:opacity-50"
            >
              取消发布
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={actionsDisabled}
              className="px-3 py-1.5 text-sm rounded-md border border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 disabled:opacity-50"
            >
              仅发布
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={actionsDisabled}
            className="px-3 py-1.5 text-sm rounded-md border border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            title="删除当前选中的发布"
          >
            删除
          </button>
        </div>
      </div>

      {/* Pipeline 状态条 */}
      {pipelineActive && pipelineRevalidation !== null && selectedPub && (
        <WikiPublishPipeline
          revalidation={pipelineRevalidation}
          targetVersion={pipelineTargetVersion ?? undefined}
          pubSlug={selectedPub.slug}
        />
      )}

      <CreateWikiPublicationDialog
        open={createOpen}
        catalogId={catalogId}
        onClose={() => setCreateOpen(false)}
        onCreated={onPublicationCreated}
      />
      {selectedPub && (
        <CatalogNodeSelectorDialog
          open={selectorOpen}
          corpusId={selectedPub.catalog_id}
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
      )}
      {confirmDialog}
    </div>
  );
}
