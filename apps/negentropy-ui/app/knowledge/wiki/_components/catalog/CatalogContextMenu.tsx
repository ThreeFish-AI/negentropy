"use client";

import { useEffect, useRef, useCallback } from "react";
import { Plus, Pencil, Copy, Trash2, FolderPlus, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { CatalogNode } from "@/features/knowledge";

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface CatalogContextMenuProps {
  x: number;
  y: number;
  node: CatalogNode | null;
  onClose: () => void;
  onAddChild: (parentId: string) => void;
  onAddRoot: () => void;
  onRename: (nodeId: string) => void;
  onCopyId: (nodeId: string) => void;
  onDelete: (node: CatalogNode) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function CatalogContextMenu({
  x,
  y,
  node,
  onClose,
  onAddChild,
  onAddRoot,
  onRename,
  onCopyId,
  onDelete,
  onExpandAll,
  onCollapseAll,
}: CatalogContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position to stay within viewport
  const adjustedPos = useCallback(() => {
    if (!menuRef.current) return { x, y };
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: x + rect.width > vw ? Math.max(0, vw - rect.width - 8) : x,
      y: y + rect.height > vh ? Math.max(0, vh - rect.height - 8) : y,
    };
  }, [x, y]);

  useEffect(() => {
    const pos = adjustedPos();
    if (menuRef.current) {
      menuRef.current.style.left = `${pos.x}px`;
      menuRef.current.style.top = `${pos.y}px`;
    }
  }, [adjustedPos]);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const nodeItems: MenuItem[] = node
    ? [
        {
          label: "添加子节点",
          icon: <Plus className="h-3.5 w-3.5" />,
          onClick: () => {
            onAddChild(node.id);
            onClose();
          },
        },
        {
          label: "重命名",
          icon: <Pencil className="h-3.5 w-3.5" />,
          onClick: () => {
            onRename(node.id);
            onClose();
          },
        },
        {
          label: "复制 ID",
          icon: <Copy className="h-3.5 w-3.5" />,
          onClick: () => {
            onCopyId(node.id);
            onClose();
          },
        },
        {
          label: "删除节点",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          onClick: () => {
            onDelete(node);
            onClose();
          },
          danger: true,
        },
      ]
    : [
        {
          label: "添加根节点",
          icon: <FolderPlus className="h-3.5 w-3.5" />,
          onClick: () => {
            onAddRoot();
            onClose();
          },
        },
        {
          label: "全部展开",
          icon: <ChevronsUpDown className="h-3.5 w-3.5" />,
          onClick: () => {
            onExpandAll();
            onClose();
          },
        },
        {
          label: "全部折叠",
          icon: <ChevronsDownUp className="h-3.5 w-3.5" />,
          onClick: () => {
            onCollapseAll();
            onClose();
          },
        },
      ];

  // Separate danger items
  const normalItems = nodeItems.filter((i) => !i.danger);
  const dangerItems = nodeItems.filter((i) => i.danger);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-xl border border-border bg-popover p-1 shadow-lg ring-1 ring-black/5"
      style={{ left: x, top: y }}
    >
      {normalItems.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          disabled={item.disabled}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {item.icon && <span className="text-muted">{item.icon}</span>}
          {item.label}
        </button>
      ))}
      {dangerItems.length > 0 && (
        <>
          <div className="my-1 h-px bg-border" />
          {dangerItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              {item.icon && <span>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
