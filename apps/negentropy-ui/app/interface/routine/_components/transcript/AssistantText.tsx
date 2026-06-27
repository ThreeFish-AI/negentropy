"use client";

import { Brain } from "lucide-react";

import { MarkdownText } from "../MarkdownText";
import type { TranscriptItem } from "./types";

/**
 * Claude Code 的 assistant 文本 —— 行内流式 Markdown（无气泡、无逐行头像）。
 * thinking（推理）以灰显 Brain 前缀 + 斜体呈现，与正式回复区分。
 */
export function AssistantText({ item }: { item: Extract<TranscriptItem, { kind: "assistant" }> }) {
  if (item.thinking) {
    return (
      <div className="flex gap-1.5">
        <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
        <MarkdownText content={item.text} className="italic [&_p]:text-text-secondary" />
      </div>
    );
  }
  // 正文提亮至 foreground，贴合 paseo 中栏对比度
  return <MarkdownText content={item.text} className="[&_li]:text-foreground [&_p]:text-foreground" />;
}
