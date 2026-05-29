"use client";

/**
 * WikiCytoscapeCanvas — Cytoscape.js + fCoSE 布局渲染器（Wiki 只读视图）
 *
 * 与主站 `apps/negentropy-ui/.../GraphCanvas.tsx` 的关系：
 *   - 复用 toElements / nodeSize / fCoSE 布局参数；
 *   - 剥离主站特有的"双击增量子图 / hover tooltip / 选中淡化"逻辑；
 *   - 节点单击 → 跳转到该实体首个相关 entry（router.push）。
 *
 * 设计参考：Dogrusoz et al. (2009) fCoSE: Fast Compound Spring Embedder。
 * cytoscape / cytoscape-fcose 通过动态 import 懒加载，按需 code-split。
 */

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Core, ElementDefinition, LayoutOptions } from "cytoscape";

import type { WikiGraphEdge, WikiGraphNode } from "@/lib/wiki-graph-types";
import { detectDark, nodeColor } from "@/lib/wiki-graph-visual";

// nodeSize 系数随渲染器而异（Cytoscape 节点宽高量纲偏大），保留本地定义。
function nodeSize(importance: number | null | undefined): number {
  if (importance == null) return 18;
  const clamped = Math.min(Math.max(importance, 0), 1);
  return 14 + 22 * clamped;
}

function toElements(
  nodes: WikiGraphNode[],
  edges: WikiGraphEdge[],
): ElementDefinition[] {
  const validIds = new Set(nodes.map((n) => n.id));
  return [
    ...nodes.map((n) => ({
      group: "nodes" as const,
      data: {
        id: n.id,
        label: n.label ?? n.id.slice(0, 8),
        size: nodeSize(n.importance),
        color: nodeColor(n),
        type: n.type ?? "",
      },
    })),
    ...edges
      .filter((e) => validIds.has(e.source) && validIds.has(e.target))
      .map((e, i) => ({
        group: "edges" as const,
        data: {
          id: `${e.source}__${e.target}__${i}`,
          source: e.source,
          target: e.target,
          label: e.type ?? "",
        },
      })),
  ];
}

const FCOSE_LAYOUT = {
  name: "fcose",
  quality: "default",
  animate: true,
  animationDuration: 600,
  randomize: true,
  nodeRepulsion: () => 1500,
  idealEdgeLength: () => 40,
  edgeElasticity: () => 0.8,
  gravity: 0.6,
  gravityRange: 2.5,
  nodeSeparation: 30,
} as unknown as LayoutOptions;

interface WikiCytoscapeCanvasProps {
  pubSlug: string;
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
  truncated?: boolean;
  totalEntities?: number;
}

export function WikiCytoscapeCanvas({
  pubSlug,
  nodes,
  edges,
  truncated = false,
  totalEntities,
}: WikiCytoscapeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const router = useRouter();

  // 节点 id → entry_slugs 映射，供点击跳转兜底反查
  const entrySlugMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of nodes) m.set(n.id, n.entry_slugs ?? []);
    return m;
  }, [nodes]);

  const elements = useMemo(() => toElements(nodes, edges), [nodes, edges]);

  useEffect(() => {
    if (!containerRef.current) return;
    let killed = false;

    const init = async () => {
      const cytoscape = (await import("cytoscape")).default;
      const fcose = (await import("cytoscape-fcose")).default;
      // 重复 register 会被 cytoscape 内部 no-op 处理
      cytoscape.use(fcose);

      if (killed || !containerRef.current) return;

      const isDark = detectDark();
      const labelColor = isDark ? "#e3e3e3" : "#27272a";
      const outlineColor = isDark ? "#18181b" : "#ffffff";
      const edgeColor = isDark ? "rgba(255,255,255,0.18)" : "#a1a1aa";

      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: "node",
            style: {
              "background-color": "data(color)",
              label: "data(label)",
              "font-size": 10,
              color: labelColor,
              "text-valign": "center",
              "text-halign": "center",
              width: "data(size)",
              height: "data(size)",
              "border-width": 1,
              "border-color": outlineColor,
              "text-outline-width": 2,
              "text-outline-color": outlineColor,
            },
          },
          {
            selector: "edge",
            style: {
              width: 1.5,
              "line-color": edgeColor,
              "target-arrow-color": edgeColor,
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              opacity: 0.8,
            },
          },
        ],
        layout: FCOSE_LAYOUT,
        wheelSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 4,
      });
      cyRef.current = cy;

      // 单击节点 → 跳转到首个相关 entry；无 entry 时不跳转
      cy.on("tap", "node", (evt) => {
        const id = (evt.target as { id: () => string }).id();
        const slugs = entrySlugMap.get(id) ?? [];
        if (slugs.length > 0) {
          router.push(`/${pubSlug}/${slugs[0]}`);
        }
      });

      const ro = new ResizeObserver(() => cy.resize());
      ro.observe(containerRef.current);

      return () => ro.disconnect();
    };

    let disposeRo: (() => void) | undefined;
    void init().then((d) => {
      disposeRo = d;
    });

    return () => {
      killed = true;
      disposeRo?.();
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [elements, entrySlugMap, pubSlug, router]);

  return (
    <div className="wiki-graph-canvas-root">
      <div ref={containerRef} className="wiki-graph-canvas-stage" />

      <div className="wiki-graph-canvas-overlay">
        <span className="wiki-graph-badge">
          {nodes.length} 节点 · {edges.length} 边 · Cytoscape
        </span>
        {truncated && totalEntities != null && (
          <span className="wiki-graph-badge wiki-graph-badge-warn">
            已按 importance 截断（共 {totalEntities} 个实体，仅显示 top-
            {nodes.length}）
          </span>
        )}
      </div>
    </div>
  );
}

export default WikiCytoscapeCanvas;
