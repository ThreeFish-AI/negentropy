"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { KgBuildProgressPill } from "@/components/ui/KgBuildProgressPill";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import {
  type GraphBuildRunRecord,
  type GraphSearchResultItem,
  type KnowledgeGraphPayload,
  buildKnowledgeGraph,
  cancelPipelineRun,
  fetchCorpusGraph,
} from "@/features/knowledge";

import { BuildHistoryList, BuildPanel } from "./_components/BuildPanel";
import { CorpusSelector } from "./_components/CorpusSelector";
import { EntityDetailPanel } from "./_components/EntityDetailPanel";
import { EntityListPanel } from "./_components/EntityListPanel";
import { EvidenceChainPanel } from "./_components/EvidenceChainPanel";
import { GlobalSearchPanel } from "./_components/GlobalSearchPanel";
import { GraphCanvas } from "./_components/GraphCanvas";
import { GraphStatsPanel } from "./_components/GraphStatsPanel";
import { NeighborExplorer } from "./_components/NeighborExplorer";
import { PathExplorer } from "./_components/PathExplorer";
import { SearchBar } from "./_components/SearchBar";
import { TimeTravelSlider } from "./_components/TimeTravelSlider";
import { entityColor, communityColor } from "./_components/constants";

const SigmaGraphCanvas = dynamic(
  () =>
    import("./_components/SigmaGraphCanvas").then((m) => m.SigmaGraphCanvas),
  { ssr: false },
);
const ForceGraphCanvas = dynamic(
  () =>
    import("./_components/ForceGraphCanvas").then(
      (m) => m.ForceGraphCanvas,
    ),
  { ssr: false },
);
// 3D 渲染器按需加载，避免 three.js 打入首屏 bundle
const GraphCanvas3D = dynamic(
  () =>
    import("./_components/GraphCanvas3D").then((m) => ({
      default: m.GraphCanvas3D,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 min-h-0 items-center justify-center text-xs text-zinc-500">
        Loading 3D...
      </div>
    ),
  },
);

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

type GraphNode = {
  id: string;
  label?: string;
  type?: string;
  importance?: number;
  community_id?: number | null;
};
type GraphEdge = { source: string; target: string; label?: string };
type GraphNodePos = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
};

/** 根据 PageRank importance 计算节点半径，范围 4~12px */
function nodeRadius(importance?: number): number {
  if (importance == null) return 6;
  const clamped = Math.min(Math.max(importance, 0), 1);
  return 4 + 8 * clamped;
}

