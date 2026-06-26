"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { taskStatusDotClass, taskStatusLabel } from "../status-style";
import { deriveToolCallDetail } from "./derive-tool-detail";
import { LucideGlyph } from "./Icon";
import { buildToolCallDisplayModel } from "./tool-call-display";
import { detailIcon } from "./tool-call-icon";
import { ToolDetailSections } from "./tool-detail-sections";
import type { ToolCallDetail, TranscriptItem } from "./types";

/** 命令/路径类细节用等宽呈现（贴合 mockup 等宽观感）。 */
const MONO_SUMMARY_TYPES = new Set<ToolCallDetail["type"]>(["shell", "read", "edit", "write", "search"]);

/** 该工具是否有可展开内容（无则不渲染 chevron / 不可点击）。 */
function computeHasDetail(detail: ToolCallDetail): boolean {
  switch (detail.type) {
    case "shell":
      return !!(detail.command || detail.output);
    case "read":
    case "write":
      return !!detail.content;
    case "edit":
      return detail.edits.some((e) => e.oldString || e.newString) || !!detail.output;
    case "search":
      return !!(detail.output || detail.query);
    case "fetch":
    case "sub_agent":
      return !!detail.output;
    case "plan":
      return !!detail.text;
    case "generic":
      return (
        (typeof detail.input === "object" && detail.input !== null && Object.keys(detail.input).length > 0) ||
        !!detail.output
      );
  }
}

/**
 * paseo ``ExpandableBadge`` 等价物：单行紧凑工具调用徽章，点击就地向下展开明细。
 *
 * 行布局：``[22px 图标] [displayName] [灰显 summary truncate] [状态/error] [chevron]``。
 * 展开态：行底角拉直 + 明细框 border-t-0，二者无缝衔接。
 */
export function ExpandableToolCallRow({
  item,
  spacedBottom,
}: {
  item: Extract<TranscriptItem, { kind: "tool" }>;
  /** 该工具行是一段连续工具行的末行（紧邻 assistant 文本前）→ 加大底距。 */
  spacedBottom?: boolean;
}) {
  const detail = useMemo(
    () => deriveToolCallDetail({ toolName: item.toolName, input: item.input, output: item.output, isError: item.isError }),
    [item.toolName, item.input, item.output, item.isError],
  );
  const display = buildToolCallDisplayModel(detail, item.toolName);
  const glyph = detailIcon(detail, item.toolName);
  const hasDetail = computeHasDetail(detail);
  const monoSummary = MONO_SUMMARY_TYPES.has(detail.type);
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex flex-col", spacedBottom ? "mb-4" : "mb-1")}>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={hasDetail ? open : undefined}
        className={cn(
          "group/row -mx-2 flex w-full items-center gap-1 rounded-lg border px-2 py-1 text-left transition-colors",
          hasDetail ? "cursor-pointer" : "cursor-default",
          open
            ? item.isError
              ? "rounded-b-none border-red-500/30 bg-red-500/[0.04]"
              : "rounded-b-none border-border bg-muted/30"
            : "border-transparent hover:bg-muted/40",
        )}
      >
        {/* 图标徽章（22×22，单色 foreground 语义） */}
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
          <LucideGlyph
            icon={glyph}
            className={cn(
              "h-3.5 w-3.5",
              item.isError
                ? "text-red-500"
                : open
                  ? "text-foreground"
                  : "text-text-secondary group-hover/row:text-foreground",
            )}
          />
        </span>

        {/* displayName（工具名，运行中脉冲） */}
        <span
          className={cn(
            "shrink-0 text-body font-normal",
            item.running && "animate-pulse",
            open ? "text-foreground" : "text-text-secondary group-hover/row:text-foreground",
          )}
        >
          {display.displayName}
        </span>

        {/* secondary summary（命令/路径，灰显截断） */}
        {display.summary ? (
          <span
            className={cn(
              "ml-2 min-w-0 flex-1 truncate text-text-muted",
              monoSummary ? "font-mono text-[13px]" : "text-body",
            )}
            title={display.summary}
          >
            {display.summary}
          </span>
        ) : (
          <span className="flex-1" />
        )}

        {/* Task 工具状态点 */}
        {item.taskStatus ? (
          <span className="flex shrink-0 items-center gap-1">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", taskStatusDotClass(item.taskStatus))} />
            <span className="text-caption font-medium text-text-secondary">{taskStatusLabel(item.taskStatus)}</span>
          </span>
        ) : null}

        {/* 运行中脉冲点 */}
        {item.running ? <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-sky-500" /> : null}

        {/* error 标记 */}
        {item.isError ? (
          <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-caption font-semibold text-red-600 dark:text-red-400">
            error
          </span>
        ) : null}

        {/* chevron（仅有可展开内容时） */}
        {hasDetail ? (
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 scale-125 text-text-muted transition-transform", open && "rotate-90")}
            aria-hidden
          />
        ) : null}
      </button>

      {/* 明细框：border-t-0 与行无缝衔接 */}
      {open && hasDetail ? (
        <div
          className={cn(
            "-mx-2 overflow-hidden rounded-b-lg border border-t-0",
            item.isError ? "border-red-500/30 bg-red-500/[0.04]" : "border-border bg-muted/30",
          )}
        >
          <ToolDetailSections detail={detail} isError={item.isError} />
        </div>
      ) : null}
    </div>
  );
}
