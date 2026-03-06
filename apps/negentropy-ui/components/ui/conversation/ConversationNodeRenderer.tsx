"use client";

import { useMemo } from "react";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { MessageBubble } from "@/components/ui/MessageBubble";
import type { ChatMessage } from "@/types/common";
import type { ConversationNode } from "@/types/a2ui";
import { cn } from "@/lib/utils";

type Props = {
  node: ConversationNode;
  depth: number;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string) => void;
};

function formatTimestamp(timestamp?: number): string {
  if (!timestamp) {
    return "";
  }
  return new Date(timestamp * 1000).toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function DepthRail({ depth }: { depth: number }) {
  if (depth <= 0) {
    return null;
  }
  return (
    <div
      aria-hidden="true"
      className="absolute bottom-0 left-0 top-0 border-l border-zinc-200/80 dark:border-zinc-800"
      style={{ left: `${depth * 18 - 10}px` }}
    />
  );
}

function NodeCard({
  node,
  selected,
  children,
  onClick,
}: {
  node: ConversationNode;
  selected: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3 shadow-sm transition-colors",
        selected
          ? "border-amber-300 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
      )}
      onClick={onClick}
    >
      <div className="mb-2 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        <span>{node.title}</span>
        <span>{formatTimestamp(node.timestamp)}</span>
      </div>
      {children}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <div className="max-h-64 overflow-auto rounded-xl border border-zinc-200/70 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-950/70">
      <JsonViewer data={value} />
    </div>
  );
}

function TextNode({
  node,
  selected,
  onSelect,
}: {
  node: ConversationNode;
  selected: boolean;
  onSelect?: (nodeId: string) => void;
}) {
  const message = useMemo<ChatMessage>(
    () => ({
      id: node.id,
      role: node.role === "user" ? "user" : node.role === "system" ? "system" : "assistant",
      content: String(node.payload.content || ""),
      author:
        typeof node.payload.author === "string" ? String(node.payload.author) : undefined,
      timestamp: node.timestamp,
      runId: node.runId,
    }),
    [node],
  );

  return (
    <MessageBubble
      message={message}
      isSelected={selected}
      onSelect={() => onSelect?.(node.id)}
    />
  );
}

function TurnNode({
  node,
  selected,
  onSelect,
}: {
  node: ConversationNode;
  selected: boolean;
  onSelect?: (nodeId: string) => void;
}) {
  const childCount = node.children.length;
  return (
    <div
      className={cn(
        "rounded-[28px] border px-4 py-3",
        selected
          ? "border-amber-300 bg-white dark:border-amber-700 dark:bg-zinc-900"
          : "border-zinc-200/80 bg-zinc-100/60 dark:border-zinc-800 dark:bg-zinc-900/50",
      )}
      onClick={() => onSelect?.(node.id)}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {node.title}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {node.status === "finished" ? "已完成" : node.status === "error" ? "异常" : "进行中"}
            {" · "}
            {childCount} 个子模块
          </div>
        </div>
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {formatTimestamp(node.timestamp)}
        </div>
      </div>
    </div>
  );
}

function TechnicalNode({
  node,
  selected,
  onSelect,
}: {
  node: ConversationNode;
  selected: boolean;
  onSelect?: (nodeId: string) => void;
}) {
  const content = (() => {
    switch (node.type) {
      case "tool-call":
        return (
          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {String(node.payload.toolCallName || node.title)}
            </div>
            <JsonBlock value={node.payload.args ? safeJson(node.payload.args) : {}} />
          </div>
        );
      case "tool-result":
        return <JsonBlock value={safeJson(node.payload.content)} />;
      case "activity":
        return <JsonBlock value={node.payload.content} />;
      case "reasoning":
        return (
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            {node.summary || "推理阶段更新"}
          </div>
        );
      case "step":
        return (
          <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <div>{node.status === "done" ? "步骤已完成" : "步骤执行中"}</div>
            {"result" in node.payload && node.payload.result !== undefined ? (
              <JsonBlock value={node.payload.result} />
            ) : null}
          </div>
        );
      case "state-delta":
        return <JsonBlock value={node.payload.delta} />;
      case "state-snapshot":
        return <JsonBlock value={node.payload.snapshot} />;
      case "raw":
        return <JsonBlock value={node.payload.data} />;
      case "custom":
        return <JsonBlock value={node.payload.data} />;
      case "error":
        return (
          <div className="space-y-1 text-sm text-red-700 dark:text-red-300">
            <div>{String(node.payload.message || "未知错误")}</div>
            {node.payload.code ? (
              <div className="text-xs uppercase tracking-wider text-red-500">
                {String(node.payload.code)}
              </div>
            ) : null}
          </div>
        );
      default:
        return <JsonBlock value={node.payload} />;
    }
  })();

  return (
    <NodeCard node={node} selected={selected} onClick={() => onSelect?.(node.id)}>
      {content}
      {node.children.length > 0 ? (
        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {node.children.length} 个子模块
        </div>
      ) : null}
    </NodeCard>
  );
}

function safeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function ConversationNodeRenderer({
  node,
  depth,
  selectedNodeId,
  onNodeSelect,
}: Props) {
  const selected = node.id === selectedNodeId;
  const content = (() => {
    if (node.type === "turn") {
      return <TurnNode node={node} selected={selected} onSelect={onNodeSelect} />;
    }
    if (node.type === "text") {
      return <TextNode node={node} selected={selected} onSelect={onNodeSelect} />;
    }
    return <TechnicalNode node={node} selected={selected} onSelect={onNodeSelect} />;
  })();

  return (
    <div className="relative">
      <DepthRail depth={depth} />
      <div style={{ marginLeft: `${depth * 18}px` }}>
        {content}
        {node.type !== "turn" && node.children.length > 0 ? (
          <div className="mt-3 space-y-3">
            {node.children.map((child) => (
              <ConversationNodeRenderer
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedNodeId={selectedNodeId}
                onNodeSelect={onNodeSelect}
              />
            ))}
          </div>
        ) : null}
        {node.type === "turn" && node.children.length > 0 ? (
          <div className="mt-4 space-y-3">
            {node.children.map((child) => (
              <ConversationNodeRenderer
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedNodeId={selectedNodeId}
                onNodeSelect={onNodeSelect}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
