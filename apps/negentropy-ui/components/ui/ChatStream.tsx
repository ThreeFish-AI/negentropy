/* eslint-disable react-hooks/use-memo --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Sparkles } from "lucide-react";
import { AssistantReplyBubble } from "./AssistantReplyBubble";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { EmptyState } from "./EmptyState";
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
  /** 搜索高亮节点集合（由 G2 对话搜索功能传入） */
  highlightedNodeIds?: Set<string>;
  /** 滚动到指定节点（由搜索导航触发，节点 ID 变化时自动 scrollIntoView） */
  scrollToNodeId?: string | null;
};

export function ChatStream({
  nodes,
  selectedNodeId,
  onNodeSelect,
  contentClassName,
  scrollToBottomTrigger,
  toolProgressMap,
  pending = false,
  highlightedNodeIds,
  scrollToNodeId,
}: ChatStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserAtBottomRef = useRef(true);
  // 「回到底部」浮钮可见性：用户上滑超过阈值时显示。
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
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
    setShowJumpToBottom(distanceToBottom > 200);
  };

  const scrollToBottom = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    isUserAtBottomRef.current = true;
    setShowJumpToBottom(false);
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

  // G2 对话搜索：当 scrollToNodeId 变化时，平滑滚动到目标节点。
  useEffect(() => {
    if (!scrollToNodeId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-node-id="${CSS.escape(scrollToNodeId)}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [scrollToNodeId]);

  // Stream 级 typing indicator 显示判定：
  // - 父级声明 pending（effectiveConnection ∈ {connecting, streaming}）
  // - 末尾 displayBlock 不是 assistant-reply（一旦 Assistant 气泡挂载，
  //   就把展示职责让位给 AssistantReplyBubble 内置 placeholder，避免双 indicator）
  const lastBlock = displayBlocks[displayBlocks.length - 1];
  const showStandalonePending =
    pending && (!lastBlock || lastBlock.kind !== "assistant-reply");

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
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
            <EmptyState
                icon={Sparkles}
                title="开始一段对话"
                description="发送指令即可开始。消息按正文顺序展示，工具调用过程会穿插在对应位置。"
                tone="accent"
                className="min-h-[55vh]"
              />
          )
        ) : (
          displayBlocks.map((block) => {
            // G2 搜索高亮类：当前节点在 highlightedNodeIds 中时添加黄色 ring。
            const highlightCls =
              highlightedNodeIds?.has(block.nodeId)
                ? "ring-2 ring-yellow-400/70 rounded-lg"
                : "";

            return block.kind === "message" ? (
              <div
                key={block.id}
                data-node-id={block.nodeId}
                className={highlightCls}
              >
                <MessageBubble
                  message={block.message}
                  isSelected={selectedNodeId === block.nodeId}
                  onSelect={() => onNodeSelect?.(block.nodeId)}
                />
              </div>
            ) : block.kind === "assistant-reply" ? (
              <div
                key={block.id}
                data-node-id={block.nodeId}
                className={highlightCls}
              >
                <AssistantReplyBubble
                  block={block}
                  isSelected={selectedNodeId === block.nodeId}
                  onSelect={onNodeSelect}
                  progressMap={toolProgressMap}
                />
              </div>
            ) : block.kind === "tool-group" ? (
              <div
                key={block.id}
                data-node-id={block.nodeId}
                className={highlightCls}
              >
                <ToolExecutionGroup
                  block={block}
                  isSelected={selectedNodeId === block.nodeId}
                  onSelect={onNodeSelect}
                  progressMap={toolProgressMap}
                />
              </div>
            ) : block.kind === "error" ? (
              <div
                key={block.id}
                data-node-id={block.nodeId}
                className={cn(
                  "rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
                  selectedNodeId === block.nodeId && "ring-2 ring-ring",
                  highlightCls,
                )}
                onClick={() => onNodeSelect?.(block.nodeId)}
              >
                <div className="font-semibold">{block.title}</div>
                <div className="mt-1">{block.message}</div>
              </div>
            ) : block.kind === "turn-status" ? (
              <div
                key={block.id}
                data-node-id={block.nodeId}
                className={cn(
                  "rounded-2xl border border-dashed border-border bg-border-muted/40 px-4 py-3 text-sm text-text-secondary",
                  selectedNodeId === block.nodeId && "ring-2 ring-ring",
                  highlightCls,
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
                data-node-id={block.nodeId}
                className={cn(
                  "rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm",
                  selectedNodeId === block.nodeId && "ring-2 ring-ring",
                  highlightCls,
                )}
                onClick={() => onNodeSelect?.(block.nodeId)}
              >
                <div className="font-semibold text-text-primary">
                  {block.title}
                </div>
                {block.lines.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {block.lines.map((line) => (
                      <div key={line} className="text-xs text-text-muted">
                        {line}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        {showStandalonePending && displayBlocks.length > 0 ? (
          <ChatTypingIndicator variant="standalone" />
        ) : null}
      </div>
    </div>
      {showJumpToBottom ? (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="回到底部"
          className="absolute bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-text-secondary shadow-md backdrop-blur transition-[color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:text-text-primary hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          回到底部
        </button>
      ) : null}
    </div>
  );
}
