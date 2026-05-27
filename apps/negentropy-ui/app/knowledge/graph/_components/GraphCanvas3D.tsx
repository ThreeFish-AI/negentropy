"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import SpriteText from "three-spritetext";

import { fetchGraphSubgraph } from "@/features/knowledge";

import { entityColor, communityColor } from "./constants";
import { GraphCanvasFrame } from "./GraphCanvasFrame";
import { NodeTooltip } from "./NodeTooltip";

// ForceGraph3D 仅在客户端加载，避免 three.js SSR 问题。
// react-force-graph-3d 导出 ClassComponent，用 any 绕过 dynamic() 的 FC 约束。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph3D: any = dynamic(
  () => import("react-force-graph-3d").then((m) => m.default),
  { ssr: false },
);

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

interface GraphCanvas3DProps {
  corpusId: string;
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  asOf?: string | null;
  onSubgraphMerge?: (
    nodes: GraphCanvasNode[],
    edges: GraphCanvasEdge[],
  ) => void;
  truncateThreshold?: number;
}

function nodeRadius3D(importance?: number | null): number {
  if (importance == null) return 3;
  const clamped = Math.min(Math.max(importance, 0), 1);
  return 2 + 6 * clamped;
}

// react-force-graph-3d 的 nodeVal 被解释为"体积量"：实际渲染球体半径 = cbrt(val) * nodeRelSize。
// 将球体统一缩至默认 2/3（nodeRelSize 默认 4，现通过 props 覆盖），避免球体过大遮挡上方标签。
const NODE_REL_SIZE = 2.67;
// 球面与标签底边的世界单位间隙，保证最小节点也能清晰浮于球体之上。
const LABEL_GAP = 3;

function nodeColorFn(node: GraphCanvasNode): string {
  if (node.community_id != null) return communityColor(node.community_id);
  return entityColor(node.type);
}

