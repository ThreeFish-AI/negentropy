"use client";

import { useMemo } from "react";
import type { AssistantReplyDisplayBlock } from "@/types/a2ui";
import type { ToolCallInfo, ToolProgressMap } from "@/types/common";
import { MessageBubble, MarkdownContent } from "@/components/ui/MessageBubble";
import { ChatTypingIndicator } from "@/components/ui/ChatTypingIndicator";
import { ReasoningPanel, type ReasoningStepData } from "@/components/ui/ReasoningPanel";
import { SubAgentTransferCard } from "@/components/ui/SubAgentTransferCard";
import { ToolExecutionGroup } from "@/components/ui/ToolExecutionGroup";
import { extractCitationsFromToolCalls } from "@/utils/citation-parser";
import { cn } from "@/lib/utils";

export function AssistantReplyBubble({
  block,
  isSelected,
  onSelect,
  progressMap,
}: {
  block: AssistantReplyDisplayBlock;
  isSelected?: boolean;
  onSelect?: (nodeId: string) => void;
  /** Tool Progress 旁路（C3） */
  progressMap?: ToolProgressMap;
}) {
  const actionContent = block.segments
    .filter((segment) => segment.kind === "text")
    .map((segment) => segment.content)
    .join("\n\n");

  // P2-3 G2 · 从 tool-group segments 中聚合 search_knowledge_base /
  // search_knowledge_graph_with_papers 的引用条目，挂到 ChatMessage.citations。
  const citations = useMemo(() => {
    const toolCalls: ToolCallInfo[] = [];
    for (const segment of block.segments) {
      if (segment.kind !== "tool-group") continue;
      for (const tool of segment.tools) {
        toolCalls.push({
          id: tool.id,
          name: tool.name,
          args: tool.args,
          result: tool.result,
          status: tool.status,
        });
      }
    }
    return extractCitationsFromToolCalls(toolCalls);
  }, [block.segments]);

  const messageWithCitations = useMemo(() => {
    if (citations.length === 0) return block.message;
    return { ...block.message, citations };
  }, [block.message, citations]);

  // P2-4 G3 · 抽取 reasoning steps，集中渲染到外置 ReasoningPanel（折叠/展开），
  // 避免 inline 与正文混排时挤占视觉。同 stepId 的去重在 ReasoningPanel.mergeSteps。
  const reasoningSteps = useMemo<ReasoningStepData[]>(() => {
    const out: ReasoningStepData[] = [];
    for (const segment of block.segments) {
      if (segment.kind !== "reasoning") continue;
      out.push({
        id: segment.id,
        stepId: segment.stepId,
        title: segment.title,
        phase: segment.phase,
        content: segment.content,
        result: segment.result,
      });
    }
    return out;
  }, [block.segments]);

  // ISSUE-070：检测「等待首个 token」的场景：所有 segments 都没有可见内容时，
  // 渲染三点脉冲动画作为占位，避免 UI 空白。
  // ISSUE-071：原实现把 `reasoning` 视为「立即可见」——但 `ne.a2ui.reasoning`
  // started 事件在流式开始的 100ms 内即下发空 reasoning step（仅 stepId/title），
  // 此时 reasoning content 还未累积，整个回复气泡仍是空白；占位永远不会渲染。
  // 重新定义「可见」：
  // - text：trim 后有内容；
  // - tool-group：tools 数组非空（tool_call_start 已建立条目）；
  // - reasoning：phase=finished 或 content/result 已有累积；started 仅有标题不算可见；
  // - error：任何错误段。
  const hasVisibleSegment = block.segments.some((segment) => {
    if (segment.kind === "text") return segment.content.trim().length > 0;
    if (segment.kind === "tool-group") return segment.tools.length > 0;
    if (segment.kind === "reasoning") {
      if (segment.phase === "finished") return true;
      const contentText = (segment.content ?? "").trim();
      // segment.result 类型为 unknown（来自后端任意 payload）；这里仅判断
      // 是否有「实际可见反馈」：字符串非空、非 null/undefined 的对象都算可见。
      const hasResult =
        segment.result !== null &&
        segment.result !== undefined &&
        (typeof segment.result !== "string" || segment.result.trim().length > 0);
      return contentText.length > 0 || hasResult;
    }
    if (segment.kind === "error") return true;
    if (segment.kind === "subagent-transfer") return true;
    return false;
  });
  const isReplyStreaming = block.segments.some(
    (segment) =>
      segment.kind === "text"
        ? segment.streaming
        : segment.kind === "tool-group"
          ? segment.status === "running"
          : false,
  );
  const showWaitingPlaceholder =
    !hasVisibleSegment && (isReplyStreaming || block.segments.length === 0);

  return (
    <MessageBubble
      message={messageWithCitations}
      isSelected={isSelected}
      onSelect={() => onSelect?.(block.nodeId)}
      actionContent={actionContent}
      body={
        <div className="space-y-3">
          {reasoningSteps.length > 0 ? <ReasoningPanel steps={reasoningSteps} /> : null}
          {showWaitingPlaceholder ? (
            <ChatTypingIndicator variant="inline" ariaLabel="Agent 正在思考" />
          ) : null}
          {block.segments.map((segment) => {
            if (segment.kind === "text") {
              return (
                <div key={segment.id}>
                  <MarkdownContent
                    content={segment.content}
                    isStreaming={segment.streaming}
                    citations={citations.length > 0 ? citations : undefined}
                  />
                </div>
              );
            }
            if (segment.kind === "tool-group") {
              return (
                <ToolExecutionGroup
                  key={segment.segmentId}
                  block={segment}
                  isSelected={isSelected && block.nodeId === segment.nodeId}
                  onSelect={onSelect}
                  variant="embedded"
                  progressMap={progressMap}
                />
              );
            }
            if (segment.kind === "reasoning") {
              // 已在外置 ReasoningPanel 中渲染（P2-4），此处跳过避免双重显示
              return null;
            }
            if (segment.kind === "subagent-transfer") {
              return (
                <SubAgentTransferCard key={segment.id} segment={segment} />
              );
            }
            return (
              <div
                key={segment.id}
                className={cn(
                  "rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
                  isSelected &&
                    "ring-1 ring-amber-300/70 dark:ring-amber-700/60",
                )}
                onClick={() => onSelect?.(segment.nodeId)}
              >
                <div className="font-semibold">{segment.title}</div>
                <div className="mt-1">{segment.message}</div>
              </div>
            );
          })}
        </div>
      }
    />
  );
}
