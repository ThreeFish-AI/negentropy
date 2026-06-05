"use client";

import { useMemo } from "react";

import type { McpServerSnapshot } from "@/features/routine";

/** Transport type 显示标签。 */
function transportLabel(t: string): string {
  if (t === "http") return "HTTP";
  if (t === "sse") return "SSE";
  return "stdio";
}

interface McpServersPanelProps {
  servers: McpServerSnapshot[];
}

/**
 * Iteration 详情中的 MCP Server/Tool 快照面板。
 *
 * 展示分发时快照的 MCP Server 及其已激活工具列表。
 * 默认收起各 server 的 tool 列表，点击展开查看详情。
 */
export function McpServersPanel({ servers }: McpServersPanelProps) {
  const totalTools = useMemo(() => servers.reduce((sum, s) => sum + s.tools.length, 0), [servers]);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
          MCP Servers
        </span>
        <span className="text-[10px] text-text-muted">
          ({servers.length}) · {totalTools} Tools
        </span>
      </div>

      {/* Server list */}
      <div className="space-y-1.5">
        {servers.map((server) => (
          <details key={server.name} className="group/details">
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
              {server.tools.length > 0 && (
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-text-muted">
                  {server.tools.length} tools
                </span>
              )}
            </summary>

            {/* Tool list */}
            {server.tools.length > 0 ? (
              <div className="ml-4.5 mt-1 flex flex-wrap gap-1.5 pb-1">
                {server.tools.map((tool) => {
                  const label = tool.display_name || tool.title || tool.name;
                  const tooltip = tool.description || label;
                  return (
                    <span
                      key={tool.name}
                      className="group/tool relative inline-flex cursor-default items-center rounded-lg border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-text-secondary transition-colors hover:bg-border/60"
                      title={tooltip}
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
                无已发现的工具（Server 可能未在 catalog 中注册）
              </p>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}
