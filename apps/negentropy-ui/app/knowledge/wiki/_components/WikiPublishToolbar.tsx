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
  type WikiPublishTarget,
} from "@/features/knowledge";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { toast } from "@/lib/activity-toast";
import { cn } from "@/lib/utils";
import { WikiStatusBadge } from "./WikiStatusBadge";
import { CatalogNodeSelectorDialog } from "./CatalogNodeSelectorDialog";
import { CreateWikiPublicationDialog } from "./CreateWikiPublicationDialog";
import { WikiPublishPipeline } from "./WikiPublishPipeline";

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
  // 发布目标：测试环境（本地 wiki :3092）/ 生产环境（threefish-ai.github.io master）。
  // 默认测试环境（安全侧）：生产发布经 handleSyncConfirm 内 destructive 二次确认。
  const [publishTarget, setPublishTarget] = useState<WikiPublishTarget>("local");
  const [submitting, setSubmitting] = useState(false);
  const [pipelineActive, setPipelineActive] = useState(false);
  // 发布后状态条：以「操作 + 目标 + 版本」驱动精确文案，不再消费 ISR 语义的 revalidation。
  const [pipelineAction, setPipelineAction] = useState<"publish" | "unpublish" | null>(null);
  const [pipelineTarget, setPipelineTarget] = useState<WikiPublishTarget>("local");
  const [pipelineTargetVersion, setPipelineTargetVersion] = useState<number | null>(null);

  const pubId = selectedPub?.id ?? null;
  const isPublished = selectedPub?.status === "published";
  const hasPublications = publications.length > 0;
  const actionsDisabled = submitting || !pubId;

  // 切换发布对象时清空残留的 Pipeline 状态，避免上次发布的回执遗留到新对象。
  useEffect(() => {
    setPipelineActive(false);
    setPipelineAction(null);
    setPipelineTargetVersion(null);
  }, [pubId]);

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
      setPipelineAction("unpublish");
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
      // 先关闭节点选择器，避免与后续确认对话框堆叠。
      setSelectorOpen(false);
      // 生产环境为不可逆推送（直接更新 threefish-ai.github.io 生产站点），二次确认。
      if (publishTarget === "production") {
        const confirmed = await confirm({
          title: "发布到生产环境",
          message:
            "将推送至 threefish-ai.github.io 的 master 分支，直接更新 https://threefish-ai.github.io/ 生产站点，操作不可逆。确认继续？",
          confirmLabel: "确认发布到生产",
          destructive: true,
        });
        if (!confirmed) return;
      }
      const targetLabel = publishTarget === "production" ? "生产环境" : "测试环境";
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
        onAfterSync?.();
        // 同步完成随即发布到所选目标（重建/推送由后端 fire-and-forget spawn 承担）。
        setPipelineActive(true);
        const pubResp = await publishWiki(pubId, publishTarget);
        setPipelineAction("publish");
        setPipelineTarget(publishTarget);
        setPipelineTargetVersion(pubResp.version);
        const sitePart = pubResp.site_url ? `，站点 ${pubResp.site_url}` : "";
        toast.success(`发布成功：v${pubResp.version}（${targetLabel}${sitePart}）`);
        onPublicationsChanged();
      } catch (err) {
        setPipelineActive(false);
        toast.error(err instanceof Error ? err.message : "发布失败");
      } finally {
        setSubmitting(false);
      }
    },
    [pubId, publishTarget, confirm, onAfterSync, onPublicationsChanged],
  );

  return (
    <div className="border-b border-border bg-card/60 backdrop-blur-sm px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        {/* Publication 选择器 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-muted-foreground shrink-0">
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            <WikiStatusBadge status={selectedPub.status} />
            <span className="font-mono shrink-0">
              v{selectedPub.version} · {selectedPub.entries_count} 个条目
            </span>
            {selectedPub.description && (
              <span
                className="truncate max-w-[280px] text-muted-foreground/80"
                title={selectedPub.description}
              >
                · {selectedPub.description}
              </span>
            )}
          </div>
        )}

        {/* 操作按钮组 */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* 发布目标：测试环境（本地 :3092）/ 生产环境（threefish-ai.github.io） */}
          <div
            role="group"
            aria-label="选择发布目标"
            className="flex items-center rounded-md border border-border overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setPublishTarget("local")}
              disabled={actionsDisabled}
              title="发布到本地 negentropy-wiki 测试站点（:3092）"
              aria-pressed={publishTarget === "local"}
              className={cn(
                "px-2.5 py-1.5 text-xs disabled:opacity-50",
                publishTarget === "local"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              测试环境
            </button>
            <button
              type="button"
              onClick={() => setPublishTarget("production")}
              disabled={actionsDisabled}
              title="发布到 threefish-ai.github.io master（生产站点）"
              aria-pressed={publishTarget === "production"}
              className={cn(
                "px-2.5 py-1.5 text-xs border-l border-border disabled:opacity-50",
                publishTarget === "production"
                  ? "bg-amber-600 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              生产环境
            </button>
          </div>
          <button
            onClick={() => setSelectorOpen(true)}
            disabled={actionsDisabled}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            发布
          </button>
          {isPublished && (
            <button
              onClick={handleUnpublish}
              disabled={actionsDisabled}
              className="px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              取消发布
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
      {pipelineActive && pipelineAction !== null && (
        <WikiPublishPipeline
          action={pipelineAction}
          target={pipelineAction === "publish" ? pipelineTarget : undefined}
          version={pipelineTargetVersion ?? undefined}
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
          confirmLabel="发布"
          title="选择同步源后发布"
        />
      )}
      {confirmDialog}
    </div>
  );
}
