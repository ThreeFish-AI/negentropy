"use client";

/**
 * SigmaGraphCanvas — Sigma.js v3 + graphology WebGL 渲染器
 *
 * 渲染技术：WebGL（GPU 加速），比 Cytoscape Canvas 快 10-100x
 * 布局算法：ForceAtlas2（graphology-layout-forceatlas2）
 *
 * 交互：
 *   - 滚轮缩放 / 拖动画布
 *   - 单击节点 → onNodeClick 回调（高亮 + 父组件展示详情）
 *   - 双击节点 → 通过 fetchGraphSubgraph 增量加载 1 跳邻居并入图
 */

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

import { fetchGraphSubgraph } from "@/features/knowledge";

import { entityColor, communityColor } from "./constants";
import type { GraphCanvasNode, GraphCanvasEdge, GraphCanvasProps } from "./types";

function nodeSize(importance?: number | null): number {
  if (importance == null) return 10;
  const clamped = Math.min(Math.max(importance, 0), 1);
  return 6 + 14 * clamped;
}

function nodeColor(node: GraphCanvasNode): string {
  if (node.community_id != null) return communityColor(node.community_id);
  return entityColor(node.type);
}

function buildGraph(
  nodes: GraphCanvasNode[],
  edges: GraphCanvasEdge[],
): InstanceType<typeof import("graphology").default> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Graph = require("graphology") as typeof import("graphology").default;
  const g = new Graph({ multi: false, type: "directed" });
  for (const n of nodes) {
    g.addNode(n.id, {
      label: n.label ?? n.id.slice(0, 8),
      x: Math.random() * 500,
      y: Math.random() * 500,
      size: nodeSize(n.importance),
      color: nodeColor(n),
    });
  }
  const validIds = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (validIds.has(e.source) && validIds.has(e.target)) {
      try {
        g.addEdge(e.source, e.target, { label: e.type ?? "" });
      } catch {
        // graphology 不允许重复边，忽略
      }
    }
  }
  return g;
}

