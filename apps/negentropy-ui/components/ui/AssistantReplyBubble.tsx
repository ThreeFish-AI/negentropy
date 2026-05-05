"use client";

import { useMemo } from "react";
import type { AssistantReplyDisplayBlock } from "@/types/a2ui";
import type { ToolCallInfo, ToolProgressMap } from "@/types/common";
import { MessageBubble, MarkdownContent } from "@/components/ui/MessageBubble";
import { ReasoningPanel, type ReasoningStepData } from "@/components/ui/ReasoningPanel";
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
      });
    }
    return out;
  }, [block.segments]);

  return (
    <MessageBubble
      message={messageWithCitations}
      isSelected={isSelected}
      onSelect={() => onSelect?.(block.nodeId)}
      actionContent={actionContent}
      body={
        <div className="space-y-3">
          {reasoningSteps.length > 0 ? <ReasoningPanel steps={reasoningSteps} /> : null}
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
