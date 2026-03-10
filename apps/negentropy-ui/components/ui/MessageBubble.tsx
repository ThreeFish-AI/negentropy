"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/common";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getStreamingMarkdownSegments } from "@/utils/streaming-markdown";
import { MermaidDiagram } from "./MermaidDiagram";
import { UserAvatar } from "./UserAvatar";

type ChatMessageProps = {
  message: ChatMessage;
  isSelected?: boolean;
  onSelect?: (messageId: string) => void;
  body?: ReactNode;
  actionContent?: string;
};

/**
 * 格式化时间戳为相对时间显示
 * @param timestamp Unix 时间戳（秒）
 * @returns 格式化后的时间字符串
 */
function formatTimestamp(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) {
    return "刚刚";
  }
  if (diff < 3600) {
    return `${Math.floor(diff / 60)}分钟前`;
  }
  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}小时前`;
  }
  if (diff < 604800) {
    return `${Math.floor(diff / 86400)}天前`;
  }
  // 超过一周显示具体日期
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

// ChatMessage.content 已经是字符串，不需要额外处理
function normalizeContent(content: string): string {
  return content;
}

function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1 text-muted hover:text-foreground rounded transition-colors"
        title="Copy"
      >
        {copied ? (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>

      <div className="w-px h-3 bg-border mx-1" />

      <button
        onClick={(e) => {
          e.stopPropagation();
          setFeedback(feedback === "like" ? null : "like");
        }}
        className={cn(
          "p-1 rounded transition-colors",
          feedback === "like"
            ? "text-success bg-success/10"
            : "text-muted hover:text-text-secondary",
        )}
        title="Good response"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
          />
        </svg>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setFeedback(feedback === "dislike" ? null : "dislike");
        }}
        className={cn(
          "p-1 rounded transition-colors",
          feedback === "dislike"
            ? "text-error bg-error/10"
            : "text-muted hover:text-text-secondary",
        )}
        title="Bad response"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.007L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
          />
        </svg>
      </button>
    </div>
  );
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-muted/50 text-muted hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
      title="Copy Code"
    >
      {copied ? (
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

export function MarkdownContent({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const segments = getStreamingMarkdownSegments(content, isStreaming);
  const renderMarkdown = (value: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const isMermaid = match && match[1] === "mermaid";
          // @ts-expect-error - 'inline' is sometimes passed by react-markdown but missing in types depending on version
          const isInline = props.inline;

          if (isMermaid) {
            return (
              <MermaidDiagram
                code={String(children).replace(/\n$/, "")}
              />
            );
          }

          if (!isInline && match) {
            return (
              <div className="relative group">
                <code className={className} {...props}>
                  {children}
                </code>
                <CopyButton code={String(children)} />
              </div>
            );
          }

          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        pre({ children }) {
          return <pre className="relative group">{children}</pre>;
        },
      }}
    >
      {value}
    </ReactMarkdown>
  );

  return (
    <div className="space-y-2">
      {segments.map((segment, index) =>
        segment.kind === "markdown" ? (
          <div key={`${segment.kind}-${index}`}>{renderMarkdown(segment.content)}</div>
        ) : (
          <div
            key={`${segment.kind}-${index}`}
            className="whitespace-pre-wrap break-words rounded-lg border border-dashed border-amber-300/70 bg-amber-50/60 px-3 py-2 text-sm leading-6 text-zinc-700 dark:border-amber-700/60 dark:bg-amber-950/20 dark:text-zinc-200"
          >
            {segment.content}
          </div>
        ),
      )}
    </div>
  );
}

export function MessageBubble({
  message,
  isSelected,
  onSelect,
  body,
  actionContent,
}: ChatMessageProps) {
  const { user } = useAuth();
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const content = normalizeContent(message.content);
  const isStreaming = message.streaming === true && !isUser && content.trim().length > 0;
  const avatarPositionClass = isUser
    ? "absolute right-0 top-2 translate-x-[calc(100%+0.75rem)]"
    : "absolute left-0 top-2 -translate-x-[calc(100%+0.75rem)]";

  if (isSystem) {
    return (
      <div className="flex justify-center py-4">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          System: {content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex w-full cursor-pointer rounded-[2rem] px-2 py-1 transition-colors duration-200",
        isUser ? "flex-row-reverse" : "flex-row",
        isSelected && "bg-[linear-gradient(90deg,rgba(245,158,11,0.10),transparent_75%)]",
      )}
      onClick={() => onSelect?.(message.id)}
    >
      <div className={cn("shrink-0", avatarPositionClass)}>
        {isUser ? (
          <UserAvatar
            picture={user?.picture}
            name={user?.name}
            email={user?.email}
            alt="Me"
            className="h-8 w-8 rounded-md object-cover"
            fallbackClassName="bg-foreground text-background text-xs"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card">
            <Image
              src="/logo.svg"
              alt="AI"
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex w-full flex-col",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-[1.6rem] px-5 py-3.5 text-sm shadow-sm transition-all duration-300",
            isUser
              ? "max-w-[85%] rounded-tr-md border border-zinc-900/90 bg-[linear-gradient(135deg,#18181b,#27272a)] text-zinc-50 shadow-[0_14px_34px_rgba(24,24,27,0.18)]"
              : "w-full max-w-full rounded-tl-md border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,244,245,0.9))] text-foreground shadow-[0_16px_40px_rgba(24,24,27,0.06)] dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.9))]",
            isStreaming &&
              "ring-1 ring-amber-300/70 shadow-[0_16px_46px_rgba(245,158,11,0.12)] dark:ring-amber-700/60",
          )}
        >
          <div
            className={cn(
              "overflow-hidden break-words whitespace-normal",
              "[&_p]:leading-6 [&_p]:my-0",
              "[&_p+*]:mt-3",
              "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
              "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
              "[&_li]:leading-snug",
              "[&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2",
              "[&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-2",
              "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-2",
              "[&_h1+*]:mt-2 [&_h2+*]:mt-2 [&_h3+*]:mt-2",
              "[&_br]:leading-6",
              "[&_code]:font-mono [&_code]:text-[0.9em]",
              !isUser &&
                "[&_code]:bg-muted [&_code]:text-accent-foreground [&_code]:px-1 [&_code]:rounded",
              isUser &&
                "[&_code]:bg-background/20 [&_code]:text-background [&_code]:px-1 [&_code]:rounded",
              "[&_pre]:bg-background/50 [&_pre]:text-foreground [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-2",
              "[&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0",
              "[&_a]:underline [&_a]:underline-offset-2",
              !isUser && "[&_a]:text-primary hover:[&_a]:text-primary/80",
              isUser && "[&_a]:text-background hover:[&_a]:text-background/80",
              // Table styles
              "[&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm",
              "[&_thead]:bg-muted/40",
              "[&_tbody_tr:nth-child(even)]:bg-muted/15",
              "[&_th]:border [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-left",
              "[&_td]:border [&_td]:px-3 [&_td]:py-2",
              !isUser &&
                "[&_th]:border-border [&_th]:bg-muted/50 [&_td]:border-border",
              isUser &&
                "[&_th]:border-border/20 [&_th]:bg-background/10 [&_td]:border-border/20",
            )}
          >
            {body || (
              <MarkdownContent
                content={content}
                isStreaming={isStreaming}
              />
            )}
            {isStreaming ? (
              <div className="mt-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-current" />
                <span>Streaming</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* 元信息栏：显示作者和时间戳 */}
        {!isUser && (message.author || message.timestamp || isStreaming) && (
          <div className="mt-2 flex items-center gap-2 px-1">
            {message.author && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                {message.author}
              </span>
            )}
            {message.timestamp && (
              <span className="text-[10px] text-muted-foreground">
                {formatTimestamp(message.timestamp)}
              </span>
            )}
            {isStreaming ? (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-300">
                实时生成中
              </span>
            ) : null}
          </div>
        )}

        {!isUser && <MessageActions content={actionContent || content} />}
      </div>
    </div>
  );
}
