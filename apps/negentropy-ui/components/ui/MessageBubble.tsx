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
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm ring-2 ring-indigo-50">
            AI
          </div>
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm transition-all",
          isUser
            ? "bg-zinc-900 text-white rounded-tr-sm"
            : "bg-white text-zinc-900 border border-zinc-200 rounded-tl-sm",
        )}
      >
        <div
          className="prose-custom whitespace-pre-wrap [&>p]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>code]:bg-black/10 [&>code]:rounded [&>code]:px-1 [&_pre]:bg-zinc-900 [&_pre]:text-white [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
}
