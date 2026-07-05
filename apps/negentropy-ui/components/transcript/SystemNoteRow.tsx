"use client";

import { MarkdownText } from "@/components/markdown/MarkdownText";
import { cn } from "@/lib/utils";

import type { TranscriptItem } from "./types";

/**
 * Studio 纯文本系统/状态/摘要行（system / turn-status / summary）。
 *
 * 低信号紧凑单行（可折行），灰显 muted 底，区别于 Routine 包 DTO 的 ``system`` 行——
 * 后者携带 ``RoutineIterationEventDTO`` 可展开 payload，由 ``SystemRow`` 渲染。
 */
export function SystemNoteRow({ item }: { item: Extract<TranscriptItem, { kind: "system_note" }> }) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-border bg-muted/20 px-3 py-1.5",
        "text-caption text-text-muted",
      )}
    >
      <MarkdownText content={item.text} />
    </div>
  );
}
