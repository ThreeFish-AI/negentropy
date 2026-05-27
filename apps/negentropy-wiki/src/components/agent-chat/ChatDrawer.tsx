"use client";

/**
 * ChatDrawer —— 右下角聊天面板主体。
 *
 * a11y：role="dialog" + aria-modal；Esc 关闭；focus-trap 简化为初次打开时
 * 聚焦输入框（避免引入第三方 focus-trap 依赖）。
 */
import { useEffect, useRef, useState } from "react";
import { useChatAgent } from "@/lib/agent-chat/use-chat-agent";
import { useSubAgents } from "@/lib/agent-chat/use-subagents";
import { useWikiPageContext } from "@/lib/agent-chat/page-context";
import { useWikiAuth } from "@/lib/auth/wiki-auth";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageView } from "./ChatMessage";

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ChatDrawer({ open, onClose }: ChatDrawerProps) {
  const pageContext = useWikiPageContext();
  const { rootAgent, faculties, error: subAgentError } = useSubAgents();
  const { user } = useWikiAuth();
  const [preferredAgentName, setPreferredAgentName] = useState<string | null>(
    null,
  );
  const chat = useChatAgent({
    defaultAgentName: rootAgent?.name ?? null,
    preferredAgentName,
    pageContext,
    userId: user?.userId ?? null,
  });

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const composerWrapRef = useRef<HTMLDivElement | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const candidates = rootAgent ? [rootAgent, ...faculties] : faculties;

  // 滚到底（新消息时）
  useEffect(() => {
    if (!open) return;
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages.length, open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // 打开时把焦点送到 composer textarea
  useEffect(() => {
    if (!open) return;
    const ta = composerWrapRef.current?.querySelector("textarea");
    ta?.focus();
  }, [open]);

  if (!open) return null;

  const handleSend = (text: string) => {
    chat.send(text);
  };

  return (
    <div
      ref={dialogRef}
      className="wiki-agent-chat-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Agents at Wiki 对话面板"
    >
      <header className="wiki-agent-chat-drawer__header">
        <div className="wiki-agent-chat-drawer__title">
          一主五翼 · Agents
        </div>
        <button
          type="button"
          className="wiki-agent-chat-drawer__close"
          onClick={onClose}
          aria-label="关闭对话"
        >
          ✕
        </button>
      </header>
      <div className="wiki-agent-chat-drawer__messages" role="log">
        {chat.messages.length === 0 ? (
          <div className="wiki-agent-chat-drawer__empty">
            <p>
              欢迎使用 Agents at Wiki。默认对话主 Agent
              {rootAgent ? `「${rootAgent.displayName}」` : ""}；
              输入 <kbd>@</kbd> 可切换到五翼任一 Agent
              （Perception / Internalization / Contemplation / Action / Influence）。
            </p>
            {pageContext.title ? (
              <p className="wiki-agent-chat-drawer__page-hint">
                当前页：<strong>{pageContext.title}</strong>
              </p>
            ) : null}
          </div>
        ) : (
          chat.messages.map((m) => <ChatMessageView key={m.id} message={m} />)
        )}
        {chat.error ? (
          <div className="wiki-agent-chat-drawer__error" role="alert">
            {chat.error}
          </div>
        ) : null}
        {subAgentError ? (
          <div className="wiki-agent-chat-drawer__error" role="alert">
            无法加载 Agent 列表：{subAgentError}
          </div>
        ) : null}
        <div ref={listEndRef} />
      </div>
      <div
        ref={composerWrapRef}
        className="wiki-agent-chat-drawer__composer-wrap"
      >
        <ChatComposer
          candidates={candidates}
          streaming={chat.status === "streaming"}
          onSend={handleSend}
          onAbort={chat.abort}
          onPreferredAgentChange={setPreferredAgentName}
        />
      </div>
    </div>
  );
}
