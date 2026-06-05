/* eslint-disable react-hooks/set-state-in-effect --
 * 打开抽屉时在 effect 内调 load（间接 setState）的既有数据加载模式，
 * 配合 useCallback + dep array 防止无限循环。
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** Transport type 显示标签。 */
function transportLabel(t: string): string {
  if (t === "http") return "HTTP";
  if (t === "sse") return "SSE";
  return "stdio";
}

// ---------------------------------------------------------------------------
// 轻量 MCP API 类型（仅本组件使用）
// ---------------------------------------------------------------------------
interface McpServerItem {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  transport_type: string;
  is_enabled: boolean;
  tool_count: number;
}

interface McpToolItem {
  name: string;
  display_name: string | null;
  title: string | null;
  description: string | null;
  is_enabled: boolean;
}

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

/**
 * Iteration 详情中的 MCP Server/Tool 面板。
 *
 * 直接从系统 MCP API（``/api/interface/mcp/servers``）实时获取所有已启用的
 * Server 及其 Tools，不依赖后端快照——确保所有迭代（含历史）均能展示当前
 * Claude Code 可用的 MCP 能力。
 */
export function McpServersPanel() {
  const [servers, setServers] = useState<McpServerItem[]>([]);
  const [toolsMap, setToolsMap] = useState<Record<string, McpToolItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. 获取所有已启用的 MCP Server
      const res = await fetch("/api/interface/mcp/servers", { cache: "no-store" });
      if (!res.ok) throw new Error(`MCP servers API → ${res.status}`);
      const allServers: McpServerItem[] = await res.json();
      const enabled = allServers.filter((s) => s.is_enabled);
      setServers(enabled);

      // 2. 并行获取各 Server 的已启用 Tools
      const entries = await Promise.all(
        enabled.map(async (s) => {
          try {
            const tRes = await fetch(`/api/interface/mcp/servers/${s.id}/tools`, { cache: "no-store" });
            if (!tRes.ok) return [s.id, []] as const;
            const allTools: McpToolItem[] = await tRes.json();
            return [s.id, allTools.filter((t) => t.is_enabled)] as const;
          } catch {
            return [s.id, []] as const;
          }
        }),
      );
      setToolsMap(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载 MCP 数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalTools = useMemo(
    () => servers.reduce((sum, s) => sum + (toolsMap[s.id]?.length ?? s.tool_count ?? 0), 0),
    [servers, toolsMap],
  );

  // Loading 骨架
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">MCP Servers</span>
          <span className="text-[10px] text-text-muted animate-pulse">加载中…</span>
        </div>
      </div>
    );
  }

  // 无数据或错误 → 静默不渲染（零视觉噪音）
  if (error || servers.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">MCP Servers</span>
        <span className="text-[10px] text-text-muted">
          ({servers.length}) · {totalTools} Tools
        </span>
      </div>

      {/* Server list */}
      <div className="space-y-1.5">
        {servers.map((server) => {
          const tools = toolsMap[server.id] ?? [];
          return (
            <details key={server.id} className="group/details">
              <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-border/40 [&::-webkit-details-marker]:hidden">
                {/* Chevron */}
                <svg
                  className="h-3 w-3 shrink-0 text-text-muted transition-transform group-open/details:rotate-90"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4.5 2.5L8 6L4.5 9.5" />
                </svg>

                {/* Server name */}
                <span className="font-mono font-medium text-text-secondary">{server.name}</span>

                {/* Transport type pill */}
                <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-100 px-1.5 py-px text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                  {transportLabel(server.transport_type)}
                </span>

                {/* Display name (if different from name) */}
                {server.display_name && server.display_name !== server.name && (
                  <span className="truncate text-[10px] text-text-muted">— {server.display_name}</span>
                )}

                {/* Tool count */}
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-text-muted">
                  {tools.length > 0 ? `${tools.length} tools` : `${server.tool_count} tools`}
                </span>
              </summary>

              {/* Tool list */}
              {tools.length > 0 ? (
                <div className="ml-4.5 mt-1 flex flex-wrap gap-1.5 pb-1">
                  {tools.map((tool) => {
                    const label = tool.display_name || tool.title || tool.name;
                    return (
                      <span
                        key={tool.name}
                        className="group/tool relative inline-flex cursor-default items-center rounded-lg border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-text-secondary transition-colors hover:bg-border/60"
                      >
                        {label}
                        {/* Hover tooltip for description */}
                        {tool.description && (
                          <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden max-w-72 -translate-x-1/2 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-[10px] leading-relaxed text-text-secondary shadow-lg backdrop-blur group-hover/tool:block">
                            {tool.description}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="ml-4.5 pb-1 text-[10px] text-text-muted">
                  {server.tool_count > 0
                    ? `${server.tool_count} 个工具已注册（点击展开加载详情）`
                    : "无已发现的工具"}
                </p>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}
