"use client";

import { useState } from "react";
import { ChevronRight, Layers } from "lucide-react";

import { cn } from "@/lib/utils";

import { humanizeToolName } from "./tool-call-display";
import { ExpandableToolCallRow } from "./ExpandableToolCallRow";
import type { TranscriptItem } from "./types";

/**
 * 连续 ≥3 个工具调用的折叠 summary 行（Conductor 范式，居左）。
 *
 * 折叠态：``[图标] N tool calls · 去重工具名``，点击展开还原内嵌的各 ``ExpandableToolCallRow``。
 * 减少长工具序列对人机回合主线的刷屏，与 Conductor 的 ``{toolCallsCount, toolNames}`` summary 一致。
 */
export function ToolSummaryRow({ item }: { item: Extract<TranscriptItem, { kind: "tool_summary" }> }) {
  const [open, setOpen] = useState(false);
  const names = item.toolNames.map(humanizeToolName);
  const namePreview = names.slice(0, 4).join(" · ");
  const extra = names.length > 4 ? ` +${names.length - 4}` : "";

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "group/row -mx-2 flex w-full items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-left transition-colors hover:bg-muted/40",
        )}
      >
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
          <Layers
            className="h-3.5 w-3.5 text-text-secondary group-hover/row:text-foreground"
            aria-hidden
          />
        </span>
        <span className="shrink-0 text-body font-normal text-text-secondary group-hover/row:text-foreground">
          {item.count} 次工具调用
        </span>
        {namePreview ? (
          <span className="ml-2 min-w-0 flex-1 truncate text-text-muted" title={names.join(" · ")}>
            {namePreview}
            {extra}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 scale-125 text-text-muted transition-transform", open && "rotate-90")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="mt-1 flex flex-col gap-1 border-l border-border pl-3">
          {item.collapsed.map((tool) => (
            <ExpandableToolCallRow key={`${tool.seq}-${tool.id}`} item={tool} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
