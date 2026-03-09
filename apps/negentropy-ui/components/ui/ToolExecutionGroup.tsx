"use client";

import { useEffect, useState } from "react";
import type { ToolExecutionEntry, ToolGroupDisplayBlock } from "@/types/a2ui";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { cn } from "@/lib/utils";

function parseJson(value: string | undefined): unknown {
  if (!value || !value.trim()) {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function StatusDot({ status }: { status: ToolExecutionEntry["status"] }) {
  const className =
    status === "error"
      ? "bg-red-500"
      : status === "completed" || status === "done"
        ? "bg-emerald-500"
        : "bg-sky-500";
  return (
    <span
      className={cn(
        "inline-flex h-2.5 w-2.5 rounded-full",
        status === "running" && "animate-pulse",
        className,
      )}
      aria-hidden="true"
    />
  );
}

function ToolExecutionCard({
  tool,
  defaultExpanded,
  onSelect,
}: {
  tool: ToolExecutionEntry;
  defaultExpanded: boolean;
  onSelect?: (nodeId: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [manualToggle, setManualToggle] = useState(false);

  useEffect(() => {
    if (!manualToggle) {
      setExpanded(defaultExpanded);
    }
  }, [defaultExpanded, manualToggle]);

  const args = parseJson(tool.args);
  const result = parseJson(tool.result);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white/90 p-3 shadow-sm transition-colors dark:bg-zinc-900/90",
        tool.status === "error"
          ? "border-red-200 dark:border-red-900"
          : tool.status === "running"
            ? "border-sky-200 dark:border-sky-900"
            : "border-zinc-200 dark:border-zinc-800",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => {
          setManualToggle(true);
          setExpanded((current) => !current);
          onSelect?.(tool.nodeId);
        }}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <StatusDot status={tool.status} />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {tool.name}
            </span>
          </div>
          <div className="space-y-1">
            {tool.summary.length > 0 ? (
              tool.summary.map((line) => (
                <div
                  key={line}
                  className="text-xs text-zinc-600 dark:text-zinc-400"
                >
                  {line}
                </div>
              ))
            ) : (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                暂无摘要
              </div>
            )}
          </div>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          {expanded ? "收起" : "展开"}
        </span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-zinc-200/70 pt-3 dark:border-zinc-800">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Parameters
            </div>
            <div className="max-h-52 overflow-auto rounded-xl border border-zinc-200/70 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-950/70">
              <JsonViewer data={args} />
            </div>
          </div>
          {tool.result ? (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                Result
              </div>
              <div className="max-h-52 overflow-auto rounded-xl border border-zinc-200/70 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-950/70">
                <JsonViewer data={result} />
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              尚未返回结果
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ToolExecutionGroup({
  block,
  isSelected,
  onSelect,
}: {
  block: ToolGroupDisplayBlock;
  isSelected?: boolean;
  onSelect?: (nodeId: string) => void;
}) {
  const [expanded, setExpanded] = useState(block.defaultExpanded);
  const [manualToggle, setManualToggle] = useState(false);

  useEffect(() => {
    if (!manualToggle) {
      setExpanded(block.defaultExpanded);
    }
  }, [block.defaultExpanded, manualToggle]);

  return (
    <section
      className={cn(
        "rounded-[1.8rem] border px-4 py-3 shadow-[0_16px_40px_rgba(24,24,27,0.04)]",
        block.status === "error"
          ? "border-red-200/90 bg-[linear-gradient(180deg,rgba(254,242,242,0.98),rgba(254,226,226,0.86))] dark:border-red-900/80 dark:bg-[linear-gradient(180deg,rgba(69,10,10,0.8),rgba(24,24,27,0.92))]"
          : block.status === "running"
            ? "border-sky-200/90 bg-[linear-gradient(180deg,rgba(240,249,255,0.96),rgba(239,246,255,0.88))] dark:border-sky-900/70 dark:bg-[linear-gradient(180deg,rgba(8,47,73,0.72),rgba(24,24,27,0.92))]"
            : "border-zinc-200/80 bg-[linear-gradient(180deg,rgba(250,250,250,0.96),rgba(244,244,245,0.9))] dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.9))]",
        isSelected &&
          "ring-1 ring-amber-300/70 dark:ring-amber-700/60",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 text-left"
        onClick={() => {
          setManualToggle(true);
          setExpanded((current) => !current);
          onSelect?.(block.nodeId);
        }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950">
              {block.parallel ? "Parallel" : "Tool"}
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {block.title}
            </span>
            {block.status === "error" ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700 dark:bg-red-950/70 dark:text-red-200">
                Error
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {block.summary}
          </div>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          {expanded ? "收起过程" : "展开过程"}
        </span>
      </button>

      {expanded ? (
        <div
          className={cn(
            "mt-3 grid gap-3 border-t border-zinc-200/70 pt-3 dark:border-zinc-800",
            block.parallel ? "md:grid-cols-2" : "grid-cols-1",
          )}
        >
          {block.tools.map((tool) => (
            <ToolExecutionCard
              key={tool.id}
              tool={tool}
              defaultExpanded={block.defaultExpanded}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
