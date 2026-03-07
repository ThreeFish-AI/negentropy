import { useEffect, useRef } from "react";
import { ConversationNodeRenderer } from "./conversation/ConversationNodeRenderer";
import type { ConversationNode } from "@/types/a2ui";

type ChatStreamProps = {
  nodes: ConversationNode[];
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string) => void;
  contentClassName?: string;
};

export function ChatStream({
  nodes,
  selectedNodeId,
  onNodeSelect,
  contentClassName,
}: ChatStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserAtBottomRef = useRef(true);
  const visibleNodes = nodes.filter((node) => node.visibility !== "debug-only");

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

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto custom-scrollbar"
    >
      <div
        className={`mx-auto w-full space-y-4 py-6 ${contentClassName ?? ""}`}
      >
        {visibleNodes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted">
            发送指令开始对话。主区将以 A2UI 模块树实时展示消息、工具、活动与状态。
          </div>
        ) : (
          visibleNodes.map((node) => (
            <ConversationNodeRenderer
              key={node.id}
              node={node}
              depth={0}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
