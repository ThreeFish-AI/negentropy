/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import {
  MemorySidebarLayout,
  MemoryUserPillFilter,
  RetryableErrorBanner,
  SidebarCard,
  fetchMemories,
  useCoreBlocks,
  type CoreBlockItem,
} from "@/features/memory";
import { CoreBlockCard } from "./_components/CoreBlockCard";
import {
  CoreBlockEditorDrawer,
  type CoreBlockDraft,
} from "./_components/CoreBlockEditorDrawer";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

export default function MemoryCoreBlocksPage() {
  const [users, setUsers] = useState<Array<{ id: string; label: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const { payload, isLoading, error, reload, upsert, remove } = useCoreBlocks({
    appName: APP_NAME,
    userId: activeUserId,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CoreBlockItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  // 用户列表（与 conflicts 页一致，复用 timeline 的 users 聚合）
  useEffect(() => {
    setUsersLoading(true);
    fetchMemories(APP_NAME)
      .then((data) => {
        setUsers(data.users || []);
        // 默认选中首个用户，避免空 user_id 触发后端边界
        if (data.users?.length && !activeUserId) {
          setActiveUserId(data.users[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setUsersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocks = useMemo(() => payload?.items || [], [payload?.items]);

  const openCreate = () => {
    setEditing(null);
    setSaveError(null);
    setDrawerOpen(true);
  };

  const openEdit = (block: CoreBlockItem) => {
    setEditing(block);
    setSaveError(null);
    setDrawerOpen(true);
  };

  const handleSave = async (draft: CoreBlockDraft) => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await upsert(draft);
      setDrawerOpen(false);
      if (result.truncated) {
        // 后端按 token 预算截断时给出非阻断提示
        setSaveError(null);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (block: CoreBlockItem) => {
    const ok = await confirm({
      title: "删除 Core Block",
      message: `确认删除 ${block.scope} 作用域下的「${block.label}」？此操作不可撤销。`,
      confirmLabel: "删除",
      destructive: true,
    });
    if (!ok) return;
    const key = `${block.scope}:${block.label}:${block.thread_id ?? ""}`;
    setDeletingKey(key);
    try {
      await remove({
        scope: block.scope,
        label: block.label,
        thread_id: block.thread_id ?? undefined,
      });
    } catch (err) {
      console.error("delete core block failed", err);
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <MemoryNav title="Core Memory" description="常驻身份记忆块" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
          <RetryableErrorBanner error={error} onRetry={reload} />

          <MemorySidebarLayout
            sidebar={
              <SidebarCard title="About Core Blocks">
                <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
                  Core Block 是常驻的身份记忆（persona / human），衰减率 λ=0.0 —— 永不遗忘，
                  并在每次检索时按 thread → app → user 优先级注入上下文（always-injected）。
                </p>
                <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
                  超出 token 预算的内容将由后端自动截断。
                </p>
              </SidebarCard>
            }
          >
            {/* Controls */}
            <div className="mb-4 flex items-center gap-3">
              <MemoryUserPillFilter
                users={users}
                activeUserId={activeUserId}
                onSelect={setActiveUserId}
                loading={usersLoading}
                allLabel="—"
              />
              <div className="flex-1" />
              <Button
                variant="primary"
                size="sm"
                onClick={openCreate}
                disabled={!activeUserId}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                New Block
              </Button>
            </div>

            {!activeUserId ? (
              <EmptyState size="sm" title="请选择一个用户以查看其 Core Blocks" />
            ) : isLoading ? (
              <p className="text-xs text-muted-foreground">
                <Spinner size="sm" className="mr-1.5 inline-block align-text-bottom" />
                Loading core blocks...
              </p>
            ) : blocks.length === 0 ? (
              <EmptyState
                size="sm"
                title="该用户暂无 Core Block"
                description="点击右上角 New Block 创建第一个常驻记忆块。"
              />
            ) : (
              <div className="space-y-3">
                {blocks.map((block) => {
                  const key = `${block.scope}:${block.label}:${block.thread_id ?? ""}`;
                  return (
                    <CoreBlockCard
                      key={block.id}
                      block={block}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      deleting={deletingKey === key}
                    />
                  );
                })}
              </div>
            )}
          </MemorySidebarLayout>
        </div>
      </div>

      <CoreBlockEditorDrawer
        open={drawerOpen}
        editing={editing}
        saving={saving}
        error={saveError}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
      />
      {confirmDialog}
    </div>
  );
}
