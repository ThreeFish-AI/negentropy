"use client";

import { CatalogNode } from "@/features/knowledge";

interface CatalogBreadcrumbProps {
  nodes: CatalogNode[];
  currentNode: CatalogNode | null;
  onNavigate: (nodeId: string) => void;
}

export function CatalogBreadcrumb({
  nodes,
  currentNode,
  onNavigate,
}: CatalogBreadcrumbProps) {
  if (!currentNode) return null;

  // Build breadcrumb path from depth-sorted nodes
  const pathMap = new Map(nodes.map((n) => [n.id, n]));
  const breadcrumbs: CatalogNode[] = [];
  let current: CatalogNode | null = currentNode;

  while (current) {
    breadcrumbs.unshift(current);
    if (current.parent_id) {
      current = pathMap.get(current.parent_id) ?? null;
    } else {
      break;
    }
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-muted">
      {breadcrumbs.map((node, idx) => (
        <span key={node.id} className="flex items-center gap-1">
          {idx > 0 && <span className="text-border">/</span>}
          <button
            onClick={() => onNavigate(node.id)}
            className="hover:text-foreground transition-colors font-medium"
          >
            {node.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