export default function KnowledgeGraphPage() {
  const [corpusId, setCorpusId] = useState<string | null>(null);
  const [payload, setPayload] = useState<KnowledgeGraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"graph" | "entities">("graph");
  const [entityDetailId, setEntityDetailId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  // pillEnqueued 与 building 解耦：building 只用于禁用按钮（POST 在飞），
  // pillEnqueued 控制 KgBuildProgressPill 的挂载 + SSE 订阅生命周期，由 SSE 终态自驱卸载。
  // 修复评审 #2：旧实现把 Pill 挂载绑定到 building，POST 因 BFF 15min 超时 abort 后
  // Pill 立即卸载、SSE 关闭，用户无法收到真正的构建终态。
  const [pillEnqueued, setPillEnqueued] = useState(false);
  // pillSession 强制 Pill 在每次新构建点击时重新挂载（即便上一次终态尚未消失），
  // 避免快速重复构建时旧 Pill 残留 + SSE 不重新订阅。
  const [pillSession, setPillSession] = useState(0);
  const [searchResults, setSearchResults] = useState<GraphSearchResultItem[] | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  // G3: as_of 状态 — null 表示当前时刻，提供时穿梭至历史快照
  const [asOf, setAsOf] = useState<string | null>(null);
  // G2: 渲染引擎切换 — Cytoscape / d3-force / Sigma.js WebGL / Force Graph 2D / 3D WebGL
  const [renderer, setRenderer] = useState<"cytoscape" | "d3" | "sigma" | "force-graph" | "3d">("cytoscape");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<
    import("d3-force").Simulation<GraphNodePos, undefined> | null
  >(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadGraph = useCallback(
    async (cid: string) => {
      setError(null);
      try {
        const data = await fetchCorpusGraph(cid, APP_NAME, true, asOf ?? undefined);
        setPayload(data);
      } catch (err) {
        setError(String(err));
        setPayload(null);
      }
    },
    [asOf],
  );

  useEffect(() => {
    if (corpusId) {
      loadGraph(corpusId);
    } else {
      setPayload(null);
      setError(null);
    }
  }, [corpusId, loadGraph]);

  // G2: 双击节点增量加载子图后合并到 payload —— 按 id / source-target-label
  // 三元组去重，避免重复节点与重复边。子图节点字段是 KnowledgeGraphPayload
  // 索引签名的子集，可直接拼接。
  const handleSubgraphMerge = useCallback(
    (
      newNodes: Array<{
        id: string;
        label?: string;
        type?: string;
        importance?: number | null;
        community_id?: number | null;
        metadata?: Record<string, unknown>;
      }>,
      newEdges: Array<{
        source: string;
        target: string;
        label?: string;
        type?: string;
        weight?: number;
        metadata?: Record<string, unknown>;
      }>,
    ) => {
      setPayload((prev) => {
        const baseNodes = prev?.nodes ?? [];
        const baseEdges = prev?.edges ?? [];
        const baseRuns = prev?.runs;
        const nodeIds = new Set(baseNodes.map((n) => n.id));
        // kg_relations 为有向边，GraphCanvas 也按方向渲染箭头；edgeKey 不规范化方向是
        // 故意行为：A→B 与 B→A 视为不同关系（反向同名关系仍可能各自携带不同 evidence）。
        const edgeKey = (e: { source: string; target: string; label?: string }) =>
          `${e.source}__${e.target}__${e.label ?? ""}`;
        const edgeKeys = new Set(baseEdges.map((e) => edgeKey(e)));
        const mergedNodes = [
          ...baseNodes,
          ...newNodes.filter((n) => !nodeIds.has(n.id)),
        ];
        const mergedEdges = [
          ...baseEdges,
          ...newEdges.filter((e) => !edgeKeys.has(edgeKey(e))),
        ];
        return {
          nodes: mergedNodes,
          edges: mergedEdges,
          ...(baseRuns ? { runs: baseRuns } : {}),
        };
      });
    },
    [],
  );

  const handleBuild = useCallback(async () => {
    if (!corpusId) return;
    // 增加 pillSession 强制 Pill 重新挂载（处理快速重复构建：上次终态展示窗口未结束就再次点击）。
    setPillSession((prev) => prev + 1);
    setPillEnqueued(true);
    setBuilding(true);
    setBuildError(null);
    try {
      const result = await buildKnowledgeGraph(corpusId, {
        enable_llm_extraction: true,
      });
      if (result.status === "failed") {
        setBuildError(result.error_message ?? "构建失败");
      }
      await loadGraph(corpusId);
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : String(err));
    } finally {
      // 仅释放按钮禁用态；pillEnqueued 由 KgBuildProgressPill 的 onTerminal 回调驱动卸载。
      // 这样即便 POST 因 BFF 15min 超时 abort 抛错，SSE 仍能在真实构建结束时推送终态、
      // Pill 收到后再让父组件 setPillEnqueued(false) 自然消失。
      setBuilding(false);
    }
  }, [corpusId, loadGraph]);

  const handleCancelBuildRun = useCallback(
    async (run: GraphBuildRunRecord) => {
      if (!corpusId) return;
      const confirmed = await confirm({
        title: "取消图谱构建",
        message: (
          <div className="space-y-2">
            <p>
              确定取消构建 <span className="font-mono">{run.run_id}</span>?
            </p>
            <p className="text-xs opacity-80">
              已写入的实体和关系不会回滚（best-effort 取消）。
            </p>
          </div>
        ),
        confirmLabel: "确认取消",
        cancelLabel: "保持运行",
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await cancelPipelineRun(run.run_id || run.id, "kg", {
          appName: APP_NAME,
          corpusId,
        });
        await loadGraph(corpusId);
      } catch (err) {
        console.error("cancel_build_failed", err);
      }
    },
    [confirm, corpusId, loadGraph],
  );

  const handlePillTerminal = useCallback(() => {
    setPillEnqueued(false);
  }, []);

  const nodes = useMemo(() => (payload?.nodes || []) as GraphNode[], [payload]);
  const edges = useMemo(() => (payload?.edges || []) as GraphEdge[], [payload]);

  const runs = useMemo(() => {
    const raw = payload?.runs || [];
    return raw.map(
      (r): GraphBuildRunRecord => ({
        id: (r as Record<string, unknown>).id as string ?? r.run_id ?? "",
        run_id: r.run_id ?? "",
        status: r.status ?? "unknown",
        entity_count: (r as Record<string, unknown>).entity_count as number ?? 0,
        relation_count: (r as Record<string, unknown>).relation_count as number ?? 0,
        started_at: (r as Record<string, unknown>).started_at as string,
        completed_at: (r as Record<string, unknown>).completed_at as string,
        model_name: (r as Record<string, unknown>).model_name as string,
        error_message: (r as Record<string, unknown>).error_message as string,
      }),
    );
  }, [payload]);

  const [layout, setLayout] = useState<GraphNodePos[]>([]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    const run = async () => {
      if (renderer !== "d3" || !nodes.length) {
        if (renderer === "d3") setLayout([]);
        return;
      }
      // Wait for SVG ref to be attached after renderer switch
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

      const container = svgRef.current.parentElement;
      const width = container?.clientWidth ?? 700;
      const height = Math.max(400, container?.clientHeight ?? 500);

      const nodeMap = new Map<string, GraphNodePos>();
      nodes.forEach((node) => {
        nodeMap.set(node.id, {
          ...node,
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
          return { source, target, label: edge.label };
        })
        .filter(Boolean) as {
        source: GraphNodePos;
        target: GraphNodePos;
        label?: string;
      }[];

      const simulation = forceSimulation(nodesArr)
        .force("charge", forceManyBody().strength(-200))
        .force(
          "link",
          forceLink(links)
            .id((d) => (d as GraphNodePos).id)
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
      });

      cleanup = () => {
        simulationRef.current = null;
        simulation.stop();
      };
    };
    run();
    return () => {
      active = false;
      cleanup?.();
    };
  }, [nodes, edges, renderer]);

  useEffect(() => {
    if (
      renderer !== "d3" ||
      !svgRef.current ||
      !simulationRef.current ||
      !layout.length
    )
      return;
    let active = true;
    const run = async () => {
      const { select } = await import("d3-selection");
      const { drag } = await import("d3-drag");
      if (!active || !simulationRef.current || !svgRef.current) return;
      const svg = select(svgRef.current);
      const g = svg.select("g.graph-layer");
      g.selectAll<SVGCircleElement, GraphNodePos>("circle")
        .each(function (_, i) {
          const sim = simulationRef.current;
          if (!sim) return;
          const nodesArr = sim.nodes() as GraphNodePos[];
          const node = nodesArr[i];
          if (!node) return;
          select(this)
            .datum(node)
            .call(
              drag<SVGCircleElement, GraphNodePos>()
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
    run();
    return () => {
      active = false;
    };
    // 依赖 layout：layout 由 build effect 的首次 tick 设置，此时 simulationRef
    // 已被赋值，确保 drag 副作用在异步 simulation 构建完成之后才尝试附着。
  }, [layout, renderer]);

  const selectedNode =
    nodes.find((n) => n.id === selectedNodeId) || null;

  const entityStats = useMemo(() => {
    const byType: Record<string, number> = {};
    nodes.forEach((n) => {
      const t = n.type || "other";
      byType[t] = (byType[t] || 0) + 1;
    });
    return { total: nodes.length, edges: edges.length, byType };
  }, [nodes, edges]);

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav
        title="Knowledge Graph"
        description="实体关系视图与构建历史"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 gap-6 px-6 pt-4">
          {/* Main content area */}
          <div className="min-h-0 min-w-0 flex-[2.2] flex flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col gap-4 pr-2">
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <CorpusSelector value={corpusId} onChange={setCorpusId} />
                <div className="flex items-center gap-3">
                  <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <button
                      onClick={() => setViewTab("graph")}
                      className={`px-3 py-1 text-xs font-medium ${
                        viewTab === "graph"
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                      } rounded-l-lg`}
                    >
                      可视化
                    </button>
                    <button
                      onClick={() => setViewTab("entities")}
                      className={`px-3 py-1 text-xs font-medium ${
                        viewTab === "entities"
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                      } rounded-r-lg`}
                    >
                      实体列表
                    </button>
                  </div>
                  {viewTab === "graph" && (
                    <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 text-[10px]">
                      <button
                        onClick={() => setRenderer("cytoscape")}
                        title="Cytoscape.js + fCoSE 布局（Phase 4 默认）"
                        className={`px-2 py-1 font-medium ${
                          renderer === "cytoscape"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                        } rounded-l-lg`}
                      >
                        Cytoscape
                      </button>
                      <button
                        onClick={() => setRenderer("d3")}
                        title="d3-force（Phase 1 兼容回退）"
                        className={`px-2 py-1 font-medium border-x border-zinc-200 dark:border-zinc-700 ${
                          renderer === "d3"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                        }`}
                      >
                        d3-force
                      </button>
                      <button
                        onClick={() => setRenderer("3d")}
                        title="3D WebGL（three.js + d3-force-3d，支持三维旋转）"
                        className={`px-2 py-1 font-medium border-x border-zinc-200 dark:border-zinc-700 ${
                          renderer === "3d"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                        }`}
                      >
                        3D
                      </button>
                      <button
                        onClick={() => setRenderer("sigma")}
                        title="Sigma.js v3 WebGL 渲染（高性能，适合大图）"
                        className={`px-2 py-1 font-medium ${
                          renderer === "sigma"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                        }`}
                      >
                        Sigma
                      </button>
                      <button
                        onClick={() => setRenderer("force-graph")}
                        title="react-force-graph-2d（粒子流动效果，视觉表现力强）"
                        className={`px-2 py-1 font-medium ${
                          renderer === "force-graph"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                        } rounded-r-lg`}
                      >
                        Force Graph
                      </button>
                    </div>
                  )}
                  {/*
                   * 复用 KgBuildProgressPill 通过 SSE（/build-runs/latest/progress）
                   * 实时展示构建阶段（phase）+ 进度百分比 + 实体/关系实时计数。
                   * 替代旧的静态"正在构建..."文案：旧文案在长任务（849 chunk）期间无任何反馈，
                   * 用户体感卡死；Pill 组件能在 status=running 时显示中文阶段标签。
                   *
                   * 挂载策略：受 pillEnqueued 驱动而非 building——POST 即便因 BFF 15min 超时
                   * 而 504 abort，SSE 仍持续监听后端实际构建终态；Pill 收到 SSE 终态后通过
                   * onTerminal 回调让父组件 setPillEnqueued(false) 自然卸载。pillSession 作
                   * key，确保新一次构建强制 Pill 重新挂载并重新订阅 SSE。
                   */}
                  {pillEnqueued && corpusId && (
                    <KgBuildProgressPill
                      key={pillSession}
                      corpusId={corpusId}
                      enqueued={pillEnqueued}
                      onTerminal={handlePillTerminal}
                      compact
                    />
                  )}
                </div>
              </div>

              {/* Content Area */}
              {viewTab === "graph" && corpusId && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <SearchBar
                  corpusId={corpusId}
                  onResults={setSearchResults}
                  onClear={() => setSearchResults(null)}
                />
                {searchResults && searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedNodeId(item.entity.id)}
                        className="flex items-center justify-between rounded border border-zinc-100 dark:border-zinc-800 px-2 py-1 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <span className="text-xs text-zinc-700 dark:text-zinc-300">
                          {item.entity.label || item.entity.id.slice(0, 8)}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {item.combined_score.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
              {viewTab === "graph" && renderer === "3d" && corpusId && nodes.length > 0 ? (
                <GraphCanvas3D
                  corpusId={corpusId}
                  nodes={nodes}
                  edges={edges as unknown as Array<{ source: string; target: string; type?: string }>}
                  selectedNodeId={selectedNodeId}
                  onNodeClick={(id) => setSelectedNodeId(id || null)}
                  asOf={asOf}
                  onSubgraphMerge={handleSubgraphMerge}
                />
              ) : viewTab === "graph" && renderer === "3d" ? (
                <div className="flex flex-1 min-h-0 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  {!corpusId
                    ? "请选择语料库"
                    : error
                      ? `加载失败：${error}`
                      : "图谱为空，请先构建"}
                </div>
              ) : viewTab === "graph" && renderer === "cytoscape" && corpusId && nodes.length > 0 ? (
                <GraphCanvas
                  corpusId={corpusId}
                  nodes={nodes}
                  edges={edges as unknown as Array<{ source: string; target: string; type?: string }>}
                  selectedNodeId={selectedNodeId}
                  onNodeClick={(id) => setSelectedNodeId(id || null)}
                  asOf={asOf}
                  onSubgraphMerge={handleSubgraphMerge}
                />
              ) : viewTab === "graph" && renderer === "cytoscape" ? (
                <div className="flex flex-1 min-h-0 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  {!corpusId
                    ? "请选择语料库"
                    : error
                      ? `加载失败：${error}`
                      : "图谱为空，请先构建"}
                </div>
              ) : viewTab === "graph" && renderer === "sigma" && corpusId && nodes.length > 0 ? (
                <SigmaGraphCanvas
                  corpusId={corpusId}
                  nodes={nodes}
                  edges={edges as unknown as Array<{ source: string; target: string; type?: string }>}
                  selectedNodeId={selectedNodeId}
                  onNodeClick={(id) => setSelectedNodeId(id || null)}
                  asOf={asOf}
                  onSubgraphMerge={handleSubgraphMerge}
                />
              ) : viewTab === "graph" && renderer === "sigma" ? (
                <div className="flex flex-1 min-h-0 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  {!corpusId
                    ? "请选择语料库"
                    : error
                      ? `加载失败：${error}`
                      : "图谱为空，请先构建"}
                </div>
              ) : viewTab === "graph" && renderer === "force-graph" && corpusId && nodes.length > 0 ? (
                <ForceGraphCanvas
                  corpusId={corpusId}
                  nodes={nodes}
                  edges={edges as unknown as Array<{ source: string; target: string; type?: string }>}
                  selectedNodeId={selectedNodeId}
                  onNodeClick={(id) => setSelectedNodeId(id || null)}
                  asOf={asOf}
                  onSubgraphMerge={handleSubgraphMerge}
                />
              ) : viewTab === "graph" && renderer === "force-graph" ? (
                <div className="flex flex-1 min-h-0 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  {!corpusId
                    ? "请选择语料库"
                    : error
                      ? `加载失败：${error}`
                      : "图谱为空，请先构建"}
                </div>
              ) : viewTab === "graph" ? (
              <div className="min-h-0 flex-1 flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Graph Canvas
                  </h2>
                  {entityStats.total > 0 && (
                    <div className="flex gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                      <span>{entityStats.total} 实体</span>
                      <span>{entityStats.edges} 关系</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-1 min-h-0 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                  {!corpusId ? (
                    <div className="text-center">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        请选择语料库
                      </p>
                    </div>
                  ) : error ? (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      加载失败：{error}
                    </p>
                  ) : renderer === "d3" ? (
                    <svg
                      ref={svgRef}
                      width="100%"
                      height="100%"
                      className="rounded-xl bg-white/60 dark:bg-zinc-800/60"
                    >
                      <g className="graph-layer">
                        {!layout.length ? null : <>
                        {edges.map((edge, index) => {
                          const source = layout.find(
                            (node) => node.id === edge.source,
                          );
                          const target = layout.find(
                            (node) => node.id === edge.target,
                          );
                          if (!source || !target) return null;
                          return (
                            <g key={`${edge.source}-${edge.target}-${index}`}>
                              <line
                                x1={source.x}
                                y1={source.y}
                                x2={target.x}
                                y2={target.y}
                                stroke="#d4d4d8"
                                strokeWidth={1}
                                strokeOpacity={0.6}
                              />
                              {edge.label && (
                                <text
                                  x={(source.x + target.x) / 2}
                                  y={(source.y + target.y) / 2}
                                  fontSize={8}
                                  fill="#a1a1aa"
                                  textAnchor="middle"
                                >
                                  {edge.label}
                                </text>
                              )}
                            </g>
                          );
                        })}
                        {layout.map((node) => (
                          <g
                            key={node.id}
                            onClick={() => setSelectedNodeId(node.id)}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={
                                selectedNodeId === node.id
                                  ? Math.max(
                                      nodeRadius(node.importance) + 4,
                                      12,
                                    )
                                  : nodeRadius(node.importance)
                              }
                              fill={
                                node.community_id != null
                                  ? communityColor(node.community_id)
                                  : entityColor(node.type)
                              }
                              stroke={
                                selectedNodeId === node.id
                                  ? "#18181b"
                                  : "none"
                              }
                              strokeWidth={selectedNodeId === node.id ? 2 : 0}
                              fillOpacity={
                                selectedNodeId === node.id ? 1 : 0.85
                              }
                            />
                            <text
                              x={node.x}
                              y={node.y + 20}
                              fontSize={9}
                              textAnchor="middle"
                              fill="#52525b"
                              className="dark:fill-zinc-400"
                            >
                              {node.label || node.id.slice(0, 8)}
                            </text>
                          </g>
                        ))}
                        </>}
                      </g>
                    </svg>
                  ) : (
                    <div className="text-center space-y-3">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        暂无图谱数据
                      </p>
                      <BuildPanel
                        building={building}
                        corpusId={corpusId}
                        lastBuildError={buildError}
                        onBuild={handleBuild}
                      />
                    </div>
                  )}
                </div>
              </div>
              ) : (
              /* Entity List View */
              <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  实体列表
                </h2>
                {corpusId ? (
                  <EntityListPanel
                    corpusId={corpusId}
                    onSelectEntity={setEntityDetailId}
                    selectedEntityId={entityDetailId}
                  />
                ) : (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-8">
                    请选择语料库
                  </p>
                )}
              </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="min-h-0 min-w-0 w-72 flex-shrink-0 overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
              {/* Build action (when graph exists) */}
              {corpusId && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    构建
                  </h3>
                  <div className="mt-2">
                    <BuildPanel
                      building={building}
                      corpusId={corpusId}
                      lastBuildError={buildError}
                      onBuild={handleBuild}
                    />
                  </div>
                </div>
              )}

              {/* Entity Detail */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  实体详情
                </h3>
                {viewTab === "graph" ? (
                  selectedNode ? (
                  <div className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: entityColor(selectedNode.type) }}
                      />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {selectedNode.label || selectedNode.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <span className="text-zinc-500">ID</span>
                      <span className="font-mono text-[10px]">
                        {selectedNode.id.slice(0, 12)}...
                      </span>
                      <span className="text-zinc-500">类型</span>
                      <span>{selectedNode.type || "-"}</span>
                    </div>
                  </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      点击节点查看详情
                    </p>
                  )
                ) : corpusId ? (
                  <div className="mt-2">
                    <EntityDetailPanel
                      corpusId={corpusId}
                      entityId={entityDetailId}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    选择语料库后查看实体
                  </p>
                )}
              </div>

              {/* G1: GraphRAG Global Search — 全局问答 */}
              {corpusId && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    全局问答（GraphRAG）
                  </h3>
                  <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    基于社区摘要的 Map-Reduce 全局检索，适合「汇总性问题」
                  </p>
                  <div className="mt-2">
                    <GlobalSearchPanel corpusId={corpusId} />
                  </div>
                </div>
              )}

              {/* G4: 多跳推理 + Provenance 证据链 */}
              {corpusId && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm dark:border-violet-900 dark:bg-violet-950/20">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    多跳推理（PPR）
                  </h3>
                  <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    Personalized PageRank + 证据链（HippoRAG / NeurIPS&apos;24）
                  </p>
                  <div className="mt-2">
                    <EvidenceChainPanel corpusId={corpusId} />
                  </div>
                </div>
              )}

              {/* G3: 时间穿梭检索 — 放在 Stats 之前，作为全局时态视图开关 */}
              {corpusId && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    时间穿梭检索
                  </h3>
                  <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    选定历史时刻后，图谱与邻居/路径/搜索均按 as_of 过滤
                  </p>
                  <div className="mt-2">
                    <TimeTravelSlider
                      corpusId={corpusId}
                      asOf={asOf}
                      onChange={setAsOf}
                    />
                  </div>
                </div>
              )}

              {/* Graph Stats */}
              {corpusId && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    图谱统计
                  </h3>
                  <div className="mt-2">
                    <GraphStatsPanel corpusId={corpusId} />
                  </div>
                </div>
              )}

              {/* Build History */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  构建历史
                </h3>
                <BuildHistoryList runs={runs} corpusId={corpusId} onCancel={handleCancelBuildRun} />
              </div>

              {/* Path Explorer */}
              {corpusId && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  路径探索
                </h3>
                <div className="mt-2">
                  <PathExplorer
                    corpusId={corpusId}
                    onPathFound={() => {}}
                  />
                </div>
              </div>
              )}

              {/* Neighbor Explorer */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  邻居遍历
                </h3>
                <div className="mt-2">
                  <NeighborExplorer
                    entityId={viewTab === "graph" ? selectedNodeId : entityDetailId}
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
