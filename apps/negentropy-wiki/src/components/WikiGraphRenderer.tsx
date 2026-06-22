"use client";

/**
 * WikiGraphRenderer — Wiki 知识图谱渲染器切换容器
 *
 * 与主站 `apps/negentropy-ui/.../knowledge/graph/page.tsx` 的右上角分段切换器
 * 对齐：提供 d3-force / 3D / Sigma / Force Graph / Cytoscape 五种引擎，用户可
 * 自由切换，默认 Sigma WebGL。
 *
 * 数据由服务端页面（`/:pubSlug/graph`）一次性 fetch 后下传，本组件仅消费 props
 * （无客户端 fetch），保持 ISR/SSG。五个渲染器均通过 `dynamic(..., ssr:false)`
 * 懒加载——切到哪个才下载哪个的 bundle（three.js / cytoscape / d3 等重依赖按需
 * code-split），不增重初始客户端 chunk。
 */

import { useState } from "react";
import dynamic from "next/dynamic";

import type { WikiGraphEdge, WikiGraphNode } from "@/lib/wiki-graph-types";

const WikiGraphCanvas = dynamic(
  () => import("./WikiGraphCanvas").then((m) => m.WikiGraphCanvas),
  { ssr: false },
);
const WikiGraph3DCanvas = dynamic(
  () => import("./WikiGraph3DCanvas").then((m) => m.WikiGraph3DCanvas),
  { ssr: false },
);
const WikiD3ForceCanvas = dynamic(
  () => import("./WikiD3ForceCanvas").then((m) => m.WikiD3ForceCanvas),
  { ssr: false },
);
const WikiForceGraphCanvas = dynamic(
  () => import("./WikiForceGraphCanvas").then((m) => m.WikiForceGraphCanvas),
  { ssr: false },
);
const WikiCytoscapeCanvas = dynamic(
  () => import("./WikiCytoscapeCanvas").then((m) => m.WikiCytoscapeCanvas),
  { ssr: false },
);

type RendererId = "sigma" | "3d" | "d3" | "force-graph" | "cytoscape";

// 切换器配置（label / title 与主站 page.tsx 切换器对齐）。后续主站渲染器增减时，
// 在此数组同步增删即可。`suffix` 为左上角浮层徽标中显示的引擎名（与各渲染器历史
// 文案一一对应），随当前选中引擎切换。
const RENDERERS: {
  id: RendererId;
  label: string;
  title: string;
  suffix: string;
}[] = [
  {
    id: "d3",
    label: "d3-force",
    title: "d3-force 力导向 + SVG 渲染",
    suffix: "d3 SVG",
  },
  {
    id: "3d",
    label: "3D",
    title: "3D WebGL（three.js + d3-force-3d，支持三维旋转）",
    suffix: "3D WebGL",
  },
  {
    id: "sigma",
    label: "Sigma",
    title: "Sigma.js v3 WebGL 渲染（高性能，适合大图，默认引擎）",
    suffix: "Sigma WebGL",
  },
  {
    id: "force-graph",
    label: "Force Graph",
    title: "react-force-graph-2d（粒子流动效果，视觉表现力强）",
    suffix: "ForceGraph 2D",
  },
  {
    id: "cytoscape",
    label: "Cytoscape",
    title: "Cytoscape.js + fCoSE 布局",
    suffix: "Cytoscape",
  },
];

interface WikiGraphRendererProps {
  pubSlug: string;
  /** Publication 版本号，与统计一起渲染于左上角浮层徽标 */
  version: number;
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
  truncated: boolean;
  totalEntities: number;
}

export function WikiGraphRenderer({
  pubSlug,
  version,
  nodes,
  edges,
  truncated,
  totalEntities,
}: WikiGraphRendererProps) {
  const [renderer, setRenderer] = useState<RendererId>("d3");
  // 统计数据对 5 个引擎完全相同（仅引擎名后缀不同），故浮层徽标上提至本父组件，
  // 作为版本/统计的单一事实源；各画布组件不再各自重复渲染 overlay。
  const common = { pubSlug, nodes, edges };
  const activeSuffix =
    RENDERERS.find((r) => r.id === renderer)?.suffix ?? renderer;

  return (
    <div className="wiki-graph-render-root">
      <div
        className="wiki-graph-toolbar"
        role="group"
        aria-label="知识图谱渲染器切换"
      >
        {RENDERERS.map((r) => (
          <button
            key={r.id}
            type="button"
            title={r.title}
            aria-pressed={renderer === r.id}
            className={`wiki-graph-render-btn${renderer === r.id ? " active" : ""}`}
            onClick={() => setRenderer(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="wiki-graph-canvas-overlay">
        <span className="wiki-graph-badge">
          v{version} · {nodes.length} 节点 · {edges.length} 边 · {activeSuffix}
        </span>
        {truncated && totalEntities != null && (
          <span className="wiki-graph-badge wiki-graph-badge-warn">
            已按 importance 截断（共 {totalEntities} 个实体，仅显示 top-
            {nodes.length}）
          </span>
        )}
      </div>

      {renderer === "sigma" && <WikiGraphCanvas {...common} />}
      {renderer === "3d" && <WikiGraph3DCanvas {...common} />}
      {renderer === "d3" && <WikiD3ForceCanvas {...common} />}
      {renderer === "force-graph" && <WikiForceGraphCanvas {...common} />}
      {renderer === "cytoscape" && <WikiCytoscapeCanvas {...common} />}
    </div>
  );
}

export default WikiGraphRenderer;
