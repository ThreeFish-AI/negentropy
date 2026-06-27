"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RoutineIterationEventDTO } from "@/features/routine";

import { eventTypeIcon, resolveEventTitle } from "../status-style";
import { AssistantText } from "./AssistantText";
import { EngineMessageBlock } from "./EngineMessageBlock";
import { ExpandableToolCallRow } from "./ExpandableToolCallRow";
import { LucideGlyph } from "./Icon";
import { normalizeTranscript } from "./normalize-transcript";
import { PayloadDetail } from "./PayloadDetail";
import type { TranscriptItem } from "./types";

/** 发言人侧：engine 居右（驱动方/人），其余（assistant/tool/system/truncated）居左（执行方/机）。 */
function speaker(item: TranscriptItem): "cc" | "engine" {
  return item.kind === "engine" ? "engine" : "cc";
}

/** turn 间距节奏（单一事实源）：换方 16px、连续工具行 4px、其余同方 8px、首项无间距。 */
function gapClass(item: TranscriptItem, prev: TranscriptItem | null): string {
  if (!prev) return "";
  if (speaker(item) !== speaker(prev)) return "mt-4";
  if (item.kind === "tool" && prev.kind === "tool") return "mt-1";
  return "mt-2";
}

/** 按 kind 分发渲染单项（key 与对齐/间距由外层 wrapper 统一处理）。 */
function renderItem(item: TranscriptItem) {
  switch (item.kind) {
    case "assistant":
      return <AssistantText item={item} />;
    case "tool":
      return <ExpandableToolCallRow item={item} />;
    case "engine":
      return <EngineMessageBlock item={item} />;
    case "system":
      return <SystemRow event={item.event} />;
    case "truncated":
      return <TruncatedRow title={item.title} />;
  }
}

/**
 * paseo 风格转录流：以「左右对齐」区分人机——Claude Code（机）裸文居左、紧凑工具行，
 * Negentropy Engine（人/驱动方）消息气泡居右；按 seq 时序交织，间距承载 turn 节奏。
 */
export function TranscriptView({ events, live }: { events: RoutineIterationEventDTO[]; live?: boolean }) {
  const items = useMemo(() => normalizeTranscript(events, { live: !!live }), [events, live]);

  return (
    <div className="flex flex-col">
      {items.map((item, i) => {
        const prev = i > 0 ? items[i - 1] : null;
        return (
          <div
            key={`${item.kind}-${item.seq}-${item.id}`}
            className={cn(gapClass(item, prev), speaker(item) === "engine" && "flex justify-end")}
          >
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}

/** 从旧数据的 payload.raw 中 best-effort 提取 system subtype。
 *  旧持久化数据 title=null，payload.raw 含原始 JSON（含 subtype 字段）。 */
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
