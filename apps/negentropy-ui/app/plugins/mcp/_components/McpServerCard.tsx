"use client";

import { useState } from "react";

interface McpServer {
  id: string;
  owner_id: string;
  visibility: string;
  name: string;
  display_name: string | null;
  description: string | null;
  transport_type: string;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  headers: Record<string, string>;
  is_enabled: boolean;
  auto_start: boolean;
  config: Record<string, unknown>;
  tool_count: number;
}

interface McpTool {
  id: string | null;
  name: string;
  display_name: string | null;
  description: string | null;
  input_schema: Record<string, unknown>;
  is_enabled: boolean;
  call_count: number;
}

interface McpServerCardProps {
  server: McpServer;
  onEdit: () => void;
  onDelete: () => void;
  onLoad: () => void;
  tools?: McpTool[];
  loadingTools?: boolean;
  loadError?: string | null;
}

export function McpServerCard({
  server,
  onEdit,
  onDelete,
  onLoad,
  tools = [],
  loadingTools = false,
  loadError = null,
}: McpServerCardProps) {
  const [showTools, setShowTools] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {server.display_name || server.name}
            </h3>
            {server.is_enabled ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Enabled
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Disabled
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {server.visibility}
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
            {server.description || "No description"}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
              {server.transport_type}
            </span>
            {server.tool_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {server.tool_count} tools
              </span>
            )}
            {server.auto_start && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Auto-start
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Load 按钮 */}
          <button
            onClick={onLoad}
            disabled={loadingTools}
            className="rounded-md p-2 text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Load Tools from Server"
          >
            {loadingTools ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
          {/* Edit 按钮 */}
          <button
            onClick={onEdit}
            className="rounded-md p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {/* Delete 按钮 */}
          <button
            onClick={onDelete}
            className="rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {loadError && (
        <div className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {loadError}
        </div>
      )}

      {/* Tools 展示区域 */}
      {tools.length > 0 && (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <button
            onClick={() => setShowTools(!showTools)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showTools ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {tools.length} Tools Loaded
          </button>

          {showTools && (
            <div className="mt-3 space-y-3">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {tool.display_name || tool.name}
                    </h4>
                    <div className="flex items-center gap-2">
                      {tool.is_enabled ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">Enabled</span>
                      ) : (
                        <span className="text-xs text-zinc-400">Disabled</span>
                      )}
                      <span className="text-xs text-zinc-400">{tool.call_count} calls</span>
                    </div>
                  </div>
                  {tool.description && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{tool.description}</p>
                  )}
                  {/* Input Schema 展示 */}
                  {Object.keys(tool.input_schema).length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                        Input Schema
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
                        {JSON.stringify(tool.input_schema, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
