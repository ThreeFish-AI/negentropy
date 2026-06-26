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

/**
 * paseo 风格扁平转录流：Claude Code 的 assistant 文本 + 紧凑工具调用行，
 * 与 Negentropy Engine 消息块按 seq 时序交织排布。
 */
export function TranscriptView({ events, live }: { events: RoutineIterationEventDTO[]; live?: boolean }) {
  const items = useMemo(() => normalizeTranscript(events, { live: !!live }), [events, live]);

  return (
    <div className="flex flex-col">
      {items.map((item, i) => {
        const next = items[i + 1];
        switch (item.kind) {
          case "assistant":
            return <AssistantText key={`assistant-${item.seq}-${item.id}`} item={item} />;
          case "tool":
            return (
              <ExpandableToolCallRow
                key={`tool-${item.seq}-${item.id}`}
                item={item}
                // 一段连续工具行的末行（紧邻非工具项前）加大底距
                spacedBottom={!next || next.kind !== "tool"}
              />
            );
          case "engine":
            return <EngineMessageBlock key={`engine-${item.seq}-${item.id}`} item={item} />;
          case "system":
            return <SystemRow key={`system-${item.seq}-${item.id}`} event={item.event} />;
          case "truncated":
            return <TruncatedRow key={`truncated-${item.seq}-${item.id}`} title={item.title} />;
        }
      })}
    </div>
  );
}

/** system / system_retry / system_compact / unknown 行——低信号，紧凑单行，可展开看 payload。 */
function SystemRow({ event }: { event: RoutineIterationEventDTO }) {
  const [open, setOpen] = useState(false);
  const glyph = eventTypeIcon(event.event_type, event.tool_name);
  const title = resolveEventTitle(event.event_type, event.title, event.tool_name);
  const hasDetail = !!event.payload && Object.keys(event.payload).length > 0;

  return (
    <div className="mb-1 flex flex-col">
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
    <div className="my-2 rounded-md border border-dashed border-border bg-muted/20 px-3 py-1.5 text-caption text-text-muted">
      {title || "动作数超过上限，后续动作未记录"}
    </div>
  );
}
