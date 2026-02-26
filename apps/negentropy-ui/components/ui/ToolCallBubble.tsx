"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ToolCallInfo } from "@/types/common";
import { JsonViewer } from "./JsonViewer";

type ToolCallBubbleProps = {
  toolCall: ToolCallInfo;
};

/**
 * 工具调用气泡组件
 *
 * 参考 Claude.ai / ChatGPT 的设计：
 * - 折叠状态：显示工具名称和状态图标
 * - 展开状态：显示入参和结果
 * - 状态：running（加载中）、done/completed（完成）、error（错误）
 */
export function ToolCallBubble({ toolCall }: ToolCallBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isRunning = toolCall.status === "running";
  const isCompleted = toolCall.status === "completed" || toolCall.status === "done";
  const isError = toolCall.status === "error";

  // 解析参数和结果为对象（用于 JsonViewer）
  let argsObj: unknown = toolCall.args;
  try {
    if (typeof toolCall.args === "string" && toolCall.args.trim()) {
      argsObj = JSON.parse(toolCall.args);
    }
  } catch {
    argsObj = toolCall.args;
  }

  let resultObj: unknown = toolCall.result;
  try {
    if (typeof toolCall.result === "string" && toolCall.result.trim()) {
      resultObj = JSON.parse(toolCall.result);
    }
  } catch {
    resultObj = toolCall.result;
  }

  // 格式化工具名称（更友好的显示）
  const formatToolName = (name: string): string => {
    // 常见工具名称映射
    const toolNameMap: Record<string, string> = {
      "google_search": "Google Search",
      "web_search": "Web Search",
      "code_interpreter": "Code Interpreter",
      "ui.confirmation": "Confirmation",
    };
    return toolNameMap[name] || name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div
      className={cn(
        "my-2 rounded-lg border transition-all",
        isRunning && "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/30",
        isCompleted && !isError && "border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/30",
        isError && "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/30"
      )}
    >
      {/* Header: 折叠/展开 */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/20 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {/* 状态图标 */}
          {isRunning && (
            <svg
              className="w-3.5 h-3.5 text-blue-500 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {isCompleted && !isError && (
            <svg
              className="w-3.5 h-3.5 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
          {isError && (
            <svg
              className="w-3.5 h-3.5 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}

          {/* 工具名称 */}
          <span className="font-medium text-foreground">
            {formatToolName(toolCall.name)}
          </span>

          {/* 简短预览（折叠时显示） */}
          {!isExpanded && toolCall.args && (
            <span className="text-muted-foreground truncate max-w-[200px]">
              {typeof argsObj === "object" && argsObj !== null
                ? Object.keys(argsObj as Record<string, unknown>).slice(0, 2).join(", ")
                : toolCall.args.slice(0, 30)}
              {toolCall.args.length > 30 && "..."}
            </span>
          )}
        </div>

        {/* 展开/收起图标 */}
        <svg
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
          {/* 参数 */}
          {toolCall.args && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Parameters
              </span>
              <div className="mt-1.5 rounded-md bg-background border border-border p-2 overflow-auto max-h-40 custom-scrollbar">
                <JsonViewer data={argsObj} />
              </div>
            </div>
          )}

          {/* 结果 */}
          {toolCall.result && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Result
              </span>
              <div className="mt-1.5 rounded-md bg-background border border-border p-2 overflow-auto max-h-40 custom-scrollbar">
                <JsonViewer data={resultObj} />
              </div>
            </div>
          )}

          {/* 无结果提示 */}
          {!toolCall.result && !isRunning && (
            <p className="text-[11px] text-muted-foreground italic">
              No return value
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 工具调用列表组件
 *
 * 用于在 MessageBubble 中渲染关联的工具调用列表
 */
type ToolCallListProps = {
  toolCalls: ToolCallInfo[];
};

export function ToolCallList({ toolCalls }: ToolCallListProps) {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-1">
      {toolCalls.map((toolCall) => (
        <ToolCallBubble key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  );
}
