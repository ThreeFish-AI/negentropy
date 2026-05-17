"use client";

/**
 * WikiGraphCanvas — Sigma.js v3 + graphology WebGL 渲染器（Wiki 只读视图）
 *
 * 与主站 `apps/negentropy-ui/.../SigmaGraphCanvas.tsx` 的关系：
 *   - 复用 buildGraph / nodeSize / nodeColor / ForceAtlas2 配置策略；
 *   - 剥离主站特有的"增量加载 / 双击展开 / 实体面板 / 时态切片"逻辑；
 *   - 节点点击 → 跳转到该实体首个相关 entry（router.push）。
 *
 * 渲染策略：
 *   - WebGL 加速（vs Canvas 快 10-100x）
 *   - 节点数 > 500 时显示截断横幅，建议用户在"实体列表"按主题深入；
 *   - 数据已在 SSG 端 fetch 完毕，本组件仅消费 props（无客户端 fetch）。
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { WikiGraphEdge, WikiGraphNode } from "@/lib/wiki-graph-types";

// ---------------------------------------------------------------------------
// 视觉常量（与主站 constants.ts 对齐，独立拷贝以避免跨工程依赖）
// ---------------------------------------------------------------------------

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "#3B82F6",
  organization: "#10B981",
  location: "#F59E0B",
  event: "#EF4444",
  concept: "#8B5CF6",
  product: "#EC4899",
  document: "#6366F1",
  other: "#6B7280",
};

// Tableau 10 — 色盲友好的社区配色
const COMMUNITY_COLORS = [
  "#4E79A7",
  "#F28E2B",
  "#E15759",
  "#76B7B2",
  "#59A14F",
  "#EDC948",
  "#B07AA1",
  "#FF9DA7",
  "#9C755F",
  "#BAB0AC",
];

function entityColor(type?: string): string {
  const key = (type ?? "other").toLowerCase();
  return ENTITY_TYPE_COLORS[key] ?? ENTITY_TYPE_COLORS.other;
}

function communityColor(communityId: number | null | undefined): string {
  if (communityId == null) return "#6B7280";
  return COMMUNITY_COLORS[communityId % COMMUNITY_COLORS.length];
}

function nodeSize(importance: number | null | undefined): number {
  if (importance == null) return 10;
  const clamped = Math.min(Math.max(importance, 0), 1);
  return 6 + 14 * clamped;
}

function nodeColor(node: Pick<WikiGraphNode, "type" | "community_id">): string {
  if (node.community_id != null) return communityColor(node.community_id);
  return entityColor(node.type);
}

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

interface WikiGraphCanvasProps {
  /** Publication slug（用于节点点击跳转） */
  pubSlug: string;
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
  /**
   * 截断横幅阈值：节点数 >= 此值时显示提示。
   * 与后端 ``max_nodes`` 默认 300 相协调，避免误报。
   */
  truncateThreshold?: number;
  /** 是否实际被后端截断（来自响应的 truncated 字段） */
  truncated?: boolean;
  /** 截断前的实体总数（来自响应的 total_entities） */
  totalEntities?: number;
}

export function WikiGraphCanvas({
  pubSlug,
  nodes,
  edges,
  truncateThreshold = 500,
  truncated = false,
  totalEntities,
}: WikiGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 通过 unknown 桥接绕过 ESM 默认导出类型在 ESLint --max-warnings=0 下的过严校验。
  const sigmaRef = useRef<{ kill: () => void; refresh: () => void } | null>(null);
  const router = useRouter();

  // 单次挂载初始化 + 数据/路由变化时整图重建（Wiki 场景图谱体量有限，无需增量同步）
  useEffect(() => {
    if (!containerRef.current) return;
    let killed = false;

    const init = async () => {
      const { default: Graph } = await import("graphology");
      const { default: Sigma } = await import("sigma");
      const { default: forceAtlas2 } = await import(
        "graphology-layout-forceatlas2"
      );

      if (killed || !containerRef.current) return;

      const graph = new Graph({ multi: false, type: "directed" });
      const entrySlugMap = new Map<string, string[]>();
      for (const n of nodes) {
        entrySlugMap.set(n.id, n.entry_slugs ?? []);
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
            graph.addEdge(e.source, e.target, { label: e.label ?? e.type ?? "" });
          } catch {
            // graphology 不允许重复边，忽略
          }
        }
      }

      // 初始布局
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
        defaultEdgeColor: "#d4d4d8",
        defaultNodeColor: "#6B7280",
        minCameraRatio: 0.1,
        maxCameraRatio: 10,
        stagePadding: 20,
      });
      sigmaRef.current = sigma as unknown as {
        kill: () => void;
        refresh: () => void;
      };

      // 节点点击 → 跳转到首个相关 entry；无 entry 时不跳转
      sigma.on("clickNode", ({ node }) => {
        const slugs = entrySlugMap.get(node) ?? [];
        if (slugs.length > 0) {
          router.push(`/${pubSlug}/${slugs[0]}`);
        }
      });
    };

    void init();

    return () => {
      killed = true;
      sigmaRef.current?.kill();
      sigmaRef.current = null;
    };
  }, [nodes, edges, pubSlug, router]);

  const exceedsThreshold = nodes.length >= truncateThreshold;
  const showTruncatedBanner = truncated || exceedsThreshold;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* 状态横幅：左上角统计 + 截断提示 */}
      <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1 text-xs">
        <span className="rounded bg-zinc-900/70 px-2 py-1 text-white">
          {nodes.length} 节点 · {edges.length} 边 · Sigma WebGL
        </span>
        {showTruncatedBanner && (
          <span className="rounded bg-amber-500/90 px-2 py-1 text-white">
            {truncated && totalEntities
              ? `已按 importance 截断（共 ${totalEntities} 个实体，仅显示 top-${nodes.length}）`
              : "图谱过大，建议在实体列表中筛选"}
          </span>
        )}
      </div>
    </div>
  );
}

export default WikiGraphCanvas;
