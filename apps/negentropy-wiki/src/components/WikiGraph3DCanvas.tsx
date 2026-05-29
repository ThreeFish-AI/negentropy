"use client";

/**
 * WikiGraph3DCanvas — react-force-graph-3d + three.js 三维渲染器（Wiki 只读视图）
 *
 * 与主站 `apps/negentropy-ui/.../GraphCanvas3D.tsx` 的关系：
 *   - 复用 nodeRadius / 配色 / three-spritetext 持久标签策略与力学参数；
 *   - 剥离主站特有的"选中高亮 / 右键增量子图 / hover tooltip"；
 *   - 主题改用 `data-color-scheme` 探测（Wiki 无 next-themes）；
 *   - 节点单击 → 跳转到该实体首个相关 entry（router.push）。
 *
 * react-force-graph-3d 依赖 three.js，仅客户端加载（ssr:false + 动态 import），
 * 三维 bundle 按需 code-split。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import SpriteText from "three-spritetext";

import type { WikiGraphEdge, WikiGraphNode } from "@/lib/wiki-graph-types";
import { detectDark, nodeColor } from "@/lib/wiki-graph-visual";

// react-force-graph-3d 导出 ClassComponent，用 any 绕过 dynamic() 的 FC 约束。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph3D: any = dynamic(
  () => import("react-force-graph-3d").then((m) => m.default),
  { ssr: false },
);

// react-force-graph-3d 的 nodeVal 解释为"体积量"：渲染半径 = cbrt(val) * nodeRelSize。
const NODE_REL_SIZE = 2.67;
// 球面与标签底边的世界单位间隙，保证最小节点也能清晰浮于球体之上。
const LABEL_GAP = 3;

// nodeRadius3D 系数随渲染器而异（三维球体量纲），保留本地定义。
function nodeRadius3D(importance: number | null | undefined): number {
  if (importance == null) return 3;
  const clamped = Math.min(Math.max(importance, 0), 1);
  return 2 + 6 * clamped;
}

interface WikiGraph3DCanvasProps {
  pubSlug: string;
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
  truncated?: boolean;
  totalEntities?: number;
}

export function WikiGraph3DCanvas({
  pubSlug,
  nodes,
  edges,
  truncated = false,
  totalEntities,
}: WikiGraph3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const router = useRouter();

  const isDark = useMemo(() => detectDark(), []);
  const bgColor = isDark ? "#0a0a0a" : "#ffffff";

  // 节点 id → entry_slugs 映射，供点击跳转
  const entrySlugMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of nodes) m.set(n.id, n.entry_slugs ?? []);
    return m;
  }, [nodes]);

  // react-force-graph-3d 默认使用 window 尺寸，导致 Flex 布局溢出；用
  // ResizeObserver 追踪容器尺寸并传显式 width/height 约束 Canvas。
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

  // 预计算颜色 + 体积量，避免 accessor 闭包中反复查找
  const nodeMeta = useMemo(() => {
    const map = new Map<string, { color: string; val: number }>();
    for (const n of nodes) {
      map.set(n.id, { color: nodeColor(n), val: nodeRadius3D(n.importance) });
    }
    return map;
  }, [nodes]);

  const graphData = useMemo(() => {
    return {
      nodes: nodes.map((n) => ({ id: n.id, label: n.label ?? n.id.slice(0, 8) })),
      links: edges
        .filter((e) => validIds.has(e.source) && validIds.has(e.target))
        .map((e) => ({ source: e.source, target: e.target })),
    };
  }, [nodes, edges, validIds]);

  const handleNodeClick = useCallback(
    (node: { id: string | number }) => {
      const slugs = entrySlugMap.get(String(node.id)) ?? [];
      if (slugs.length > 0) router.push(`/${pubSlug}/${slugs[0]}`);
    },
    [entrySlugMap, pubSlug, router],
  );

  const getNodeColor = useCallback(
    (node: { id: string | number }) =>
      nodeMeta.get(String(node.id))?.color ?? "#6B7280",
    [nodeMeta],
  );

  const getNodeVal = useCallback(
    (node: { id: string | number }) => nodeMeta.get(String(node.id))?.val ?? 3,
    [nodeMeta],
  );

  // three-spritetext 为每个节点生成持久 3D 文字（纯文字风格，与 2D/Sigma 对齐）。
  const getNodeThreeObject = useCallback(
    (node: { id: string | number; label?: string }) => {
      const text = node.label ?? String(node.id).slice(0, 8);
      const sprite = new SpriteText(text);
      sprite.color = isDark ? "#f4f4f5" : "#18181b";
      sprite.backgroundColor = "rgba(0,0,0,0)";
      sprite.padding = 0;
      sprite.textHeight = 3;
      sprite.borderWidth = 0;
      // 标签穿透其他球体始终可见
      sprite.material.depthWrite = false;
      sprite.renderOrder = 999;

      const val = nodeMeta.get(String(node.id))?.val ?? 3;
      // 球体实际半径 = cbrt(val) * nodeRelSize（val 是体积量，非半径）。
      const radius = Math.cbrt(val) * NODE_REL_SIZE;
      sprite.position.set(0, radius + sprite.textHeight / 2 + LABEL_GAP, 0);
      return sprite;
    },
    [isDark, nodeMeta],
  );

  return (
    <div className="wiki-graph-canvas-root">
      <div ref={containerRef} className="wiki-graph-canvas-stage">
        {dimensions.width > 0 && dimensions.height > 0 && (
          <ForceGraph3D
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
            linkColor={() => (isDark ? "rgba(255,255,255,0.25)" : "#a1a1aa")}
            linkOpacity={0.4}
            linkWidth={0.8}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            backgroundColor={bgColor}
            onNodeClick={handleNodeClick}
            cooldownTicks={150}
            warmupTicks={20}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.4}
            enableNodeDrag={true}
            showNavInfo={false}
          />
        )}
      </div>

      <div className="wiki-graph-canvas-overlay">
        <span className="wiki-graph-badge">
          {nodes.length} 节点 · {edges.length} 边 · 3D WebGL
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

export default WikiGraph3DCanvas;
