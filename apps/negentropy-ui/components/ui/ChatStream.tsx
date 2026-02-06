import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "@ag-ui/core";
import type { ChatMessage } from "@/types/common";

type ChatStreamProps = {
  messages: ChatMessage[];
  selectedMessageId?: string | null;
  onMessageSelect?: (messageId: string) => void;
};

export function ChatStream({ messages, selectedMessageId, onMessageSelect }: ChatStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sticky scroll logic
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const isAtBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 100;

    // Use requestAnimationFrame to ensure we scroll after DOM update
    if (isAtBottom) {
      // Ideally we want to scroll *after* rendering.
      // But here we rely on the fact that if they were at bottom, we keep them there
      // actually, isAtBottom needs to be checked BEFORE the update?
      // The effect runs AFTER the update (new message rendered).
      // So 'scrollTop' is the OLD position (mostly), but 'scrollHeight' is NEW?
      // No, layout happens before effect.
      // So isAtBottom will be FALSE if content grew?
      // Correct approach:
      // We need to use LayoutEffect or store 'wasAtBottom' in a ref before render?
      // Or simpler: just scroll to bottom if we are *close* to bottom.
      element.scrollTop = element.scrollHeight;
    }
    // Alternatively, just force scroll if it's a new message and user hasn't scrolled up far?
    // Let's use a simpler heuristic for now: always scroll if near bottom.
    // But since this effect runs AFTER render, the content has already expanded.
    // So 'element.scrollTop' is effectively "scrolled up" relative to new height.
    // So we check if (scrollHeight - scrollTop - clientHeight) is basically equal to the *added content height*?
    // That's hard.

    // Better strategy:
    // Auto-scroll on mount.
    // For updates: scroll ONLY if the user was at bottom *before* update.
    // We need useLayoutEffect or a ref updated on scroll events.
  }, [messages]);

  // Let's implement robust version:
  const isUserAtBottomRef = useRef(true);

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
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
    >
      {messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          发送指令开始对话。事件流将实时展示在右侧。
        </div>
      ) : (
        messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isSelected={message.id === selectedMessageId}
            onSelect={onMessageSelect}
          />
        ))
      )}
    </div>
  );
}
