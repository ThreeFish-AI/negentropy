import { useEffect, useMemo, useRef } from "react";
import { AssistantReplyBubble } from "./AssistantReplyBubble";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { MessageBubble } from "./MessageBubble";
import { ToolExecutionGroup } from "./ToolExecutionGroup";
import { CHAT_CONTENT_RAIL_CLASS } from "./chat-layout";
import type { ConversationNode } from "@/types/a2ui";
import type { ToolProgressMap } from "@/types/common";
import { buildChatDisplayBlocks } from "@/utils/chat-display";
import { cn } from "@/lib/utils";

type ChatStreamProps = {
  nodes: ConversationNode[];
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string) => void;
  contentClassName?: string;
  scrollToBottomTrigger?: number;
  /**
   * Tool Progress 旁路（C3）— 由 home-body 从 snapshotForDisplay.tool_progress 提取，
   * 不参与 conversationTree / message-ledger，规避 ISSUE-031 时间窗双气泡风险。
   */
  toolProgressMap?: ToolProgressMap;
  /**
   * Stream 级 typing indicator 触发信号 —— 通常由父级根据
   * `effectiveConnection ∈ {'connecting','streaming'}` 派生。
   *
   * 隐藏规则：当末尾 displayBlock 已是 `assistant-reply` 时（无论是否已有可见内容），
   * stream 级 indicator 让位给 AssistantReplyBubble 内置 placeholder（同款三点动画），
   * 实现「请求真空期 → 气泡空 → 首块流入」的无缝接力，避免双 indicator 视觉重复。
   */
  pending?: boolean;
};

export function ChatStream({
  nodes,
  selectedNodeId,
  onNodeSelect,
  contentClassName,
  scrollToBottomTrigger,
  toolProgressMap,
  pending = false,
}: ChatStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserAtBottomRef = useRef(true);
  const visibleNodes = nodes.filter((node) => node.visibility !== "debug-only");
  // useMemo 避免每个 SSE chunk 触发时都重建 display blocks（buildChatDisplayBlocks
  // 涉及 6 层去重计算），减少不必要的子组件重渲与闪烁。
  const displayBlocks = useMemo(
    () =>
      buildChatDisplayBlocks({
        roots: visibleNodes,
        nodeIndex: new Map(),
        messageNodeIndex: new Map(),
        toolNodeIndex: new Map(),
      }),
    // visibleNodes 是 .filter() 产生的新数组引用，但内容变化时才需重建。
    // 依赖键需包含子节点内容长度，否则流式期间 id/status 不变但 payload.content
    // 持续追加 → useMemo 返回旧 blocks → 流式文本不可见。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(visibleNodes.map((n) => {
      const childFingerprint = n.children
        .map((c) => c.id + ':' + String(c.payload?.content ?? '').length)
        .join(',');
      return n.id + (n.status ?? '') + '[' + childFingerprint + ']';
    }))]
  );

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

  // Stream 级 typing indicator 显示判定：
  // - 父级声明 pending（effectiveConnection ∈ {connecting, streaming}）
  // - 末尾 displayBlock 不是 assistant-reply（一旦 Assistant 气泡挂载，
  //   就把展示职责让位给 AssistantReplyBubble 内置 placeholder，避免双 indicator）
  const lastBlock = displayBlocks[displayBlocks.length - 1];
  const showStandalonePending =
    pending && (!lastBlock || lastBlock.kind !== "assistant-reply");

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
          // 罕见路径：极慢首次会话，pending 已 true 但 hydration 尚未到达任何 block。
          // 此时仍优先显示 indicator，避免「发送指令开始对话」误导文案在用户已发送后出现。
          pending ? (
            <ChatTypingIndicator variant="standalone" />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted">
              发送指令开始对话。主区会按正文顺序展示消息，并把工具过程穿插在对应位置。
            </div>
          )
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
                progressMap={toolProgressMap}
              />
            ) : block.kind === "tool-group" ? (
              <ToolExecutionGroup
                key={block.id}
                block={block}
                isSelected={selectedNodeId === block.nodeId}
                onSelect={onNodeSelect}
                progressMap={toolProgressMap}
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
        {showStandalonePending && displayBlocks.length > 0 ? (
          <ChatTypingIndicator variant="standalone" />
        ) : null}
      </div>
    </div>
  );
}
