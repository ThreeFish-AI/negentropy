"use client";

/**
 * WikiForceGraphCanvas — react-force-graph-2d 渲染器（大图降级）
 *
 * 与 `WikiGraphCanvas`（Sigma WebGL）的关系：
 *   - Sigma WebGL 在节点数 ≤ 500 时表现最佳；超过阈值后 ForceAtlas2 单次
 *     iter 较慢，且 WebGL 上下文可能在低端设备 OOM。
 *   - ForceGraph2D 基于 Canvas 2D + d3-force-3d 物理引擎，在 500-2000 节点
 *     区间渲染更稳健且 bundle 体积可控。
 *
 * 与主站 `apps/negentropy-ui/.../ForceGraphCanvas.tsx` 的关系：
 *   - 复用 `nodeSize` / `nodeColor` / `nodeCanvasObject` / `nodePointerAreaPaint`
 *     的核心实现（这些是真正的复用价值）；
 *   - 剥离主站特有的"双击展开 / 时态切片 / 主题 hook"逻辑；
 *   - Wiki 场景定位于"只读浏览 + 点击跳转"。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";

import type { WikiGraphEdge, WikiGraphNode } from "@/lib/wiki-graph-types";
import { useIsDark } from "@/lib/wiki-color-scheme";
import { nodeColor } from "@/lib/wiki-graph-visual";

// 边 / 箭头配色（随响应式 isDark 实时取值，经函数式 prop 下传，避免重建 graphData）。
function edgeColor(isDark: boolean): string {
  return isDark ? "rgba(255,255,255,0.12)" : "#52525b";
}
function arrowColor(isDark: boolean): string {
  return isDark ? "rgba(255,255,255,0.25)" : "#71717a";
}

// ---------------------------------------------------------------------------
// 视觉常量：配色 / 取色逻辑见 `@/lib/wiki-graph-visual`（跨渲染器单一事实源）。
// nodeSize 系数随渲染器而异（Canvas 圆点偏小），保留本地定义。
// ---------------------------------------------------------------------------

function nodeSize(importance: number | null | undefined): number {
  if (importance == null) return 6;
  const clamped = Math.min(Math.max(importance, 0), 1);
  return 4 + 8 * clamped;
}

// ---------------------------------------------------------------------------
// react-force-graph-2d 数据结构
// ---------------------------------------------------------------------------

interface FGNode {
  id: string;
  name: string;
  val: number;
  color: string;
  x?: number;
  y?: number;
  __importance?: number | null;
  __entrySlugs?: string[];
}

interface FGLink {
  source: string;
  target: string;
  label: string;
}

// 注：link 颜色不再固化进数据（否则主题切换需重建 graphData → 触发整图重排），
// 改由 ForceGraph2D 的 linkColor 函数式 prop 实时读取响应式 isDark。
function toForceGraphData(
  nodes: WikiGraphNode[],
  edges: WikiGraphEdge[],
): { nodes: FGNode[]; links: FGLink[] } {
  const validIds = new Set(nodes.map((n) => n.id));
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      name: n.label ?? n.id.slice(0, 8),
      val: nodeSize(n.importance),
      color: nodeColor(n),
      __importance: n.importance,
      __entrySlugs: n.entry_slugs ?? [],
    })),
    links: edges
      .filter((e) => validIds.has(e.source) && validIds.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        label: e.label ?? e.type ?? "",
      })),
  };
}

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

interface WikiForceGraphCanvasProps {
  pubSlug: string;
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
  truncated?: boolean;
  totalEntities?: number;
}

export function WikiForceGraphCanvas({
  pubSlug,
  nodes,
  edges,
  truncated = false,
  totalEntities,
}: WikiForceGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [ForceGraph2D, setForceGraph2D] = useState<ComponentType<
    Record<string, unknown>
  > | null>(null);
  const router = useRouter();

  // entry_slugs 在 react-force-graph-2d 经物理引擎拷贝后仍保留于 __entrySlugs
  // 字段，但点击事件传回的对象可能是引擎内部 wrapper。用 Map 兜底从 id 反查。
  const entrySlugMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of nodes) m.set(n.id, n.entry_slugs ?? []);
    return m;
  }, [nodes]);

  // 动态导入 react-force-graph-2d（依赖 window，SSR 不兼容）
  useEffect(() => {
    let cancelled = false;
    import("react-force-graph-2d").then((mod) => {
      if (cancelled) return;
      setForceGraph2D(
        () => mod.default as unknown as ComponentType<Record<string, unknown>>,
      );
    });
    return () => {
      cancelled = true;
    };
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

  const handleNodeClick = useCallback(
    (node: { id?: string | number }) => {
      const nodeId = String(node.id ?? "");
      const slugs = entrySlugMap.get(nodeId) ?? [];
      if (slugs.length > 0) {
        router.push(`/${pubSlug}/${slugs[0]}`);
      }
    },
    [entrySlugMap, pubSlug, router],
  );

  // 响应式暗色态：仅驱动标签 / 边 / 箭头取色，不参与 graphData（保持布局稳定）。
  const isDark = useIsDark();

  const graphData = useMemo(() => toForceGraphData(nodes, edges), [nodes, edges]);

  // 自定义节点渲染：圆形 + 标签（缩小时隐藏）
  const nodeCanvasObject = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = nodeSize(node.__importance);
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (globalScale > 0.3) {
        const fontSize = Math.max(12 / globalScale, 3.5);
        ctx.font = `${fontSize}px system-ui, sans-serif`;
        ctx.fillStyle = isDark ? "#e3e3e3" : "#1c1e21";
        ctx.textAlign = "center";
        ctx.fillText(node.name, node.x!, node.y! + size + fontSize + 1);
      }
    },
    [isDark],
  );

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
    <div className="wiki-graph-canvas-root">
      <div ref={containerRef} className="wiki-graph-canvas-stage">
        {ForceGraph2D && dimensions.width > 0 && dimensions.height > 0 && (
          <ForceGraph2D
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="transparent"
            nodeLabel="name"
            nodeRelSize={4}
            nodeVal="val"
            nodeColor="color"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => "replace"}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkColor={() => edgeColor(isDark)}
            linkWidth={1}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.8}
            linkDirectionalArrowColor={() => arrowColor(isDark)}
            onNodeClick={handleNodeClick}
            enableNodeDrag={true}
            cooldownTicks={200}
            d3AlphaDecay={0.03}
          />
        )}
      </div>

      <div className="wiki-graph-canvas-overlay">
        <span className="wiki-graph-badge">
          {nodes.length} 节点 · {edges.length} 边 · ForceGraph 2D
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

export default WikiForceGraphCanvas;
