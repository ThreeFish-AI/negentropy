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
      className="pointer-events-none absolute z-20 -ml-2 -mt-2 -translate-x-full -translate-y-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: entityColor(node.type) }}
        />
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {node.label || node.id.slice(0, 12)}
        </span>
      </div>
      <div className="mt-1 space-y-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
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
