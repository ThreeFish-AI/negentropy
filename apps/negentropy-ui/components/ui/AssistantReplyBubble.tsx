"use client";

import type { AssistantReplyDisplayBlock } from "@/types/a2ui";
import type { ToolProgressMap } from "@/types/common";
import { MessageBubble, MarkdownContent } from "@/components/ui/MessageBubble";
import { ReasoningStep } from "@/components/ui/ReasoningStep";
import { ToolExecutionGroup } from "@/components/ui/ToolExecutionGroup";
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

  return (
    <MessageBubble
      message={block.message}
      isSelected={isSelected}
      onSelect={() => onSelect?.(block.nodeId)}
      actionContent={actionContent}
      body={
        <div className="space-y-3">
          {block.segments.map((segment) => {
            if (segment.kind === "text") {
              return (
                <div key={segment.id}>
                  <MarkdownContent
                    content={segment.content}
                    isStreaming={segment.streaming}
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
              return (
                <ReasoningStep
                  key={segment.id}
                  title={segment.title}
                  phase={segment.phase}
                  stepId={segment.stepId}
                />
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
