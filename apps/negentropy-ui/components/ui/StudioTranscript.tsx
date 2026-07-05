import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, Sparkles } from "lucide-react";

import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { ChatWelcome, type ChatSuggestion } from "./ChatWelcome";
import { EmptyState } from "./EmptyState";
import { CHAT_CONTENT_RAIL_CLASS } from "./chat-layout";
import { buildStudioTranscript } from "./studio-transcript/build-studio-transcript";
import { STUDIO_POLICY, TranscriptItemsView, type TranscriptItem } from "@/components/transcript";
import { buildChatDisplayBlocks } from "@/utils/chat-display";
import { cn } from "@/lib/utils";
import type { ConversationNode } from "@/types/a2ui";
import type { ToolProgressMap } from "@/types/common";

type StudioTranscriptProps = {
  nodes: ConversationNode[];
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string) => void;
  contentClassName?: string;
  scrollToBottomTrigger?: number;
  /** Tool Progress 旁路（C3）— 同 ChatStream。 */
  toolProgressMap?: ToolProgressMap;
  /** Stream 级 typing indicator 触发信号（effectiveConnection ∈ {connecting, streaming}）。 */
  pending?: boolean;
  /** 搜索高亮节点集合（G2 对话搜索）。 */
  highlightedNodeIds?: Set<string>;
  /** 滚动到指定节点（搜索导航）。 */
  scrollToNodeId?: string | null;
  /** 空态欢迎区。 */
  suggestions?: ChatSuggestion[];
  onSuggestionPick?: (prompt: string) => void;
  welcomeUserName?: string | null;
};

/**
 * Home / Studio 中栏「人机交互」对话——基于共享 ``TranscriptItemsView`` + ``STUDIO_POLICY``。
 *
 * 语义：人 = 真实用户（``user``，居右）；机 = 一核五翼 + Claude Code（带 per-agent 徽章，居左）。
 * 复用 Routine 转录渲染器（类型化工具卡 / ≥3 折叠 / thinking 折叠 / WorkingIndicator），
 * 数据经 ``buildChatDisplayBlocks → buildStudioTranscript`` 适配为 ``TranscriptItem[]``。
 * 滚动容器 / Jump-to-Bottom / 空态 / 节点选中 / 搜索高亮等 chrome 原样沿用 ChatStream 行为。
 */
export function StudioTranscript({
  nodes,
  selectedNodeId,
  onNodeSelect,
  contentClassName,
  scrollToBottomTrigger,
  toolProgressMap,
  pending = false,
  highlightedNodeIds,
  scrollToNodeId,
  suggestions,
  onSuggestionPick,
  welcomeUserName,
}: StudioTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserAtBottomRef = useRef(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const visibleNodes = nodes.filter((node) => node.visibility !== "debug-only");

  // 同 ChatStream：fingerprint 须含子内容长度，否则流式文本不可见。
  const nodesFingerprint = JSON.stringify(
    visibleNodes.map((n) => {
      const childFingerprint = n.children
        .map((c) => c.id + ":" + String(c.payload?.content ?? "").length)
        .join(",");
      return n.id + (n.status ?? "") + "[" + childFingerprint + "]";
    }),
  );
  const displayBlocks = useMemo(
    () =>
      buildChatDisplayBlocks({
        roots: visibleNodes,
        nodeIndex: new Map(),
        messageNodeIndex: new Map(),
        toolNodeIndex: new Map(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodesFingerprint],
  );

  const items = useMemo(
    () => buildStudioTranscript(displayBlocks, { progressMap: toolProgressMap }),
    [displayBlocks, toolProgressMap],
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

  useEffect(() => {
    if (!scrollToNodeId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-node-id="${CSS.escape(scrollToNodeId)}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [scrollToNodeId]);

  // 在途指示器显示判定（对齐 ChatStream showStandalonePending）：
  // 末项为流式 assistant 文本时让位给内联流式渲染，避免双 indicator。
  const lastItem = items[items.length - 1];
  const lastIsStreamingAssistant =
    !!lastItem &&
    lastItem.kind === "assistant" &&
    (lastItem.streaming === true || lastItem.thinking);
  const live = pending && !lastIsStreamingAssistant;

  // per-item 包裹：挂 data-node-id / 选中环 / 搜索高亮 / onClick（Studio 专属）。
  // user / 非思考 assistant 文本项额外挂 ``data-testid="message-bubble"`` +
  // ``data-message-role``，保持与旧 MessageBubble 选择器兼容（双气泡守卫等 E2E 复用）。
  const itemWrapper = (item: TranscriptItem, children: ReactNode): ReactNode => {
    const nodeId = "nodeId" in item ? item.nodeId : undefined;
    const isUserMsg = item.kind === "user";
    const isAssistantMsg = item.kind === "assistant" && !item.thinking;
    const testid = isUserMsg || isAssistantMsg ? "message-bubble" : undefined;
    const messageRole = isUserMsg ? "user" : isAssistantMsg ? "assistant" : undefined;
    const isSelected = nodeId ? selectedNodeId === nodeId : false;
    const isHighlighted = nodeId ? highlightedNodeIds?.has(nodeId) : false;
    return (
      <div
        data-node-id={nodeId}
        data-testid={testid}
        data-message-role={messageRole}
        onClick={nodeId ? () => onNodeSelect?.(nodeId) : undefined}
        className={cn(
          "rounded-lg",
          isSelected && "ring-2 ring-ring",
          isHighlighted && "ring-2 ring-yellow-400/70",
        )}
      >
        {children}
      </div>
    );
  };

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto custom-scrollbar">
        <div className={`${CHAT_CONTENT_RAIL_CLASS} space-y-4 py-6 ${contentClassName ?? ""}`}>
          {items.length === 0 ? (
            pending ? (
              <ChatTypingIndicator variant="standalone" />
            ) : onSuggestionPick ? (
              <ChatWelcome
                userName={welcomeUserName}
                suggestions={suggestions ?? []}
                onPick={onSuggestionPick}
              />
            ) : (
              <EmptyState
                icon={Sparkles}
                title="开始一段对话"
                description="发送指令即可开始。人（你）居右、机（一核五翼 + Claude Code）居左，工具调用过程穿插在对应位置。"
                tone="accent"
                className="min-h-[55vh]"
              />
            )
          ) : (
            <TranscriptItemsView
              items={items}
              policy={STUDIO_POLICY}
              live={live}
              itemWrapper={itemWrapper}
            />
          )}
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
