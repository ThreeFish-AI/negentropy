"use client";

import { useRef, useEffect, useCallback } from "react";
import { CatalogNode, CatalogNodeType } from "@/features/knowledge";
import { MoreHorizontal } from "lucide-react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
} from "./icons";

/**
 * 节点类型 → 图标 / 颜色 / 徽标文案
 *
 * 历史值 `category` / `collection` 在 0010 起被后端归并为 `folder`，
 * 但旧 API 响应仍可能携带这些值；此处统一兜底为 folder 视觉。
 */
const NODE_TYPE_ICONS: Record<CatalogNodeType, typeof Folder> = {
  folder: Folder,
  document_ref: FileText,
  category: Folder, // legacy → folder
  collection: Folder, // legacy → folder
};

const NODE_TYPE_COLORS: Record<CatalogNodeType, string> = {
  folder: "text-amber-500",
  document_ref: "text-text-muted",
  category: "text-amber-500",
  collection: "text-amber-500",
};

const NODE_TYPE_LABELS: Record<CatalogNodeType, string> = {
  folder: "目录",
  document_ref: "文档",
  category: "目录",
  collection: "目录",
};

interface CatalogTreeNodeProps {
  node: CatalogNode;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  isSelected: boolean;
  isEditing: boolean;
  searchQuery: string;
  onToggle: (nodeId: string) => void;
  onSelect: (node: CatalogNode) => void;
  onAddChild?: (parentId: string) => void;
  onContextMenu: (node: CatalogNode | null, e: React.MouseEvent) => void;
  onRename: (nodeId: string, newName: string) => void;
  onCancelEdit: () => void;
  highlightMatch: (text: string) => React.ReactNode;
  /** Whether this node is currently being dragged */
  isDragging?: boolean;
  /** Current drop position relative to this node, null if not a target */
  dropTarget?: "before" | "inside" | "after" | null;
}

export function CatalogTreeNode({
  node,
  depth,
  isExpanded,
  hasChildren,
  isSelected,
  isEditing,
  onToggle,
  onSelect,
  onAddChild,
  onContextMenu,
  onRename,
  onCancelEdit,
  highlightMatch,
  dropTarget,
}: CatalogTreeNodeProps) {
  const Icon = NODE_TYPE_ICONS[node.node_type] || Folder;
  const color = NODE_TYPE_COLORS[node.node_type] || "text-text-muted";
  const padding = depth * 20;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRenameConfirm = useCallback(() => {
    const newName = inputRef.current?.value.trim();
    if (newName && newName !== node.name) {
      onRename(node.id, newName);
    } else {
      onCancelEdit();
    }
  }, [node.id, node.name, onRename, onCancelEdit]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleRenameConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancelEdit();
      }
    },
    [handleRenameConfirm, onCancelEdit],
  );

  return (
    <>
      {/* ---- Drop indicator: before ---- */}
      {dropTarget === "before" && (
        <div className="absolute top-0 left-3 right-0 h-[3px] z-10 flex items-center">
          <div className="absolute left-0 w-2 h-2 rounded-full bg-primary" />
          <div className="ml-1.5 flex-1 bg-primary rounded-full h-[3px]" />
        </div>
      )}

      {/* ---- Node content row ---- */}
      <div
        role="button"
        tabIndex={isEditing ? -1 : 0}
        onClick={() => !isEditing && onSelect(node)}
        onKeyDown={(e) => {
          if (isEditing) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(node);
          }
        }}
        onDoubleClick={() => {
          if (onAddChild) {
            onContextMenu(node, {
              clientX: 0,
              clientY: 0,
              preventDefault: () => {},
              stopPropagation: () => {},
            } as React.MouseEvent);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(node, e);
        }}
        className={`group flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 cursor-pointer ${
          isSelected
            ? "bg-primary/10 text-primary ring-1 ring-primary/20"
            : "text-foreground"
        } ${dropTarget === "inside" ? "bg-primary/5 ring-1 ring-primary/10" : ""}`}
        style={{ paddingLeft: `${padding + 8}px` }}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="cursor-pointer shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Icon */}
        <Icon className={`h-4 w-4 shrink-0 ${color}`} />

        {/* Name (or inline edit input) */}
        {isEditing ? (
          <input
            ref={inputRef}
            defaultValue={node.name}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameConfirm}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none ring-1 ring-primary/30 rounded px-1 py-0"
          />
        ) : (
          <span className="truncate font-medium flex-1 min-w-0">
            {highlightMatch(node.name)}
          </span>
        )}

        {/* Type badge */}
        {!isEditing && (
          <span className="ml-auto text-micro px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground shrink-0">
            {NODE_TYPE_LABELS[node.node_type] ?? "目录"}
          </span>
        )}

        {/* More button */}
        {!isEditing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(node, e);
            }}
            aria-label={`操作「${node.name}」`}
            title="更多操作"
            className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded-sm p-0.5 hover:bg-primary/10 text-muted-foreground hover:text-primary"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ---- Drop indicator: after ---- */}
      {dropTarget === "after" && (
        <div className="absolute bottom-0 left-3 right-0 h-[3px] z-10 flex items-center">
          <div className="absolute left-0 w-2 h-2 rounded-full bg-primary" />
          <div className="ml-1.5 flex-1 bg-primary rounded-full h-[3px]" />
        </div>
      )}
    </>
  );
}
