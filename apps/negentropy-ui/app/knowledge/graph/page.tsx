"use client";

import { useEffect, useMemo, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { fetchGraph, KnowledgeGraphPayload, upsertGraph } from "@/lib/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

type GraphNode = { id: string; label?: string; type?: string };
type GraphEdge = { source: string; target: string; label?: string };
type GraphNodePos = GraphNode & { x: number; y: number; vx: number; vy: number };

export default function KnowledgeGraphPage() {
  const [payload, setPayload] = useState<KnowledgeGraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [retryQueue, setRetryQueue] = useState<KnowledgeGraphPayload[]>([]);

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

  const nodes = (payload?.nodes || []) as GraphNode[];
  const edges = (payload?.edges || []) as GraphEdge[];
  const runs = payload?.runs || [];
  const latestRun = (runs[0] || {}) as { run_id?: string; version?: number };

  const [layout, setLayout] = useState<GraphNodePos[]>([]);

  useEffect(() => {
    if (!nodes.length) {
      setLayout([]);
      return;
    }
    const width = 360;
    const height = 360;
    const centerX = width / 2;
    const centerY = height / 2;
    const nodeMap = new Map<string, GraphNodePos>();
    nodes.forEach((node) => {
      nodeMap.set(node.id, {
        ...node,
        x: centerX + (Math.random() - 0.5) * 120,
        y: centerY + (Math.random() - 0.5) * 120,
        vx: 0,
        vy: 0,
      });
    });
    const nodesArr = Array.from(nodeMap.values());
    const edgePairs = edges
      .map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return null;
        return { source, target };
      })
      .filter((edge) => edge !== null) as { source: GraphNodePos; target: GraphNodePos }[];

    const iterations = 160;
    const repulsion = 1400;
    const spring = 0.05;
    const damping = 0.75;
    const targetDistance = 120;

    for (let i = 0; i < iterations; i += 1) {
      for (let a = 0; a < nodesArr.length; a += 1) {
        const nodeA = nodesArr[a];
        let fx = 0;
        let fy = 0;
        for (let b = 0; b < nodesArr.length; b += 1) {
          if (a === b) continue;
          const nodeB = nodesArr[b];
          const dx = nodeA.x - nodeB.x;
          const dy = nodeA.y - nodeB.y;
          const distSq = Math.max(dx * dx + dy * dy, 60);
          const force = repulsion / distSq;
          fx += (dx / Math.sqrt(distSq)) * force;
          fy += (dy / Math.sqrt(distSq)) * force;
        }
        nodeA.vx = (nodeA.vx + fx) * damping;
        nodeA.vy = (nodeA.vy + fy) * damping;
      }

      edgePairs.forEach(({ source, target }) => {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const delta = dist - targetDistance;
        const force = spring * delta;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      });

      nodesArr.forEach((node) => {
        node.x = Math.min(width - 24, Math.max(24, node.x + node.vx));
        node.y = Math.min(height - 24, Math.max(24, node.y + node.vy));
      });
    }

    setLayout(nodesArr);
  }, [nodes, edges]);

  const selectedNode = layout.find((node) => node.id === selectedNodeId) || null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <KnowledgeNav title="Knowledge Graph" description="实体关系视图与构建历史" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[2.2fr_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Graph Canvas</h2>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span>点击节点查看详情</span>
              <button
                className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] text-zinc-600 hover:border-zinc-900 hover:text-zinc-900"
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
          <div className="mt-4 flex h-[360px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50">
            {layout.length ? (
              <svg width={360} height={360} className="rounded-xl bg-white/60">
                {edges.map((edge, index) => {
                  const source = layout.find((node) => node.id === edge.source);
                  const target = layout.find((node) => node.id === edge.target);
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
                      fill={selectedNodeId === node.id ? "#18181b" : "#3f3f46"}
                    />
                    <text x={node.x} y={node.y + 30} fontSize={10} textAnchor="middle" fill="#27272a">
                      {node.label || node.id}
                    </text>
                  </g>
                ))}
              </svg>
            ) : (
              <p className="text-xs text-zinc-500">暂无图谱数据</p>
            )}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Entity Detail</h2>
            {selectedNode ? (
              <div className="mt-3 text-xs text-zinc-600">
                <p>ID: {selectedNode.id}</p>
                <p>Label: {selectedNode.label || "-"}</p>
                <p>Type: {selectedNode.type || "-"}</p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">暂无实体选中</p>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Build Runs</h2>
            {runs.length ? (
              <div className="mt-3 space-y-2 text-xs text-zinc-600">
                {runs.map((run, index) => (
                  <div key={index} className="rounded-lg border border-zinc-200 p-2">
                    {JSON.stringify(run)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">暂无构建记录</p>
            )}
          </div>
          {retryQueue.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-700 shadow-sm">
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
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm">
            {error
              ? `加载失败：${error}`
              : `状态源：${payload ? "已加载" : "等待加载"}${saveStatus ? ` | ${saveStatus}` : ""}`}
          </div>
        </aside>
      </div>
    </div>
  );
}
