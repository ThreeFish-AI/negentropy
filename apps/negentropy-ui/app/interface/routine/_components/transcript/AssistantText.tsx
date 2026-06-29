"use client";

import { useState } from "react";
import { AlertTriangle, Brain, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { MarkdownText } from "../MarkdownText";
import type { TranscriptItem } from "./types";

/** CC 自报交互异常的模式（如 AskUserQuestion 在 headless 下被 CLI 报错）——命中则红显，让断链可见。 */
const CC_ERROR_RE = /returned an error|AskUserQuestion.*\berror\b|tool_use_id.*not found/i;

/**
 * Claude Code 的 assistant 文本。
 *
 * - **交互异常**（匹配 ``CC_ERROR_RE``，如 "The AskUserQuestion returned an error"）：红显 + ⚠ 图标，
 *   让人机交互断链可见（驱动后端修复）。
 * - **thinking（推理）**：默认折叠为单行「思考…」，点击展开——避免长推理刷屏、淹没人机回合主线。
 * - **正文**：行内流式 Markdown，提亮至 foreground。
 */
export function AssistantText({ item }: { item: Extract<TranscriptItem, { kind: "assistant" }> }) {
  if (CC_ERROR_RE.test(item.text)) {
    return (
      <div className="flex gap-1.5 rounded-md border border-red-500/25 bg-red-500/[0.05] px-2 py-1.5">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
        <MarkdownText content={item.text} className="[&_p]:text-red-600 dark:[&_p]:text-red-400" />
      </div>
    );
  }
  if (item.thinking) {
    return <ThinkingText text={item.text} />;
  }
  // 正文提亮至 foreground，贴合 paseo 中栏对比度
  return <MarkdownText content={item.text} className="[&_li]:text-foreground [&_p]:text-foreground" />;
}

/** 可折叠的 thinking 推理片段——默认收起为单行，点击展开全文。 */
function ThinkingText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-caption text-text-muted transition-colors hover:bg-muted/40 hover:text-text-secondary"
      >
        <Brain className="h-3.5 w-3.5" aria-hidden />
        <span>{open ? "思考展开" : "思考…"}</span>
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} aria-hidden />
      </button>
      {open ? <MarkdownText content={text} className="mt-0.5 italic [&_p]:text-text-secondary" /> : null}
    </div>
  );
}
