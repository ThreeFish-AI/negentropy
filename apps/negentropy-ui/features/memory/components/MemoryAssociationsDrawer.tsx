/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useEffect, useState } from "react";
import { BaseDrawer } from "@/components/ui/BaseDrawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Link2 } from "lucide-react";
import { fetchMemoryAssociations, type MemoryAssociation } from "../utils/memory-api";
import { AssociationRow } from "./AssociationRow";

/**
 * 记忆关联抽屉 —— 由 Timeline 卡片触发，展示某条记忆的关联邻居（per-memory）。
 * 关联是 per-memory 粒度，故以抽屉而非独立标签承载（符合 API 数据粒度）。
 * v1 只读：列表 + weight；不做 create/delete（避免对共享关联图的破坏性操作）。
 */

interface MemoryAssociationsDrawerProps {
  open: boolean;
  /** 目标记忆 ID；为空时抽屉空转。 */
  memoryId: string | null;
  /** 抽屉副标题（通常为记忆内容摘要）。 */
  memorySnippet?: string;
  onClose: () => void;
}

export function MemoryAssociationsDrawer({
  open,
  memoryId,
  memorySnippet,
  onClose,
}: MemoryAssociationsDrawerProps) {
  const [items, setItems] = useState<MemoryAssociation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !memoryId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);
    fetchMemoryAssociations(memoryId, { direction: "both", limit: 50 })
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, memoryId]);

  return (
    <BaseDrawer
      open={open}
      onClose={onClose}
      title="Associations"
      subtitle={memorySnippet}
      side="right"
      widthClassName="w-[420px]"
    >
      <div className="space-y-3 px-5 py-4">
        {loading ? (
          <p className="text-xs text-muted-foreground">
            <Spinner size="sm" className="mr-1.5 inline-block align-text-bottom" />
            Loading associations...
          </p>
        ) : error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            size="sm"
            icon={Link2}
            title="无关联"
            description="该记忆尚未与其他记忆/事实建立关联。"
          />
        ) : (
          <>
            <p className="text-micro text-muted-foreground">
              {items.length} association(s)
            </p>
            {items.map((assoc) => (
              <AssociationRow key={assoc.id} assoc={assoc} />
            ))}
          </>
        )}
      </div>
    </BaseDrawer>
  );
}
