"use client";

/**
 * WikiD3ForceCanvas — d3-force 模拟 + SVG 渲染器（Wiki 只读视图）
 *
 * 与主站 `apps/negentropy-ui/.../knowledge/graph/page.tsx` 内联 d3 实现的关系：
 *   - 复用 forceSimulation / forceLink / forceManyBody / forceCenter / forceCollide
 *     的力学参数与 d3-zoom / d3-drag 交互；
 *   - 主站为页面内联状态，本组件将其封装为内聚的独立渲染器（正交分解）；
 *   - 剥离主站特有的"选中描边 / hover tooltip"；节点单击 → 跳转首个相关 entry。
 *
 * 设计参考：Fruchterman & Reingold (1991) Force-Directed Layout。
 * d3-force / d3-selection / d3-zoom / d3-drag 通过动态 import 懒加载。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { WikiGraphEdge, WikiGraphNode } from "@/lib/wiki-graph-types";
import { detectDark, nodeColor } from "@/lib/wiki-graph-visual";

// 模拟节点：在 WikiGraphNode 字段子集上叠加 d3 物理引擎所需的位置 / 速度。
type D3Node = {
  id: string;
  label: string;
  type: string;
  importance: number | null;
  community_id: number | null;
  entry_slugs: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
};

type D3Sim = import("d3-force").Simulation<D3Node, undefined>;

// nodeRadius 随渲染器而异（SVG 圆点偏小），保留本地定义。
function nodeRadius(importance: number | null | undefined): number {
  if (importance == null) return 6;
  const clamped = Math.min(Math.max(importance, 0), 1);
  return 4 + 8 * clamped;
}

interface WikiD3ForceCanvasProps {
  pubSlug: string;
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
  truncated?: boolean;
  totalEntities?: number;
}

export function WikiD3ForceCanvas({
  pubSlug,
  nodes,
  edges,
  truncated = false,
  totalEntities,
}: WikiD3ForceCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<D3Sim | null>(null);
  // layoutReady：layout 首次非空时置 true，nodes 变化时重置。
  // 用作 drag effect 的稳定依赖，避免每个 tick 都重新绑定 drag handler。
  const layoutReadyRef = useRef(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [layout, setLayout] = useState<D3Node[]>([]);
  const router = useRouter();

  // isDark 仅作用于客户端 layout 落定后渲染的元素，无 SSR 着色不一致风险。
  const isDark = useMemo(() => detectDark(), []);
  const labelColor = isDark ? "#e3e3e3" : "#52525b";
  const edgeColor = isDark ? "rgba(255,255,255,0.15)" : "#d4d4d8";
  const edgeLabelColor = isDark ? "rgba(255,255,255,0.45)" : "#a1a1aa";

  const navigate = (node: D3Node) => {
    const slugs = node.entry_slugs ?? [];
    if (slugs.length > 0) router.push(`/${pubSlug}/${slugs[0]}`);
  };

  // 1) 构建力模拟：节点/边变化时重建，tick 时刷新 layout；挂载 d3-zoom。
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;
    layoutReadyRef.current = false;
    setLayoutReady(false);

    const run = async () => {
      if (!nodes.length) {
        setLayout([]);
        return;
      }
      if (!svgRef.current) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (!active || !svgRef.current) return;
      }

      const {
        forceSimulation,
        forceManyBody,
        forceLink,
        forceCenter,
        forceCollide,
      } = await import("d3-force");
      const { select } = await import("d3-selection");
      const { zoom } = await import("d3-zoom");
      if (!active || !svgRef.current) return;

      const container = containerRef.current;
      const width = container?.clientWidth ?? 700;
      const height = Math.max(400, container?.clientHeight ?? 500);

      const nodeMap = new Map<string, D3Node>();
      nodes.forEach((n) => {
        nodeMap.set(n.id, {
          id: n.id,
          label: n.label ?? n.id.slice(0, 8),
          type: n.type,
          importance: n.importance,
          community_id: n.community_id,
          entry_slugs: n.entry_slugs ?? [],
          x: width / 2 + (Math.random() - 0.5) * 200,
          y: height / 2 + (Math.random() - 0.5) * 200,
          vx: 0,
          vy: 0,
        });
      });
      const nodesArr = Array.from(nodeMap.values());
      const links = edges
        .map((edge) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;
          return { source, target, label: edge.label ?? edge.type ?? "" };
        })
        .filter(Boolean) as {
        source: D3Node;
        target: D3Node;
        label: string;
      }[];

      const simulation = forceSimulation<D3Node>(nodesArr)
        .force("charge", forceManyBody().strength(-200))
        .force(
          "link",
          forceLink<D3Node, (typeof links)[number]>(links)
            .id((d) => d.id)
            .distance(100),
        )
        .force("center", forceCenter(width / 2, height / 2))
        .force("collide", forceCollide(18))
        .alphaDecay(0.03);
      simulationRef.current = simulation;

      const svg = select(svgRef.current);
      const g = svg.select("g.graph-layer");
      svg.call(
        zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.3, 4])
          .on("zoom", (event) => {
            g.attr("transform", event.transform.toString());
          }),
      );

      setLayout([...nodesArr]);
      simulation.on("tick", () => {
        if (!active) return;
        setLayout([...nodesArr]);
        if (!layoutReadyRef.current) {
          layoutReadyRef.current = true;
          setLayoutReady(true);
        }
      });

      cleanup = () => {
        simulationRef.current = null;
        simulation.stop();
      };
    };

    void run();
    return () => {
      active = false;
      cleanup?.();
    };
  }, [nodes, edges]);

  // 2) layout 首次就绪后为节点圆挂载 d3-drag（拖拽时临时钉住位置）。
  useEffect(() => {
    if (!layoutReady || !svgRef.current || !simulationRef.current) return;
    let active = true;

    const run = async () => {
      const { select } = await import("d3-selection");
      const { drag } = await import("d3-drag");
      if (!active || !simulationRef.current || !svgRef.current) return;
      const svg = select(svgRef.current);
      const g = svg.select("g.graph-layer");
      g.selectAll<SVGCircleElement, D3Node>("circle").each(function (_, i) {
        const sim = simulationRef.current;
        if (!sim) return;
        const nodesArr = sim.nodes();
        const node = nodesArr[i];
        if (!node) return;
        select(this)
          .datum(node)
          .call(
            drag<SVGCircleElement, D3Node>()
              .on("start", (event, d) => {
                if (!event.active) sim.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
              })
              .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
              })
              .on("end", (event, d) => {
                if (!event.active) sim.alphaTarget(0);
                d.fx = null;
                d.fy = null;
              }),
          );
      });
    };

    void run();
    return () => {
      active = false;
    };
  }, [layoutReady]);

  const layoutById = useMemo(() => {
    const m = new Map<string, D3Node>();
    for (const n of layout) m.set(n.id, n);
    return m;
  }, [layout]);

  return (
    <div className="wiki-graph-canvas-root">
      <div ref={containerRef} className="wiki-graph-canvas-stage">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ display: "block", width: "100%", height: "100%" }}
        >
          <g className="graph-layer">
            {layout.length > 0 && (
              <>
                {edges.map((edge, index) => {
                  const source = layoutById.get(edge.source);
                  const target = layoutById.get(edge.target);
                  if (!source || !target) return null;
                  const label = edge.label ?? edge.type ?? "";
                  return (
                    <g key={`${edge.source}-${edge.target}-${index}`}>
                      <line
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={edgeColor}
                        strokeWidth={1}
                        strokeOpacity={0.7}
                      />
                      {label && (
                        <text
                          x={(source.x + target.x) / 2}
                          y={(source.y + target.y) / 2}
                          fontSize={8}
                          fill={edgeLabelColor}
                          textAnchor="middle"
                        >
                          {label}
                        </text>
                      )}
                    </g>
                  );
                })}
                {layout.map((node) => (
                  <g
                    key={node.id}
                    onClick={() => navigate(node)}
                    style={{ cursor: node.entry_slugs.length ? "pointer" : "default" }}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={nodeRadius(node.importance)}
                      fill={nodeColor(node)}
                      fillOpacity={0.85}
                    />
                    <text
                      x={node.x}
                      y={node.y + nodeRadius(node.importance) + 10}
                      fontSize={9}
                      textAnchor="middle"
                      fill={labelColor}
                    >
                      {node.label}
                    </text>
                  </g>
                ))}
              </>
            )}
          </g>
        </svg>
      </div>

      <div className="wiki-graph-canvas-overlay">
        <span className="wiki-graph-badge">
          {nodes.length} 节点 · {edges.length} 边 · d3 SVG
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

export default WikiD3ForceCanvas;
