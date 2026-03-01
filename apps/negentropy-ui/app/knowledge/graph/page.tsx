"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import {
  fetchGraph,
  KnowledgeGraphPayload,
  upsertGraph,
} from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

type GraphNode = { id: string; label?: string; type?: string };
type GraphEdge = { source: string; target: string; label?: string };
type GraphNodePos = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
};

export default function KnowledgeGraphPage() {
  const [payload, setPayload] = useState<KnowledgeGraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [retryQueue, setRetryQueue] = useState<KnowledgeGraphPayload[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<
    import("d3-force").Simulation<GraphNodePos, undefined> | null
  >(null);

  useEffect(() => {
    let active = true;
    fetchGraph(APP_NAME)
      .then((data) => {
        if (active) {
          setPayload(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(String(err));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const nodes = useMemo(() => (payload?.nodes || []) as GraphNode[], [payload]);
  const edges = useMemo(() => (payload?.edges || []) as GraphEdge[], [payload]);
  const runs = payload?.runs || [];
  const latestRun = (runs[0] || {}) as { run_id?: string; version?: number };

  const [layout, setLayout] = useState<GraphNodePos[]>([]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    const run = async () => {
      if (!nodes.length || !svgRef.current) {
        setLayout([]);
        return;
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

      const width = 360;
      const height = 360;
      const nodeMap = new Map<string, GraphNodePos>();
      nodes.forEach((node) => {
        nodeMap.set(node.id, {
          ...node,
          x: width / 2 + (Math.random() - 0.5) * 120,
          y: height / 2 + (Math.random() - 0.5) * 120,
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
        .filter((edge) => edge !== null) as {
        source: GraphNodePos;
        target: GraphNodePos;
        label?: string;
      }[];

      const simulation = forceSimulation(nodesArr)
        .force("charge", forceManyBody().strength(-240))
        .force(
          "link",
          forceLink(links)
            .id((d) => (d as GraphNodePos).id)
            .distance(120),
        )
        .force("center", forceCenter(width / 2, height / 2))
        .force("collide", forceCollide(20))
        .alphaDecay(0.03);
      simulationRef.current = simulation;

      const svg = select(svgRef.current);
      const g = svg.select("g.graph-layer");
      svg.call(
        zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.5, 2.5])
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
  }, [nodes, edges]);

  useEffect(() => {
    if (!svgRef.current || !simulationRef.current || !layout.length) {
      return;
    }
    let active = true;
    const run = async () => {
      const { select } = await import("d3-selection");
      const { drag } = await import("d3-drag");
      if (!active || !simulationRef.current) return;
      const svg = select(svgRef.current);
      const g = svg.select("g.graph-layer");
      g.selectAll("circle")
        .data(layout, (d: GraphNodePos) => d.id)
        .call(
          drag<SVGCircleElement, GraphNodePos>()
            .on("start", (event, d) => {
              if (!event.active && simulationRef.current)
                simulationRef.current.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event, d) => {
              if (!event.active && simulationRef.current)
                simulationRef.current.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            }),
        );
    };
    run();
    return () => {
      active = false;
    };
  }, [layout]);

  const selectedNode =
    layout.find((node) => node.id === selectedNodeId) || null;

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav
        title="Knowledge Graph"
        description="实体关系视图与构建历史"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 gap-6 px-6 py-6">
          <div className="min-h-0 min-w-0 flex-[2.2] overflow-y-auto">
            <div className="pb-4 pr-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Graph Canvas
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>点击节点查看详情</span>
                    <button
                      className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
                      onClick={async () => {
                        if (!payload) return;
                        setSaveStatus("saving");
                        try {
                          const runId = latestRun.run_id || crypto.randomUUID();
                          await upsertGraph({
                            app_name: APP_NAME,
                            run_id: runId,
                            status: "completed",
                            graph: payload,
                            expected_version: latestRun.version,
                            idempotency_key: crypto.randomUUID(),
                          });
                          setSaveStatus("saved");
                        } catch (err) {
                          setSaveStatus(`error:${String(err)}`);
                          setRetryQueue((prev) => [...prev, payload]);
                        }
                      }}
                    >
                      写回图谱
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex h-[360px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                  {layout.length ? (
                    <svg
                      ref={svgRef}
                      width={360}
                      height={360}
                      className="rounded-xl bg-white/60 dark:bg-zinc-800/60"
                    >
                      <g className="graph-layer">
                        {edges.map((edge, index) => {
                          const source = layout.find(
                            (node) => node.id === edge.source,
                          );
                          const target = layout.find(
                            (node) => node.id === edge.target,
                          );
                          if (!source || !target) {
                            return null;
                          }
                          return (
                            <g key={`${edge.source}-${edge.target}-${index}`}>
                              <line
                                x1={source.x}
                                y1={source.y}
                                x2={target.x}
                                y2={target.y}
                                stroke="#d4d4d8"
                                strokeWidth={1.4}
                              />
                              {edge.label ? (
                                <text
                                  x={(source.x + target.x) / 2}
                                  y={(source.y + target.y) / 2}
                                  fontSize={9}
                                  fill="#71717a"
                                >
                                  {edge.label}
                                </text>
                              ) : null}
                            </g>
                          );
                        })}
                        {layout.map((node) => (
                          <g key={node.id} onClick={() => setSelectedNodeId(node.id)}>
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={selectedNodeId === node.id ? 18 : 14}
                              fill={
                                selectedNodeId === node.id ? "#18181b" : "#3f3f46"
                              }
                            />
                            <text
                              x={node.x}
                              y={node.y + 30}
                              fontSize={10}
                              textAnchor="middle"
                              fill="#27272a"
                            >
                              {node.label || node.id}
                            </text>
                          </g>
                        ))}
                      </g>
                    </svg>
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">暂无图谱数据</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <aside className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Entity Detail
                </h2>
                {selectedNode ? (
                  <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                    <p>ID: {selectedNode.id}</p>
                    <p>Label: {selectedNode.label || "-"}</p>
                    <p>Type: {selectedNode.type || "-"}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">暂无实体选中</p>
                )}
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Build Runs</h2>
                {runs.length ? (
                  <div className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {runs.map((run, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
                      >
                        {JSON.stringify(run)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">暂无构建记录</p>
                )}
              </div>
              {retryQueue.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-700 shadow-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  <p className="font-semibold">待重试写回：{retryQueue.length}</p>
                  <button
                    className="mt-3 rounded bg-amber-600 px-3 py-2 text-[11px] font-semibold text-white"
                    onClick={async () => {
                      const next = retryQueue[0];
                      if (!next) return;
                      setSaveStatus("retrying");
                      try {
                        const runId = latestRun.run_id || crypto.randomUUID();
                        await upsertGraph({
                          app_name: APP_NAME,
                          run_id: runId,
                          status: "completed",
                          graph: next,
                          expected_version: latestRun.version,
                          idempotency_key: crypto.randomUUID(),
                        });
                        setRetryQueue((prev) => prev.slice(1));
                        setSaveStatus("saved");
                      } catch (err) {
                        setSaveStatus(`error:${String(err)}`);
                      }
                    }}
                  >
                    重试写回
                  </button>
                </div>
              ) : null}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                {error
                  ? `加载失败：${error}`
                  : `状态源：${payload ? "已加载" : "等待加载"}${saveStatus ? ` | ${saveStatus}` : ""}`}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
