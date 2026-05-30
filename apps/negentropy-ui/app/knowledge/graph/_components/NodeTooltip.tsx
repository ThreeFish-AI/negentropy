"use client";

import type { GraphCanvasNode } from "./types";
import { entityColor } from "./constants";

interface NodeTooltipProps {
  node: GraphCanvasNode;
  x: number;
  y: number;
}

export function NodeTooltip({ node, x, y }: NodeTooltipProps) {
  return (
    <div
      className="pointer-events-none absolute z-20 -ml-2 -mt-2 -translate-x-full -translate-y-full rounded-lg border border-border bg-card px-3 py-2 text-caption shadow-lg"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: entityColor(node.type) }}
        />
        <span className="font-medium text-foreground">
          {node.label || node.id.slice(0, 12)}
        </span>
      </div>
      <div className="mt-1 space-y-0.5 text-micro text-text-muted">
        <div className="flex gap-2">
          <span>ID</span>
          <span className="font-mono">{node.id.slice(0, 16)}…</span>
        </div>
        {node.type && (
          <div className="flex gap-2">
            <span>类型</span>
            <span>{node.type}</span>
          </div>
        )}
      </div>
    </div>
  );
}
