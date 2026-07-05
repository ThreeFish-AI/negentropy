"use client";

import { MarkdownText } from "@/components/markdown/MarkdownText";

import type { TranscriptItem } from "./types";

/**
 * Studio 用户消息气泡（人 = 真实用户，居右）。
 *
 * 对齐 Routine ``TaskDispatchBubble`` 的背景/圆角语言（primary 浅底 + 右上角拉直），
 * 但不挂 RoleHeader——用户身份由对齐方向自明。右对齐由 ``TranscriptItemsView`` 外层包裹实现。
 */
export function UserBubble({ item }: { item: Extract<TranscriptItem, { kind: "user" }> }) {
  return (
    <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tr-sm border border-primary/20 bg-primary/[0.06] px-4 py-3">
      <MarkdownText content={item.text} className="[&_p]:text-foreground" />
    </div>
  );
}