export function GraphCanvas3D({
  corpusId,
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  asOf,
  onSubgraphMerge,
  truncateThreshold = 500,
}: GraphCanvas3DProps) {
  const fgRef = useRef(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [tooltip, setTooltip] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const propsRef = useRef({ corpusId, asOf, onNodeClick, onSubgraphMerge });
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    propsRef.current = { corpusId, asOf, onNodeClick, onSubgraphMerge };
  }, [corpusId, asOf, onNodeClick, onSubgraphMerge]);

  // react-force-graph-3d 默认使用 window.innerWidth/Height，导致 Flex 布局溢出。
  // 通过 ResizeObserver 追踪容器尺寸并传递显式 width/height 约束 Canvas。
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

  const validIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  // 预计算节点颜色和尺寸映射，避免 accessor 闭包中反复查找
  const nodeMeta = useMemo(() => {
    const map = new Map<string, { color: string; val: number }>();
    for (const n of nodes) {
      map.set(n.id, {
        color: nodeColorFn(n),
        val: nodeRadius3D(n.importance),
      });
    }
    return map;
  }, [nodes]);

  const graphData = useMemo(() => {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.label ?? n.id.slice(0, 8),
      })),
      links: edges
        .filter((e) => validIds.has(e.source) && validIds.has(e.target))
        .map((e) => ({
          source: e.source,
          target: e.target,
        })),
    };
  }, [nodes, edges, validIds]);

  const handleNodeClick = useCallback((node: { id: string | number }) => {
    propsRef.current.onNodeClick(String(node.id));
  }, []);

  const handleNodeHover = useCallback(
    (node: { id: string | number; x?: number; y?: number; z?: number } | null) => {
      if (!node || node.x == null || node.y == null || node.z == null) {
        setTooltip(null);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fg = fgRef.current as any;
      try {
        const screen = fg?.graph2ScreenCoords?.(node.x, node.y, node.z);
        if (screen) {
          setTooltip({ nodeId: String(node.id), x: screen.x, y: screen.y });
        }
      } catch {
        setTooltip(null);
      }
    },
    [],
  );

  const handleNodeRightClick = useCallback(async (node: { id: string | number }) => {
    const { corpusId: cid, asOf: ao } = propsRef.current;
    setExpanding(true);
    try {
      const data = await fetchGraphSubgraph(cid, {
        centerId: String(node.id),
        radius: 1,
        limit: 50,
        asOf: ao ?? undefined,
      });
      const latest = propsRef.current;
      if (latest.corpusId !== cid || latest.asOf !== ao) return;
      latest.onSubgraphMerge?.(data.nodes, data.edges);
    } catch (err) {
      console.error("3d_subgraph_fetch_error", err);
    } finally {
      setExpanding(false);
    }
  }, []);

  const getNodeColor = useCallback(
    (node: { id: string | number }) => {
      const meta = nodeMeta.get(String(node.id));
      if (!meta) return "#6B7280";
      return String(node.id) === selectedNodeId ? "#f59e0b" : meta.color;
    },
    [selectedNodeId, nodeMeta],
  );

  const getNodeVal = useCallback(
    (node: { id: string | number }) => {
      const meta = nodeMeta.get(String(node.id));
      if (!meta) return 3;
      return String(node.id) === selectedNodeId ? meta.val * 1.5 : meta.val;
    },
    [selectedNodeId, nodeMeta],
  );

  const bgColor = resolvedTheme === "dark" ? "#09090b" : "#ffffff";
  const isDark = resolvedTheme === "dark";
  const truncated = nodes.length >= truncateThreshold;

  // three-spritetext 为每个节点生成持久 3D 文字（不依赖 hover tooltip），
  // 与 2D/Sigma/Cytoscape 渲染器视觉对齐。参考 react-force-graph 官方
  // text-nodes 范式：nodeThreeObjectExtend=true 保留原始球体（含 selected
  // 高亮），sprite 在球体上方叠加。
  const getNodeThreeObject = useCallback(
    (node: { id: string | number; label?: string }) => {
      const text = node.label ?? String(node.id).slice(0, 8);
      const sprite = new SpriteText(text);
      // 纯文字风格：去边框 + 去背景，与 2D 引擎 ForceGraphCanvas 视觉对齐。
      sprite.color = isDark ? "#f4f4f5" : "#18181b";
      sprite.backgroundColor = "rgba(0,0,0,0)";
      sprite.padding = 0;
      sprite.textHeight = 3;
      sprite.borderWidth = 0;
      // 保留 dd1a6c85 引入的深度修复：标签穿透其他球体始终可见。
      sprite.material.depthWrite = false;
      sprite.renderOrder = 999;

      const val = nodeMeta.get(String(node.id))?.val ?? 3;
      const effectiveVal =
        String(node.id) === selectedNodeId ? val * 1.5 : val;
      // 球体实际半径 = cbrt(val) * nodeRelSize（val 是体积量，非半径）。
      // sprite 以中心为锚点，故位置 = 半径 + 半个文字高 + 视觉间隙。
      const radius = Math.cbrt(effectiveVal) * NODE_REL_SIZE;
      sprite.position.set(0, radius + sprite.textHeight / 2 + LABEL_GAP, 0);
      return sprite;
    },
    [isDark, nodeMeta, selectedNodeId],
  );

  return (
    <GraphCanvasFrame
      stats={{ nodes: nodes.length, edges: edges.length, suffix: "3D WebGL" }}
      badges={
        <>
          {truncated && (
            <span className="rounded bg-amber-500/90 px-2 py-1 text-white">
              已按 importance 截断（右键节点展开邻居）
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
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <ForceGraph3D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel="label"
            nodeColor={getNodeColor}
            nodeVal={getNodeVal}
            nodeRelSize={NODE_REL_SIZE}
            nodeOpacity={0.95}
            nodeThreeObject={getNodeThreeObject}
            nodeThreeObjectExtend={true}
            linkColor={() => "#a1a1aa"}
            linkOpacity={0.4}
            linkWidth={0.8}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            backgroundColor={bgColor}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onNodeRightClick={handleNodeRightClick}
            onBackgroundClick={() => propsRef.current.onNodeClick("")}
            cooldownTicks={150}
            warmupTicks={20}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.4}
            enableNodeDrag={true}
            showNavInfo={false}
          />
        )}
        {tooltip && (() => {
          const hoveredNode = nodes.find((n) => n.id === tooltip.nodeId);
          return hoveredNode ? <NodeTooltip node={hoveredNode} x={tooltip.x} y={tooltip.y} /> : null;
        })()}
      </div>
    </GraphCanvasFrame>
  );
}
