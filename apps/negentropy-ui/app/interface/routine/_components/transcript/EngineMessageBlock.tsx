"use client";

import { useState } from "react";
import { ChevronRight, Cpu } from "lucide-react";

import { cn } from "@/lib/utils";
import { type PlanReviewPayload, type RoutineIterationEventDTO } from "@/features/routine";

import { MarkdownText } from "../MarkdownText";
import { EVENT_GROUP_LABEL, scoreColorClass } from "../status-style";
import { PayloadDetail } from "./PayloadDetail";
import { BADGE_BASE } from "./style";
import type { TranscriptItem } from "./types";

/** payload.is_error 旗标。 */
function payloadIsError(payload: Record<string, unknown>): boolean {
  return payload?.is_error === true;
}

/**
 * Negentropy Engine 侧事件（plan_review / gate / evaluation / result）的紧凑消息块。
 *
 * 取代旧的右侧大气泡：扁平左强调边（slate）卡片，与 Claude Code 转录同列时序排布，
 * 保留全部既有信息（模块评审 / feedback / gate 命令输出 / evaluation 反思 / result 摘要）。
 */
export function EngineMessageBlock({ item }: { item: Extract<TranscriptItem, { kind: "engine" }> }) {
  const { event, group } = item;
  return (
    <div className="my-2 rounded-lg border border-border border-l-2 border-l-slate-400/60 bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Cpu className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Negentropy Engine</span>
        <span className="text-caption font-medium text-text-secondary">{EVENT_GROUP_LABEL[group]}</span>
        <EngineHeaderBadges event={event} />
      </div>
      <EngineBody event={event} />
    </div>
  );
}

/** 头部右侧徽章：result / gate / evaluation 各自的 verdict / score / cost。 */
function EngineHeaderBadges({ event }: { event: RoutineIterationEventDTO }) {
  const et = event.event_type;
  const p = event.payload ?? {};
  const isError = payloadIsError(p);

  if (et === "plan_review") {
    const verdict = typeof p.verdict === "string" ? p.verdict : "";
    const score = typeof p.score === "number" ? p.score : null;
    const vc =
      verdict === "approve"
        ? { label: "✅ Approved", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" }
        : verdict === "refine"
          ? { label: "🔄 Refine", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" }
          : { label: verdict || "Review", cls: "bg-muted/60 text-text-secondary" };
    return (
      <>
        <span className={cn(BADGE_BASE, vc.cls)}>{vc.label}</span>
        {score != null ? <span className={cn("text-sm font-bold tabular-nums", scoreColorClass(score))}>{score}</span> : null}
      </>
    );
  }

  if (et === "result") {
    return (
      <span className={cn(BADGE_BASE, isError ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
        {isError ? "❌ Error" : "✅ Success"}
      </span>
    );
  }

  if (et === "gate") {
    const exitCode = p.exit_code as number | null | undefined;
    const failed = exitCode != null && exitCode !== 0;
    return (
      <span className={cn(BADGE_BASE, failed ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
        {failed ? `❌ Exit ${exitCode}` : "✅ Passed"}
      </span>
    );
  }

  if (et === "evaluation") {
    const verdict = typeof p.verdict === "string" ? p.verdict : null;
    const score = typeof p.score === "number" ? p.score : null;
    const vb: Record<string, { label: string; cls: string }> = {
      succeeded: { label: "✅ Succeeded", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
      progressing: { label: "🔄 Progressing", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
      failed: { label: "❌ Failed", cls: "bg-red-500/10 text-red-700 dark:text-red-300" },
    };
    const cfg = vb[verdict ?? ""] ?? { label: verdict ?? "Evaluation", cls: "bg-muted/60 text-text-secondary" };
    return (
      <>
        <span className={cn(BADGE_BASE, cfg.cls)}>{cfg.label}</span>
        {score != null ? <span className={cn("text-sm font-bold tabular-nums", scoreColorClass(score))}>{score}</span> : null}
      </>
    );
  }

  return null;
}

/** 事件主体内容（按类型分发）。 */
function EngineBody({ event }: { event: RoutineIterationEventDTO }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const et = event.event_type;
  const p = event.payload ?? {};
  const hasDetail = !!event.payload && Object.keys(event.payload).length > 0;

  if (et === "plan_review") {
    const review = event.payload as unknown as PlanReviewPayload;
    return (
      <div className="space-y-2">
        {review?.module_reviews && review.module_reviews.length > 0 ? (
          <div className="space-y-1">
            {review.module_reviews.map((m, i) => (
              <div key={i} className="text-caption text-text-secondary">
                {m.status === "pass" ? "✅" : m.status === "warn" ? "⚠️" : "❌"}{" "}
                <span className="font-medium text-foreground">{m.module}</span>: {m.comment}
              </div>
            ))}
          </div>
        ) : null}
        {review?.feedback ? (
          <div className="rounded-md border border-border bg-muted/30 p-2">
            <MarkdownText content={review.feedback} />
          </div>
        ) : null}
        {review?.reflection ? <Reflection open={subOpen} onToggle={() => setSubOpen((v) => !v)} text={review.reflection} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* result */}
      {et === "result" ? (
        <>
          {typeof p.num_turns === "number" ? (
            <div className="text-caption text-text-secondary">
              <span className="font-medium text-foreground">{p.num_turns}</span> turns
            </div>
          ) : null}
          {typeof p.result === "string" && p.result ? (
            <div className="line-clamp-3">
              <MarkdownText content={p.result} />
            </div>
          ) : null}
        </>
      ) : null}

      {/* gate */}
      {et === "gate" ? (
        <>
          {typeof p.command === "string" && p.command ? (
            <div className="rounded-md border border-border bg-muted/30 p-2 font-mono text-caption text-text-secondary">
              <span className="text-text-muted">$ </span>
              {p.command}
            </div>
          ) : null}
          {typeof p.output === "string" && p.output ? (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 font-mono text-caption leading-relaxed text-text-secondary">
              {p.output}
            </pre>
          ) : null}
        </>
      ) : null}

      {/* evaluation */}
      {et === "evaluation" ? (
        <>
          {typeof p.error === "string" && p.error ? (
            <div className="rounded-md border border-red-500/20 bg-red-500/[0.03] p-2 text-caption leading-caption text-red-600 dark:text-red-400">
              {p.error}
            </div>
          ) : null}
          {typeof p.reflection === "string" && p.reflection ? (
            <Reflection open={subOpen} onToggle={() => setSubOpen((v) => !v)} text={p.reflection} />
          ) : null}
        </>
      ) : null}

      {/* raw 明细（折叠） */}
      {hasDetail ? (
        <>
          <button
            type="button"
            onClick={() => setDetailOpen((v) => !v)}
            className="flex items-center gap-1 text-caption font-medium text-text-secondary hover:text-foreground"
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform", detailOpen && "rotate-90")} aria-hidden />
            Detail
          </button>
          {detailOpen ? (
            <div className="rounded-md border border-border bg-muted/30 p-2">
              <PayloadDetail payload={event.payload} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** 可折叠的 Reflection 片段。 */
function Reflection({ open, onToggle, text }: { open: boolean; onToggle: () => void; text: string }) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-caption font-medium text-text-secondary hover:text-foreground"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} aria-hidden />
        Reflection
      </button>
      {open ? <MarkdownText content={text} className="mt-1 italic" /> : null}
    </>
  );
}
