"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";
import type { Message } from "@ag-ui/core";
import { micromark } from "micromark";

type ChatMessageProps = {
  message: Pick<Message, "id" | "role" | "content">;
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

export function MessageBubble({ message }: ChatMessageProps) {
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

  // Render markdown safely-ish (assuming internal trusting agent)
  const htmlContent = micromark(content);

  return (
    <div
      className={cn(
        "flex w-full gap-4",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
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
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm ring-2 ring-indigo-50 tracking-wider shrink-0">
            NE
          </div>
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-sm transition-all",
          isUser
            ? "bg-zinc-900 text-white rounded-tr-sm leading-relaxed"
            : "bg-white text-zinc-900 border border-zinc-200 rounded-tl-sm leading-snug",
        )}
      >
        <div
          className={cn(
            "space-y-2 overflow-hidden break-words",
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
          )}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
}
