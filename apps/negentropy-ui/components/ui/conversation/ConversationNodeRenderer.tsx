"use client";

import { useState } from "react";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { MessageBubble } from "@/components/ui/MessageBubble";
import type { ChatMessage } from "@/types/common";
import type { ConversationNode } from "@/types/a2ui";
import { buildNodeSummary, safeJsonParse } from "@/utils/conversation-summary";
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

function JsonBlock({ value }: { value: unknown }) {
  return (
    <div className="max-h-64 overflow-auto rounded-xl border border-zinc-200/70 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-950/70">
      <JsonViewer data={value} />
    </div>
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

function SummaryLines({ lines }: { lines: string[] }) {
  if (lines.length === 0) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        暂无可展示摘要
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {lines.map((line) => (
        <div key={line} className="text-sm text-zinc-700 dark:text-zinc-300">
          {line}
        </div>
      ))}
    </div>
  );
}

function ExpandableDetails({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((current) => !current);
        }}
      >
        {expanded ? `收起${label}` : `展开${label}`}
      </button>
      {expanded ? <JsonBlock value={value} /> : null}
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
  const parsedContent = safeJsonParse(node.payload.content);
  const shouldRenderAsJson =
    parsedContent !== null &&
    typeof parsedContent === "object" &&
    !Array.isArray(parsedContent);

  const message: ChatMessage = {
    id: node.id,
    role:
      node.role === "user"
        ? "user"
        : node.role === "system"
          ? "system"
          : "assistant",
    content: String(node.payload.content || ""),
    author:
      typeof node.payload.author === "string"
        ? String(node.payload.author)
        : undefined,
    timestamp: node.timestamp,
    runId: node.runId,
  };

  if (shouldRenderAsJson) {
    const summary = buildNodeSummary({
      ...node,
      type: "custom",
      payload: {
        data: parsedContent,
        eventType: "json.message",
      },
    });

    return (
      <NodeCard node={node} selected={selected} onClick={() => onSelect?.(node.id)}>
        <SummaryLines lines={summary} />
        <ExpandableDetails label="JSON 详情" value={parsedContent} />
      </NodeCard>
    );
  }

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
  const childCount = node.children.filter((child) => child.visibility !== "debug-only")
    .length;
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
  const summary = buildNodeSummary(node);
  const detailValue = (() => {
    switch (node.type) {
      case "tool-call":
        return safeJsonParse(node.payload.args);
      case "tool-result":
        return safeJsonParse(node.payload.content);
      case "activity":
        return node.payload.content;
      case "state-delta":
        return node.payload.delta;
      case "state-snapshot":
        return node.payload.snapshot;
      case "raw":
        return node.payload.data;
      case "custom":
        return node.payload.data;
      default:
        return node.payload;
    }
  })();

  return (
    <NodeCard node={node} selected={selected} onClick={() => onSelect?.(node.id)}>
      <SummaryLines lines={summary} />
      {node.type === "error" ? null : (
        <ExpandableDetails label="详情" value={detailValue} />
      )}
      {node.children.length > 0 ? (
        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {node.children.filter((child) => child.visibility !== "debug-only").length} 个子模块
        </div>
      ) : null}
    </NodeCard>
  );
}

export function ConversationNodeRenderer({
  node,
  depth,
  selectedNodeId,
  onNodeSelect,
}: Props) {
  if (node.visibility === "debug-only") {
    return null;
  }

  const selected = node.id === selectedNodeId;
  const visibleChildren = node.children.filter((child) => child.visibility !== "debug-only");
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
        {visibleChildren.length > 0 ? (
          <div className="mt-3 space-y-3">
            {visibleChildren.map((child) => (
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
