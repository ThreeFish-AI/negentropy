"use client";

/**
 * GraphCanvas — Phase 4 G2 Cytoscape.js 交互可视化
 *
 * 设计参考：
 *   - Fruchterman & Reingold (1991) Force-Directed Layout
 *   - Dogrusoz et al. (2009) fCoSE: Fast Compound Spring Embedder
 *   - Neo4j Bloom Canvas / yFiles for HTML hover-to-expand 范式
 *
 * 性能基准：fCoSE 默认参数下 100-500 节点初始布局耗时 < 2s（Chrome），
 * 5000+ 节点时建议服务端先按 importance 截断为 limit=500。
 *
 * 交互：
 *   - 滚轮缩放 / 拖动画布
 *   - 单击节点 → onNodeClick 回调（高亮 + 父组件展示详情）
 *   - 双击节点 → 通过 fetchGraphSubgraph 增量加载 1 跳邻居并入图
 */

import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import type { Core, ElementDefinition, NodeSingular } from "cytoscape";
import fcose from "cytoscape-fcose";

import { fetchGraphSubgraph } from "@/features/knowledge";

import { entityColor, communityColor } from "./constants";

// fCoSE 注册一次即可（重复 register 会被 cytoscape 内部 no-op 处理）
let _registered = false;
if (!_registered) {
  cytoscape.use(fcose);
  _registered = true;
}

interface GraphCanvasNode {
  id: string;
  label?: string;
  type?: string;
  importance?: number | null;
  community_id?: number | null;
}

interface GraphCanvasEdge {
  source: string;
  target: string;
  type?: string;
}

interface GraphCanvasProps {
  corpusId: string;
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  asOf?: string | null;
  /** 父组件可选回调：双击展开子图后通知父组件合并节点 */
  onSubgraphMerge?: (
    nodes: GraphCanvasNode[],
    edges: GraphCanvasEdge[],
  ) => void;
  /** 节点上限提示阈值；超过时显示截断提示 */
  truncateThreshold?: number;
}

function nodeSize(importance?: number | null): number {
  if (importance == null) return 22;
  const clamped = Math.min(Math.max(importance, 0), 1);
  return 18 + 28 * clamped;
}

function nodeColor(node: GraphCanvasNode): string {
  if (node.community_id != null) return communityColor(node.community_id);
  return entityColor(node.type);
}

function toElements(
  nodes: GraphCanvasNode[],
  edges: GraphCanvasEdge[],
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

export function GraphCanvas({
  corpusId,
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  asOf,
  onSubgraphMerge,
  truncateThreshold = 500,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [expanding, setExpanding] = useState(false);

  const elements = useMemo(() => toElements(nodes, edges), [nodes, edges]);

  // 1. 初始化 cytoscape 实例（仅一次）
  useEffect(() => {
    if (!containerRef.current) return;
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
            color: "#27272a",
            "text-valign": "center",
            "text-halign": "center",
            width: "data(size)",
            height: "data(size)",
            "border-width": 1,
            "border-color": "#ffffff",
            "text-outline-width": 2,
            "text-outline-color": "#ffffff",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#f59e0b",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#a1a1aa",
            "target-arrow-color": "#a1a1aa",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.7,
          },
        },
        {
          selector: ".faded",
          style: { opacity: 0.15 },
        },
      ],
      layout: {
        name: "fcose",
        // fCoSE 推荐参数（Dogrusoz et al., 2009）
        quality: "default",
        animate: true,
        animationDuration: 600,
        randomize: true,
        nodeRepulsion: () => 5000,
        idealEdgeLength: () => 80,
        edgeElasticity: () => 0.45,
        gravity: 0.25,
      } as cytoscape.LayoutOptions,
      wheelSensitivity: 0.2,
      minZoom: 0.1,
      maxZoom: 4,
    });
    cyRef.current = cy;

    // 单击节点 → 高亮 + 回调
    cy.on("tap", "node", (evt) => {
      const node = evt.target as NodeSingular;
      onNodeClick(node.id());
    });

    // 双击节点 → 增量加载子图
    cy.on("dbltap", "node", async (evt) => {
      const node = evt.target as NodeSingular;
      const centerId = node.id();
      setExpanding(true);
      try {
        const data = await fetchGraphSubgraph(corpusId, {
          centerId,
          radius: 1,
          limit: 50,
          asOf: asOf ?? undefined,
        });
        if (onSubgraphMerge) {
          onSubgraphMerge(data.nodes, data.edges);
        }
      } catch (err) {
        console.error("subgraph_fetch_error", err);
      } finally {
        setExpanding(false);
      }
    });

    // 画布单击空白 → 取消高亮
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        onNodeClick("");
      }
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // 仅在挂载/卸载时初始化；后续 elements 变更通过 effect-2 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. 节点/边数据变更时同步到 cytoscape（不重新创建实例）
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
    });
    cy.layout({
      name: "fcose",
      animate: true,
      animationDuration: 400,
      randomize: false,
      quality: "default",
    } as cytoscape.LayoutOptions).run();
  }, [elements]);

  // 3. 选中态高亮：将非选中节点淡化
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("faded");
    if (selectedNodeId) {
      const sel = cy.getElementById(selectedNodeId);
      if (sel.length > 0) {
        const neighborhood = sel.closedNeighborhood();
        cy.elements().not(neighborhood).addClass("faded");
      }
    }
  }, [selectedNodeId]);

  const truncated = nodes.length >= truncateThreshold;

  return (
    <div className="relative h-[600px] w-full rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1 text-[10px]">
        <span className="rounded bg-zinc-900/70 px-2 py-1 text-white">
          {nodes.length} 节点 · {edges.length} 边
        </span>
        {truncated && (
          <span className="rounded bg-amber-500/90 px-2 py-1 text-white">
            已按 importance 截断（双击节点展开邻居）
          </span>
        )}
        {expanding && (
          <span className="rounded bg-emerald-500/90 px-2 py-1 text-white">
            加载子图…
          </span>
        )}
      </div>
    </div>
  );
}
