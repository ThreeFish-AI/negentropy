"use client";

/**
 * ChatMessage —— 单条消息渲染。
 *
 * 流式期间渲染纯文本 + 闪烁光标，避免 ReactMarkdown 重渲染抖动；
 * RUN_FINISHED 后切到完整 Markdown + remark-wiki-link 解析。
 */
import { useMemo, type ReactElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { ChatMessage as ChatMessageData } from "@/lib/agent-chat/use-chat-agent";
import { remarkWikiLink } from "@/lib/agent-chat/remark-wiki-link";

interface ChatMessageProps {
  message: ChatMessageData;
}

const MARKDOWN_COMPONENTS: Components = {
  a({ href, children, ...props }) {
    // remark-wiki-link 通过 hProperties 标记 data-wiki-link
    const wikiLink = (props as { "data-wiki-link"?: string })["data-wiki-link"];
    if (wikiLink && wikiLink.startsWith("/")) {
      return (
        <Link href={wikiLink} className="wiki-agent-chat-msg__wikilink">
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export function ChatMessageView({ message }: ChatMessageProps): ReactElement {
  const isUser = message.role === "user";
  const klass = isUser
    ? "wiki-agent-chat-msg wiki-agent-chat-msg--user"
    : "wiki-agent-chat-msg wiki-agent-chat-msg--assistant";

  // 流式期间用纯文本（避免每个 token 触发完整 Markdown 重渲染）；
  // 终态后再切到完整 Markdown 解析（含 [[wiki:]] 占位符）。
  const body = useMemo(() => {
    if (isUser) {
      return <div className="wiki-agent-chat-msg__plain">{message.content}</div>;
    }
    if (message.streaming) {
      return (
        <div className="wiki-agent-chat-msg__plain">
          {message.content}
          <span className="wiki-agent-chat-msg__cursor" aria-hidden>
            ▍
          </span>
        </div>
      );
    }
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkWikiLink]}
        components={MARKDOWN_COMPONENTS}
      >
        {message.content}
      </ReactMarkdown>
    );
  }, [isUser, message.content, message.streaming]);

  return (
    <div className={klass}>
      {!isUser && message.agentName ? (
        <div className="wiki-agent-chat-msg__author">{message.agentName}</div>
      ) : null}
      <div className="wiki-agent-chat-msg__body">{body}</div>
    </div>
  );
}
