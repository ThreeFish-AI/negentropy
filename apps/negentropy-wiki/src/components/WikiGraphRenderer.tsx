"use client";

/**
 * WikiGraphRenderer — Wiki 知识图谱渲染器切换容器
 *
 * 与主站 `apps/negentropy-ui/.../knowledge/graph/page.tsx` 的右上角分段切换器
 * 对齐：提供 Sigma / 3D / d3-force / Force Graph / Cytoscape 五种引擎，用户可
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
// 在此数组同步增删即可。
const RENDERERS: { id: RendererId; label: string; title: string }[] = [
  {
    id: "sigma",
    label: "Sigma",
    title: "Sigma.js v3 WebGL 渲染（高性能，适合大图，默认引擎）",
  },
  {
    id: "3d",
    label: "3D",
    title: "3D WebGL（three.js + d3-force-3d，支持三维旋转）",
  },
  { id: "d3", label: "d3-force", title: "d3-force 力导向 + SVG 渲染" },
  {
    id: "force-graph",
    label: "Force Graph",
    title: "react-force-graph-2d（粒子流动效果，视觉表现力强）",
  },
  { id: "cytoscape", label: "Cytoscape", title: "Cytoscape.js + fCoSE 布局" },
];

interface WikiGraphRendererProps {
  pubSlug: string;
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
  truncated: boolean;
  totalEntities: number;
}

export function WikiGraphRenderer({
  pubSlug,
  nodes,
  edges,
  truncated,
  totalEntities,
}: WikiGraphRendererProps) {
  const [renderer, setRenderer] = useState<RendererId>("sigma");
  const common = { pubSlug, nodes, edges, truncated, totalEntities };

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

      {renderer === "sigma" && <WikiGraphCanvas {...common} />}
      {renderer === "3d" && <WikiGraph3DCanvas {...common} />}
      {renderer === "d3" && <WikiD3ForceCanvas {...common} />}
      {renderer === "force-graph" && <WikiForceGraphCanvas {...common} />}
      {renderer === "cytoscape" && <WikiCytoscapeCanvas {...common} />}
    </div>
  );
}

export default WikiGraphRenderer;
