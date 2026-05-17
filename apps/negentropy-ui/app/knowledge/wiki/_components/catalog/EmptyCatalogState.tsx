"use client";

import { FolderOpen } from "./icons";
import { FolderPlus } from "lucide-react";

interface EmptyCatalogStateProps {
  onAddRoot: () => void;
}

export function EmptyCatalogState({ onAddRoot }: EmptyCatalogStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border bg-card/50">
      <FolderOpen className="h-16 w-16 text-muted/20 mb-4" />
      <p className="text-sm font-medium text-muted mb-1">此目录为空</p>
      <p className="text-xs text-muted/50 mb-4">
        创建第一个节点以开始组织文档
      </p>
      <button
        onClick={onAddRoot}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <FolderPlus className="h-4 w-4" />
        创建根节点
      </button>
      <p className="text-[10px] text-muted/40 mt-3">
        右键节点可查看更多操作 · 拖拽节点可调整排序
      </p>
    </div>
  );
}
