import { useEffect, useRef } from "react";
import { AssistantReplyBubble } from "./AssistantReplyBubble";
import { MessageBubble } from "./MessageBubble";
import { ToolExecutionGroup } from "./ToolExecutionGroup";
import { CHAT_CONTENT_RAIL_CLASS } from "./chat-layout";
import type { ConversationNode } from "@/types/a2ui";
import { buildChatDisplayBlocks } from "@/utils/chat-display";
import { cn } from "@/lib/utils";

type ChatStreamProps = {
  nodes: ConversationNode[];
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string) => void;
  contentClassName?: string;
  scrollToBottomTrigger?: number;
};

export function ChatStream({
  nodes,
  selectedNodeId,
  onNodeSelect,
  contentClassName,
  scrollToBottomTrigger,
}: ChatStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserAtBottomRef = useRef(true);
  const visibleNodes = nodes.filter((node) => node.visibility !== "debug-only");
  const displayBlocks = buildChatDisplayBlocks({
    roots: visibleNodes,
    nodeIndex: new Map(),
    messageNodeIndex: new Map(),
    toolNodeIndex: new Map(),
  });

  const onScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    isUserAtBottomRef.current = distanceToBottom < 50;
  };

  useEffect(() => {
    if (isUserAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleNodes]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scrollToBottomTrigger]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto custom-scrollbar"
    >
      <div
        className={`${CHAT_CONTENT_RAIL_CLASS} space-y-4 py-6 ${contentClassName ?? ""}`}
      >
        {displayBlocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted">
            发送指令开始对话。主区会按正文顺序展示消息，并把工具过程穿插在对应位置。
          </div>
        ) : (
          displayBlocks.map((block) => (
            block.kind === "message" ? (
              <MessageBubble
                key={block.id}
                message={block.message}
                isSelected={selectedNodeId === block.nodeId}
                onSelect={() => onNodeSelect?.(block.nodeId)}
              />
            ) : block.kind === "assistant-reply" ? (
              <AssistantReplyBubble
                key={block.id}
                block={block}
                isSelected={selectedNodeId === block.nodeId}
                onSelect={onNodeSelect}
              />
            ) : block.kind === "tool-group" ? (
              <ToolExecutionGroup
                key={block.id}
                block={block}
                isSelected={selectedNodeId === block.nodeId}
                onSelect={onNodeSelect}
              />
            ) : block.kind === "error" ? (
              <div
                key={block.id}
                className={cn(
                  "rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
                  selectedNodeId === block.nodeId &&
                    "ring-1 ring-amber-300/70 dark:ring-amber-700/60",
                )}
                onClick={() => onNodeSelect?.(block.nodeId)}
              >
                <div className="font-semibold">{block.title}</div>
                <div className="mt-1">{block.message}</div>
              </div>
            ) : block.kind === "turn-status" ? (
              <div
                key={block.id}
                className={cn(
                  "rounded-2xl border border-dashed border-zinc-200/80 bg-zinc-100/55 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/35 dark:text-zinc-300",
                  selectedNodeId === block.nodeId &&
                    "ring-1 ring-amber-300/70 dark:ring-amber-700/60",
                )}
                onClick={() => onNodeSelect?.(block.nodeId)}
              >
                <div className="font-semibold">{block.title}</div>
                {block.detail ? (
                  <div className="mt-1">{block.detail}</div>
                ) : null}
              </div>
            ) : (
              <div
                key={block.id}
                className={cn(
                  "rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
                  selectedNodeId === block.nodeId &&
                    "ring-1 ring-amber-300/70 dark:ring-amber-700/60",
                )}
                onClick={() => onNodeSelect?.(block.nodeId)}
              >
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {block.title}
                </div>
                {block.lines.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {block.lines.map((line) => (
                      <div
                        key={line}
                        className="text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
}
