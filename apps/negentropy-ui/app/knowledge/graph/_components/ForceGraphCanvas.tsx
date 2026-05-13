"use client";

/**
 * ForceGraphCanvas — react-force-graph-2d 渲染器
 *
 * 渲染技术：Canvas 2D + d3-force-3d 物理引擎
 * 视觉特色：有向粒子流动效果（linkDirectionalParticles）
 *
 * 交互：
 *   - 滚轮缩放 / 拖动画布
 *   - 单击节点 → onNodeClick 回调
 *   - 双击节点 → 通过 fetchGraphSubgraph 增量加载 1 跳邻居
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";

import { fetchGraphSubgraph } from "@/features/knowledge";

import { entityColor, communityColor } from "./constants";
import { GraphCanvasFrame } from "./GraphCanvasFrame";
import type { GraphCanvasNode, GraphCanvasEdge, GraphCanvasProps } from "./types";

function nodeSize(importance?: number | null): number {
  if (importance == null) return 6;
  const clamped = Math.min(Math.max(importance, 0), 1);
  return 4 + 8 * clamped;
}

function nodeColor(node: GraphCanvasNode): string {
  if (node.community_id != null) return communityColor(node.community_id);
  return entityColor(node.type);
}

interface FGNode {
  id: string;
  name: string;
  val: number;
  color: string;
  x?: number;
  y?: number;
  __importance?: number | null;
  __type?: string;
  __communityId?: number | null;
}

interface FGLink {
  source: string;
  target: string;
  label: string;
  color: string;
}

function toForceGraphData(
  nodes: GraphCanvasNode[],
  edges: GraphCanvasEdge[],
  selectedNodeId: string | null,
  isDark: boolean,
): { nodes: FGNode[]; links: FGLink[] } {
  const validIds = new Set(nodes.map((n) => n.id));
  const neighborSet = new Set<string>();
  if (selectedNodeId) {
    neighborSet.add(selectedNodeId);
    edges.forEach((e) => {
      if (e.source === selectedNodeId) neighborSet.add(e.target);
      if (e.target === selectedNodeId) neighborSet.add(e.source);
    });
  }

  const dimColor = isDark ? "#2a2a2e" : "#d4d4d8";
  const defaultEdgeColor = isDark ? "#52525b" : "#a1a1aa";
  const dimEdgeColor = isDark ? "#1e1e22" : "#e5e5e5";

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      name: n.label ?? n.id.slice(0, 8),
      val: nodeSize(n.importance),
      color:
        selectedNodeId && !neighborSet.has(n.id)
          ? dimColor
          : nodeColor(n),
      __importance: n.importance,
      __type: n.type,
      __communityId: n.community_id,
    })),
    links: edges
      .filter((e) => validIds.has(e.source) && validIds.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        label: e.type ?? "",
        color:
          selectedNodeId &&
          e.source !== selectedNodeId &&
          e.target !== selectedNodeId
            ? dimEdgeColor
            : defaultEdgeColor,
      })),
  };
}

export function ForceGraphCanvas({
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
  const graphRef = useRef<unknown>(null);
  const [expanding, setExpanding] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ForceGraph2D, setForceGraph2D] = useState<React.ComponentType<any> | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const propsRef = useRef({ corpusId, asOf, onNodeClick, onSubgraphMerge });
  useEffect(() => {
    propsRef.current = { corpusId, asOf, onNodeClick, onSubgraphMerge };
  }, [corpusId, asOf, onNodeClick, onSubgraphMerge]);

  // 动态导入 react-force-graph-2d（SSR 不兼容）
  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      setForceGraph2D(() => mod.default as React.ComponentType<unknown>);
    });
  }, []);

  // 容器尺寸监听
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => {
      setDimensions({
        width: el.clientWidth,
        height: Math.max(400, el.clientHeight),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 双击检测
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);

  const handleNodeClick = useCallback(
    (node: { id?: string | number }) => {
      const nodeId = String(node.id ?? "");
      const now = Date.now();
      const last = lastClickRef.current;

      if (last && last.id === nodeId && now - last.time < 350) {
        // 双击 → 增量加载子图
        lastClickRef.current = null;
        const tappedCorpus = propsRef.current.corpusId;
        const tappedAsOf = propsRef.current.asOf;
        setExpanding(true);
        fetchGraphSubgraph(tappedCorpus, {
          centerId: nodeId,
          radius: 1,
          limit: 50,
          asOf: tappedAsOf ?? undefined,
        })
          .then((data) => {
            const latest = propsRef.current;
            if (latest.corpusId !== tappedCorpus || latest.asOf !== tappedAsOf) return;
            latest.onSubgraphMerge?.(data.nodes, data.edges);
          })
          .catch((err) => console.error("fg_subgraph_fetch_error", err))
          .finally(() => setExpanding(false));
      } else {
        lastClickRef.current = { id: nodeId, time: now };
        propsRef.current.onNodeClick(nodeId);
      }
    },
    [],
  );

  const handleBackgroundClick = useCallback(() => {
    lastClickRef.current = null;
    propsRef.current.onNodeClick("");
  }, []);

  const graphData = useMemo(
    () => toForceGraphData(nodes, edges, selectedNodeId, isDark),
    [nodes, edges, selectedNodeId, isDark],
  );

  const truncated = nodes.length >= truncateThreshold;

  // 自定义节点渲染
  const nodeCanvasObject = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = nodeSize(node.__importance);
      const isSelected = selectedNodeId === node.id;

      // 绘制圆形
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, isSelected ? size + 3 : size, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.globalAlpha = isSelected ? 1 : 0.85;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 标签（始终显示，缩小时隐藏避免过于拥挤）
      if (globalScale > 0.3) {
        const fontSize = Math.max(12 / globalScale, 3.5);
        ctx.font = `${fontSize}px system-ui, sans-serif`;
        ctx.fillStyle = isDark ? "#d4d4d8" : "#27272a";
        ctx.textAlign = "center";
        ctx.fillText(node.name, node.x!, node.y! + size + fontSize + 1);
      }
    },
    [selectedNodeId, isDark],
  );

  // 节点点击区域
  const nodePointerAreaPaint = useCallback(
    (node: FGNode, paintColor: string, ctx: CanvasRenderingContext2D) => {
      const size = nodeSize(node.__importance);
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, size + 2, 0, 2 * Math.PI);
      ctx.fillStyle = paintColor;
      ctx.fill();
    },
    [],
  );

  return (
    <GraphCanvasFrame
      stats={{ nodes: nodes.length, edges: edges.length, suffix: "Force Canvas" }}
      badges={
        <>
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
        </>
      }
    >
      <div ref={containerRef} className="h-full w-full">
        {ForceGraph2D && dimensions.width > 0 && dimensions.height > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor={isDark ? "#18181b" : "#ffffff"}
            nodeLabel="name"
            nodeRelSize={4}
            nodeVal="val"
            nodeColor="color"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => "replace" as const}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkColor="color"
            linkWidth={1}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.8}
            linkDirectionalArrowColor={isDark ? "#71717a" : "#a1a1aa"}
            linkDirectionalParticles={selectedNodeId ? 2 : 1}
            linkDirectionalParticleSpeed={0.006}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor="#a78bfa"
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            enableNodeDrag={true}
            cooldownTicks={200}
            d3AlphaDecay={0.03}
          />
        )}
      </div>
    </GraphCanvasFrame>
  );
}
