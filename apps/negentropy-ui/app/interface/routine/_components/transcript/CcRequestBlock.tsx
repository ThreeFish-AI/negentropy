"use client";

import { useState } from "react";
import { ChevronRight, FileText, HelpCircle, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";

import { MarkdownText } from "../MarkdownText";
import type { CcRequestMode, TranscriptItem } from "./types";

/** mode → 卡片标题 + 图标（对齐 Conductor「Review plan」/「Answer question」范式）。 */
function modeMeta(mode: CcRequestMode): { title: string; icon: typeof FileText } {
  switch (mode) {
    case "exit_plan":
      return { title: "Exit plan mode", icon: LogOut };
    case "plan_submit":
      return { title: "Review plan", icon: FileText };
    case "question":
      return { title: "Answer question", icon: HelpCircle };
  }
}

/** 单个问题（AskUserQuestion.questions[]）的轻量渲染。 */
function QuestionItem({ q }: { q: unknown }) {
  if (typeof q === "string") return <li className="text-body text-foreground">{q}</li>;
  if (q && typeof q === "object") {
    const r = q as Record<string, unknown>;
    const text = typeof r.question === "string" ? r.question : typeof r.header === "string" ? r.header : null;
    const options = Array.isArray(r.options) ? r.options : null;
    return (
      <li className="space-y-1">
        {text ? <div className="text-body text-foreground">{text}</div> : null}
        {options && options.length > 0 ? (
          <ul className="ml-3 list-disc space-y-0.5">
            {options.map((opt, i) => {
              const label =
                typeof opt === "string"
                  ? opt
                  : opt && typeof opt === "object"
                    ? String((opt as Record<string, unknown>).label ?? "")
                    : "";
              return label ? (
                <li key={i} className="text-caption text-text-secondary">
                  {label}
                </li>
              ) : null;
            })}
          </ul>
        ) : null}
      </li>
    );
  }
  return null;
}

/**
 * CC 向「人」提交 Plan / 问题的待决卡片（machine → human，居左）。
 *
 * 对齐 Conductor 的 pending 卡片范式：标题（Review plan / Answer question）以主强调色（indigo）
 * 高亮 + 工具图标，下接提交正文（ExitPlanMode 的规划文本 / AskUserQuestion 的问题列表）。
 * ``pending`` 态（在途且无配对应答）以脉冲点示意「等待人裁决」。
 */
export function CcRequestBlock({ item }: { item: Extract<TranscriptItem, { kind: "cc_request" }> }) {
  const { mode, body, pending } = item;
  const meta = modeMeta(mode);
  const Icon = meta.icon;
  const hasText = !!body.text?.trim();
  const hasQuestions = Array.isArray(body.questions) && body.questions.length > 0;
  const [open, setOpen] = useState(true);
  const collapsible = hasText || hasQuestions;

  return (
    <div className="min-w-0 max-w-[92%] overflow-hidden rounded-xl border border-primary/30 bg-primary/[0.04]">
      <button
        type="button"
        onClick={() => collapsible && setOpen((v) => !v)}
        aria-expanded={collapsible ? open : undefined}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left",
          collapsible ? "cursor-pointer hover:bg-primary/[0.07]" : "cursor-default",
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="text-body font-semibold text-primary">{meta.title}</span>
        {pending ? (
          <span className="ml-1 inline-flex items-center gap-1 text-caption text-text-muted">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            等待裁决
          </span>
        ) : null}
        <span className="flex-1" />
        {collapsible ? (
          <ChevronRight
            className={cn("h-3.5 w-3.5 shrink-0 text-text-muted transition-transform", open && "rotate-90")}
            aria-hidden
          />
        ) : null}
      </button>

      {open && collapsible ? (
        <div className="border-t border-primary/20 px-3 py-2">
          {hasText ? <MarkdownText content={body.text as string} /> : null}
          {hasQuestions ? (
            <ul className="space-y-2">
              {(body.questions as unknown[]).map((q, i) => (
                <QuestionItem key={i} q={q} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
