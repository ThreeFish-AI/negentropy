"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RoutineIterationEventDTO } from "@/features/routine";

import { eventTypeIcon, resolveEventTitle } from "./status-shared";
import { AssistantText } from "./AssistantText";
import { CcRequestBlock } from "./CcRequestBlock";
import { EngineMessageBlock } from "./EngineMessageBlock";
import { ExpandableToolCallRow } from "./ExpandableToolCallRow";
import { HumanReplyBlock } from "./HumanReplyBlock";
import { LucideGlyph } from "./Icon";
import { PayloadDetail } from "./PayloadDetail";
import { RoleHeader } from "./message-shared";
import { SystemNoteRow } from "./SystemNoteRow";
import { TaskDispatchBubble } from "./TaskDispatchBubble";
import { ToolSummaryRow } from "./ToolSummaryRow";
import { UserBubble } from "./UserBubble";
import { WorkingIndicator } from "./WorkingIndicator";
import type { TranscriptPolicy } from "./policy";
import type { TranscriptItem } from "./types";

/** turn 间距节奏（单一事实源）：换方 16px、连续工具行 4px、其余同方 8px、首项无间距。 */
function gapClass(item: TranscriptItem, prev: TranscriptItem | null, policy: TranscriptPolicy): string {
  if (!prev) return "";
  if (policy.align(item) !== policy.align(prev)) return "mt-4";
  if (item.kind === "tool" && prev.kind === "tool") return "mt-1";
  return "mt-2";
}

/** 按 kind 分发渲染单项（key 与对齐/间距由外层 wrapper 统一处理）。 */
function renderItem(item: TranscriptItem) {
  switch (item.kind) {
    case "task_dispatch":
      return <TaskDispatchBubble prompt={item.prompt} />;
    case "user":
      return <UserBubble item={item} />;
    case "assistant":
      return <AssistantText item={item} />;
    case "tool":
      return <ExpandableToolCallRow item={item} />;
    case "tool_summary":
      return <ToolSummaryRow item={item} />;
    case "cc_request":
      return <CcRequestBlock item={item} />;
    case "human_reply":
      return <HumanReplyBlock item={item} />;
    case "engine":
      return <EngineMessageBlock item={item} />;
    case "system":
      return <SystemRow event={item.event} />;
    case "system_note":
      return <SystemNoteRow item={item} />;
    case "truncated":
      return <TruncatedRow title={item.title} />;
  }
}

/** 稳定 key：task_dispatch 无 seq/id，用固定标识；其余用 kind+seq+id。 */
function itemKey(item: TranscriptItem): string {
  if (item.kind === "task_dispatch") return "task-dispatch";
  return `${item.kind}-${item.seq}-${item.id}`;
}

/**
 * 策略化转录渲染器（单一事实源）：按 ``policy.align`` 左右对齐、``policy.roleHeaderFor``
 * 渲染机侧 per-agent 徽章，间距承载 turn 节奏，在途态尾随 ``WorkingIndicator``。
 *
 * - Routine 经 ``TranscriptView`` 薄壳传入 ``ROUTINE_POLICY``（行为与历史逐像素等价）；
 * - Studio 经 ``StudioTranscript`` 传入 ``STUDIO_POLICY``（用户居右 / 机侧居左带徽章）。
 */
export function TranscriptItemsView({
  items,
  live,
  policy,
  itemWrapper,
}: {
  items: TranscriptItem[];
  live?: boolean;
  policy: TranscriptPolicy;
  /**
   * 可选的 per-item 内容包裹器（Studio 用于挂 ``data-node-id`` / 选中环 / 搜索高亮 / onClick）。
   * Routine 不传 → 直接渲染内容（行为不变）。包裹器位于对齐/间距容器之内、内容之外。
   */
  itemWrapper?: (item: TranscriptItem, children: ReactNode) => ReactNode;
}) {
  const last = items[items.length - 1];
  const workingLabel =
    policy.workingLabel?.(last) ??
    (last?.kind === "cc_request" && last.pending ? "Planning…" : "Working…");

  return (
    <div className="flex flex-col">
      {items.map((item, i) => {
        const prev = i > 0 ? items[i - 1] : null;
        const side = policy.align(item);
        const headerRole = policy.roleHeaderFor(item, prev);
        const content = renderItem(item);
        return (
          <div
            key={itemKey(item)}
            className={cn(gapClass(item, prev, policy), side === "right" && "flex justify-end")}
          >
            {headerRole ? <RoleHeader role={headerRole} /> : null}
            {itemWrapper ? itemWrapper(item, content) : content}
          </div>
        );
      })}
      {live ? (
        <div className={items.length > 0 ? "mt-2" : ""}>
          <WorkingIndicator label={workingLabel} />
        </div>
      ) : null}
    </div>
  );
}

/** 从旧数据的 payload.raw 中 best-effort 提取 system subtype。 */
function extractSubtitle(payload: Record<string, unknown> | null | undefined): string | null {
  const raw = payload?.raw;
  if (typeof raw === "object" && raw !== null) return ((raw as Record<string, unknown>).subtype as string) ?? null;
  if (typeof raw === "string") {
    try {
      return (JSON.parse(raw)?.subtype as string) ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

/** system / system_retry / system_compact / unknown 行——低信号，紧凑单行，可展开看 payload。 */
function SystemRow({ event }: { event: RoutineIterationEventDTO }) {
  const [open, setOpen] = useState(false);
  const glyph = eventTypeIcon(event.event_type, event.tool_name);
  const title = resolveEventTitle(event.event_type, event.title || extractSubtitle(event.payload), event.tool_name);
  const hasDetail = !!event.payload && Object.keys(event.payload).length > 0;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={hasDetail ? open : undefined}
        className={cn(
          "group/row -mx-2 flex w-full items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-left transition-colors",
          hasDetail ? "cursor-pointer hover:bg-muted/40" : "cursor-default",
        )}
      >
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
          <LucideGlyph icon={glyph} className="h-3.5 w-3.5 text-text-muted" />
        </span>
        <span className="min-w-0 flex-1 truncate text-body text-text-secondary" title={title}>
          {title}
        </span>
        {hasDetail ? (
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 scale-125 text-text-muted transition-transform", open && "rotate-90")}
            aria-hidden
          />
        ) : null}
      </button>
      {open && hasDetail ? (
        <div className="-mx-2 space-y-2 rounded-b-lg border border-t-0 border-border bg-muted/30 p-2">
          <PayloadDetail payload={event.payload} />
        </div>
      ) : null}
    </div>
  );
}

/** 动作数超上限的截断哨兵——灰显提示行。 */
function TruncatedRow({ title }: { title: string | null }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-1.5 text-caption text-text-muted">
      {title || "动作数超过上限，后续动作未记录"}
    </div>
  );
}