export function SigmaGraphCanvas({
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
  const sigmaRef = useRef<InstanceType<typeof import("sigma").default> | null>(null);
  const graphRef = useRef<ReturnType<typeof buildGraph> | null>(null);
  const [expanding, setExpanding] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const propsRef = useRef({ corpusId, asOf, onNodeClick, onSubgraphMerge });
  useEffect(() => {
    propsRef.current = { corpusId, asOf, onNodeClick, onSubgraphMerge };
  }, [corpusId, asOf, onNodeClick, onSubgraphMerge]);

  // 1. 初始化 Sigma 实例（仅一次）
  useEffect(() => {
    if (!containerRef.current) return;
    let killed = false;

    const init = async () => {
      const Sigma = (await import("sigma")).default;
      const forceAtlas2 = (await import("graphology-layout-forceatlas2"))
        .default as typeof import("graphology-layout-forceatlas2").default;

      if (killed || !containerRef.current) return;

      const graph = buildGraph(nodes, edges);
      graphRef.current = graph;

      // ForceAtlas2 初始布局
      if (graph.order > 0) {
        forceAtlas2.assign(graph, {
          iterations: 50,
          settings: {
            outboundAttractionDistribution: true,
            adjustSizes: true,
            gravity: 1,
          },
        });
      }

      const sigma = new Sigma(graph, containerRef.current, {
        renderLabels: true,
        renderEdgeLabels: false,
        labelFont: "system-ui, sans-serif",
        labelSize: 12,
        labelWeight: "500",
        labelColor: { color: isDark ? "#d4d4d8" : "#27272a" },
        defaultEdgeColor: isDark ? "#52525b" : "#d4d4d8",
        defaultNodeColor: "#6B7280",
        minCameraRatio: 0.1,
        maxCameraRatio: 10,
        stagePadding: 20,
      });
      sigmaRef.current = sigma;

      // 单击节点
      sigma.on("clickNode", ({ node }) => {
        propsRef.current.onNodeClick(node);
      });

      // 双击节点 → 增量加载子图
      sigma.on("doubleClickNode", async ({ node: centerId }) => {
        const tappedCorpus = propsRef.current.corpusId;
        const tappedAsOf = propsRef.current.asOf;
        setExpanding(true);
        try {
          const data = await fetchGraphSubgraph(tappedCorpus, {
            centerId,
            radius: 1,
            limit: 50,
            asOf: tappedAsOf ?? undefined,
          });
          const latest = propsRef.current;
          if (latest.corpusId !== tappedCorpus || latest.asOf !== tappedAsOf) {
            return;
          }
          if (latest.onSubgraphMerge) {
            latest.onSubgraphMerge(data.nodes, data.edges);
          }
        } catch (err) {
          console.error("sigma_subgraph_fetch_error", err);
        } finally {
          setExpanding(false);
        }
      });

      // 点击空白 → 取消选中
      sigma.on("clickStage", () => {
        propsRef.current.onNodeClick("");
      });

      // 容器尺寸变化
      const ro = new ResizeObserver(() => {
        sigma.refresh();
      });
      ro.observe(containerRef.current);

      // cleanup 在外层处理
      return () => {
        ro.disconnect();
      };
    };

    init();

    return () => {
      killed = true;
      sigmaRef.current?.kill();
      sigmaRef.current = null;
      graphRef.current = null;
    };
    // 仅挂载/卸载时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. 数据变更时同步到 graphology（不重新创建 Sigma 实例）
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    // 清空并重建
    graph.clear();
    for (const n of nodes) {
      graph.addNode(n.id, {
        label: n.label ?? n.id.slice(0, 8),
        x: Math.random() * 500,
        y: Math.random() * 500,
        size: nodeSize(n.importance),
        color: nodeColor(n),
      });
    }
    const validIds = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      if (validIds.has(e.source) && validIds.has(e.target)) {
        try {
          graph.addEdge(e.source, e.target, { label: e.type ?? "" });
        } catch {
          // 重复边忽略
        }
      }
    }

    // 重新布局（少量迭代保持响应性）
    if (graph.order > 0) {
      import("graphology-layout-forceatlas2").then(({ default: fa2 }) => {
        fa2.assign(graph, {
          iterations: 30,
          settings: {
            outboundAttractionDistribution: true,
            adjustSizes: true,
            gravity: 1,
          },
        });
      });
    }

    sigmaRef.current?.refresh();
  }, [nodes, edges]);

  // 3. 选中态高亮：将非选中节点淡化
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    if (!selectedNodeId) {
      // 恢复所有节点原始颜色
      graph.forEachNode((node, attrs) => {
        const original = nodeColor({
          id: node,
          type: (attrs as Record<string, unknown>).__origType as string | undefined,
          community_id: (attrs as Record<string, unknown>).__origCommunity as number | null | undefined,
        });
        graph.setNodeAttribute(node, "color", original);
        graph.setNodeAttribute(node, "highlighted", false);
      });
    } else {
      const neighbors = new Set(graph.neighbors(selectedNodeId));
      neighbors.add(selectedNodeId);

      graph.forEachNode((node) => {
        if (neighbors.has(node)) {
          const n = nodes.find((nd) => nd.id === node);
          graph.setNodeAttribute(node, "color", n ? nodeColor(n) : "#6B7280");
          graph.setNodeAttribute(
            node,
            "highlighted",
            node === selectedNodeId,
          );
        } else {
          graph.setNodeAttribute(node, "color", isDark ? "#2a2a2e" : "#d4d4d8");
          graph.setNodeAttribute(node, "highlighted", false);
        }
      });
    }

    sigmaRef.current?.refresh();
  }, [selectedNodeId, nodes, isDark]);

  // 保存原始类型/社区信息到节点属性，用于选中态恢复颜色
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.forEachNode((node) => {
      const n = nodes.find((nd) => nd.id === node);
      if (n) {
        graph.setNodeAttribute(node, "__origType", n.type);
        graph.setNodeAttribute(node, "__origCommunity", n.community_id);
      }
    });
  }, [nodes]);

  const truncated = nodes.length >= truncateThreshold;

  return (
    <div className="relative min-h-0 flex-1 w-full rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1 text-[10px]">
        <span className="rounded bg-zinc-900/70 px-2 py-1 text-white">
          {nodes.length} 节点 · {edges.length} 边 · WebGL
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
