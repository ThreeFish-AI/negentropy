"use client";

import type { ReactNode } from "react";

import { MarkdownText } from "@/components/markdown/MarkdownText";

import type { TranscriptItem } from "./types";

/**
 * Studio 用户消息气泡（人 = 真实用户，居右）。
 *
 * 对齐 Routine ``TaskDispatchBubble`` 的背景/圆角语言（primary 浅底 + 右上角拉直）。
 * 可选 ``avatar``（由 ``StudioTranscript`` 经 ``useAuth`` + ``UserAvatar`` 注入）渲染在气泡右侧，
 * 让「人」的一方有一眼可辨的身份锚点（对齐 Conductor 用户侧头像）。右对齐由
 * ``TranscriptItemsView`` 外层包裹实现；此处 ``flex justify-end`` 让 [气泡][头像] 右贴边。
 */
export function UserBubble({
  item,
  avatar,
}: {
  item: Extract<TranscriptItem, { kind: "user" }>;
  avatar?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-end gap-2">
      <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tr-sm border border-primary/20 bg-primary/[0.06] px-4 py-3">
        <MarkdownText content={item.text} className="[&_p]:text-foreground" />
      </div>
      {avatar ? <div className="mt-0.5 shrink-0">{avatar}</div> : null}
    </div>
  );
}
