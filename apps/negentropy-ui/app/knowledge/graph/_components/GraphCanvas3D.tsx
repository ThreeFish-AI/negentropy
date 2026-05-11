"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

import { fetchGraphSubgraph } from "@/features/knowledge";

import { entityColor, communityColor } from "./constants";

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
  const [expanding, setExpanding] = useState(false);
  const propsRef = useRef({ corpusId, asOf, onNodeClick, onSubgraphMerge });
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    propsRef.current = { corpusId, asOf, onNodeClick, onSubgraphMerge };
  }, [corpusId, asOf, onNodeClick, onSubgraphMerge]);

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
  const truncated = nodes.length >= truncateThreshold;

  return (
    <div className="relative min-h-0 flex-1 w-full rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeLabel="label"
        nodeColor={getNodeColor}
        nodeVal={getNodeVal}
        nodeOpacity={0.95}
        linkColor={() => "#a1a1aa"}
        linkOpacity={0.4}
        linkWidth={0.8}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        backgroundColor={bgColor}
        onNodeClick={handleNodeClick}
        onNodeRightClick={handleNodeRightClick}
        onBackgroundClick={() => propsRef.current.onNodeClick("")}
        cooldownTicks={150}
        warmupTicks={20}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.4}
        enableNodeDrag={true}
        showNavInfo={false}
      />
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1 text-[10px]">
        <span className="rounded bg-zinc-900/70 px-2 py-1 text-white">
          {nodes.length} 节点 · {edges.length} 边
        </span>
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
      </div>
    </div>
  );
}
