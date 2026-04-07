"use client";

import { CatalogNode, CatalogNodeType } from "@/features/knowledge";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
} from "./icons";

const NODE_TYPE_ICONS: Record<CatalogNodeType, typeof Folder> = {
  category: Folder,
  collection: FolderOpen,
  document_ref: FileText,
};

const NODE_TYPE_COLORS: Record<CatalogNodeType, string> = {
  category: "text-amber-500",
  collection: "text-blue-500",
  document_ref: "text-zinc-400",
};

interface CatalogTreeNodeProps {
  node: CatalogNode;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  isSelected: boolean;
  onToggle: (nodeId: string) => void;
  onSelect: (node: CatalogNode) => void;
}

export function CatalogTreeNode({
  node,
  depth,
  isExpanded,
  hasChildren,
  isSelected,
  onToggle,
  onSelect,
}: CatalogTreeNodeProps) {
  const Icon = NODE_TYPE_ICONS[node.node_type] || Folder;
  const color = NODE_TYPE_COLORS[node.node_type] || "text-zinc-400";
  const padding = depth * 20;

  return (
    <button
      onClick={() => onSelect(node)}
      className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 rounded-md ${
        isSelected
          ? "bg-primary/10 text-primary ring-1 ring-primary/20"
          : "text-foreground"
      }`}
      style={{ paddingLeft: `${padding + 8}px` }}
    >
      {/* Expand toggle */}
      {hasChildren ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
          className="cursor-pointer"
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted" />
          )}
        </span>
      ) : (
        <span className="w-3.5" />
      )}

      {/* Icon */}
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />

      {/* Name */}
      <span className="truncate font-medium">{node.name}</span>

      {/* Type badge */}
      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted">
        {node.node_type}
      </span>
    </button>
  );
}
