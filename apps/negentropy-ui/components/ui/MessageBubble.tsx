"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";
import type { Message } from "@ag-ui/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// @ts-expect-error - no types for specific component import in this context or module resolution issue
import { MermaidDiagram } from "./MermaidDiagram";

type ChatMessageProps = {
  message: Pick<Message, "id" | "role" | "content">;
  isSelected?: boolean;
  onSelect?: (messageId: string) => void;
};

function normalizeContent(content: Message["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (c.type === "text") {
          return c.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

import { useState } from "react";

// ... (imports remain)

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
        className="p-1 text-zinc-400 hover:text-zinc-600 rounded transition-colors"
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

      <div className="w-px h-3 bg-zinc-200 mx-1" />

      <button
        onClick={(e) => {
          e.stopPropagation();
          setFeedback(feedback === "like" ? null : "like");
        }}
        className={cn(
          "p-1 rounded transition-colors",
          feedback === "like"
            ? "text-green-600 bg-green-50"
            : "text-zinc-400 hover:text-zinc-600",
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
            ? "text-red-600 bg-red-50"
            : "text-zinc-400 hover:text-zinc-600",
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
      className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100"
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

export function MessageBubble({ message, isSelected, onSelect }: ChatMessageProps) {
  const { user } = useAuth();
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const content = normalizeContent(message.content);

  if (isSystem) {
    return (
      <div className="flex justify-center py-4">
        <span className="text-xs text-zinc-400 bg-zinc-100 px-3 py-1 rounded-full">
          System: {content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full gap-4 group cursor-pointer", // Added cursor-pointer for clickability
        isUser ? "flex-row-reverse" : "flex-row",
        isSelected && "bg-zinc-100/50", // Highlight when selected
      )}
      onClick={() => onSelect?.(message.id)}
    >
      {/* Avatar */}
      <div className="shrink-0">
        {isUser ? (
          user?.picture ? (
            <img
              src={user.picture}
              alt="Me"
              className="w-8 h-8 rounded-full border border-zinc-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold">
              U
            </div>
          )
        ) : (
          <div className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center shadow-sm ring-2 ring-indigo-50/50 shrink-0 overflow-hidden">
            <img src="/logo.svg" alt="AI" className="w-5 h-5 object-contain" />
          </div>
        )}
      </div>

      {/* Bubble Container */}
      <div className="flex flex-col max-w-[85%]">
        <div
          className={cn(
            "rounded-2xl px-5 py-3 text-sm shadow-sm transition-all",
            isUser
              ? "bg-zinc-900 text-white rounded-tr-sm leading-relaxed"
              : "bg-white text-zinc-900 border border-zinc-200 rounded-tl-sm leading-snug",
          )}
        >
          <div
            className={cn(
              "space-y-2 overflow-hidden wrap-break-word",
              "[&>p]:leading-snug [&>p]:mb-2 [&>p:last-child]:mb-0",
              "[&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1",
              "[&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:space-y-1",
              "[&_li]:leading-snug",
              "[&>h1]:text-base [&>h1]:font-bold [&>h1]:mb-2",
              "[&>h2]:text-sm [&>h2]:font-bold [&>h2]:mb-2",
              "[&_code]:font-mono [&_code]:text-[0.9em]",
              !isUser &&
                "[&_code]:bg-zinc-100 [&_code]:text-pink-600 [&_code]:px-1 [&_code]:rounded",
              isUser &&
                "[&_code]:bg-zinc-800 [&_code]:text-zinc-200 [&_code]:px-1 [&_code]:rounded",
              "[&_pre]:bg-zinc-900 [&_pre]:text-zinc-50 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-2",
              "[&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0",
              "[&_a]:underline [&_a]:underline-offset-2",
              !isUser && "[&_a]:text-indigo-600 hover:[&_a]:text-indigo-500",
              isUser && "[&_a]:text-zinc-200 hover:[&_a]:text-white",
              // Table styles
              "[&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm",
              "[&_th]:border [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-left",
              "[&_td]:border [&_td]:px-3 [&_td]:py-2",
              !isUser &&
                "[&_th]:border-zinc-200 [&_th]:bg-zinc-50 [&_td]:border-zinc-200",
              isUser &&
                "[&_th]:border-zinc-700 [&_th]:bg-zinc-800 [&_td]:border-zinc-700",
            )}
          >
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
                        {/* Native code element will be rendered inside pre by default, but here we are inside code.
                             Actually, if we are in 'code' component, we are INSIDE the 'pre' if it's a block.
                             If we render a div here, we are inside pre.
                             Styling might be tricky.
                             Better approach: just use the pre style for the block, and add a copy button relative to it?
                             React-Markdown renders 'pre' then 'code'.
                             If we want to add a button, we ideally want to be properly positioned.
                             Let's just return the code as is, but maybe use 'pre' override?
                             No, 'pre' override is safer for the button placement.
                             Let's revert to simple code return here and override PRE.
                          */}
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
                // Override pre to handle positioning if needed, or just handle it in code.
                // Actually, doing it in 'code' inside 'pre' is messy because 'pre' has the background.
                // Let's rely on MessageBubble css for pre.
                // If I modify code to return a div, 'pre > div' is valid HTML5? No, pre should contain phrasing content (code).
                // But for React rendering it works visually.
                // Let's try to keeping it simple: Just add the button in 'code' and position it.
                // The 'pre' has relative positioning?
                pre({ children }) {
                  // Extract code string? Children of pre is code.
                  // It's hard to get the raw text easily from pre children if it's a React element.
                  // So doing it in 'code' is easier for accessing text.
                  // If we render a div inside pre, we might break the 'pre' scrolling or styling if not careful.
                  // Let's use a simpler approach: Just add the button in 'code' and position it.
                  // The 'pre' has relative positioning?
                  return <pre className="relative group">{children}</pre>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
        {!isUser && <MessageActions content={content} />}
      </div>
    </div>
  );
}
