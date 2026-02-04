"use client";

import { useEffect, useMemo, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { fetchGraph, KnowledgeGraphPayload } from "@/lib/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

type GraphNode = { id: string; label?: string; type?: string };
type GraphEdge = { source: string; target: string; label?: string };

export default function KnowledgeGraphPage() {
  const [payload, setPayload] = useState<KnowledgeGraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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

  const layout = useMemo(() => {
    if (!nodes.length) {
      return [];
    }
    const center = { x: 180, y: 180 };
    const radius = 120;
    return nodes.map((node, index) => {
      const angle = (index / nodes.length) * Math.PI * 2;
      return {
        ...node,
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
    });
  }, [nodes]);

  const selectedNode = layout.find((node) => node.id === selectedNodeId) || null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <KnowledgeNav title="Knowledge Graph" description="实体关系视图与构建历史" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[2.2fr_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Graph Canvas</h2>
            <span className="text-xs text-zinc-500">点击节点查看详情</span>
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
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm">
            {error ? `加载失败：${error}` : `状态源：${payload ? "已加载" : "等待加载"}`}
          </div>
        </aside>
      </div>
    </div>
  );
}
