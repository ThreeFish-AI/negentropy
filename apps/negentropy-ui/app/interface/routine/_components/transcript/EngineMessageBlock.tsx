"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { type PlanReviewPayload, type RoutineIterationEventDTO } from "@/features/routine";

import { MarkdownText } from "../MarkdownText";
import { EVENT_GROUP_LABEL, scoreColorClass } from "../status-style";
import {
  BADGE_ERR,
  BADGE_OK,
  BADGE_WARN,
  PlanReviewBody,
  Reflection,
  RoleHeader,
  StatusBadge,
} from "./message-shared";
import { PayloadDetail } from "./PayloadDetail";
import type { TranscriptItem } from "./types";

/** payload.is_error 旗标。 */
function payloadIsError(payload: Record<string, unknown>): boolean {
  return payload?.is_error === true;
}

/**
 * Negentropy Engine 侧事件（gate / evaluation / result）的消息气泡。
 *
 * 仿 paseo「用户消息」：右对齐中性气泡（``rounded-2xl`` + 右上角拉直），以「对齐 + 气泡」
 * 区分发言人——Engine（编排/评估的驱动方）居右。头部经 ``RoleHeader`` 以一核（engine）
 * 角色元数据渲染（图标 + 配色 + 标签），不再硬编码文本。Plan 审阅（plan_review）已在
 * 归一化层升格为 ``human_reply`` 由 HumanReplyBlock 渲染；此处保留 plan_review 分支作
 * 旧数据兜底。右对齐由 TranscriptView 外层包裹实现。
 */
export function EngineMessageBlock({ item }: { item: Extract<TranscriptItem, { kind: "engine" }> }) {
  const { event, group } = item;
  return (
    <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tr-sm bg-muted px-4 py-3">
      <RoleHeader role="engine" sublabel={EVENT_GROUP_LABEL[group]}>
        <EngineHeaderBadges event={event} />
      </RoleHeader>
      <EngineBody event={event} />
    </div>
  );
}

/** 头部右侧徽章：result / gate / evaluation / plan_review 各自的 verdict / score / cost。 */
function EngineHeaderBadges({ event }: { event: RoutineIterationEventDTO }) {
  const et = event.event_type;
  const p = event.payload ?? {};
  const isError = payloadIsError(p);

  if (et === "plan_review") {
    const verdict = typeof p.verdict === "string" ? p.verdict : "";
    const score = typeof p.score === "number" ? p.score : null;
    const badge =
      verdict === "approve" ? (
        <StatusBadge icon={CheckCircle2} label="Approved" cls={BADGE_OK} />
      ) : verdict === "refine" ? (
        <StatusBadge icon={RefreshCw} label="Refine" cls={BADGE_WARN} />
      ) : (
        <StatusBadge icon={RefreshCw} label={verdict || "Review"} cls={BADGE_WARN} />
      );
    return (
      <>
        {badge}
        {score != null ? <span className={cn("text-sm font-bold tabular-nums", scoreColorClass(score))}>{score}</span> : null}
      </>
    );
  }

  if (et === "result") {
    return isError ? (
      <StatusBadge icon={XCircle} label="Error" cls={BADGE_ERR} />
    ) : (
      <StatusBadge icon={CheckCircle2} label="Success" cls={BADGE_OK} />
    );
  }

  if (et === "gate") {
    const exitCode = p.exit_code as number | null | undefined;
    const failed = exitCode != null && exitCode !== 0;
    return failed ? (
      <StatusBadge icon={XCircle} label={`Exit ${exitCode}`} cls={BADGE_ERR} />
    ) : (
      <StatusBadge icon={CheckCircle2} label="Passed" cls={BADGE_OK} />
    );
  }

  if (et === "evaluation") {
    const verdict = typeof p.verdict === "string" ? p.verdict : null;
    const score = typeof p.score === "number" ? p.score : null;
    const badge =
      verdict === "succeeded" ? (
        <StatusBadge icon={CheckCircle2} label="Succeeded" cls={BADGE_OK} />
      ) : verdict === "progressing" ? (
        <StatusBadge icon={RefreshCw} label="Progressing" cls={BADGE_WARN} />
      ) : verdict === "failed" ? (
        <StatusBadge icon={XCircle} label="Failed" cls={BADGE_ERR} />
      ) : verdict ? (
        <StatusBadge icon={AlertTriangle} label={verdict} cls={BADGE_WARN} />
      ) : null;
    return (
      <>
        {badge}
        {score != null ? <span className={cn("text-sm font-bold tabular-nums", scoreColorClass(score))}>{score}</span> : null}
      </>
    );
  }

  return null;
}

/** 事件主体内容（按类型分发）。 */
function EngineBody({ event }: { event: RoutineIterationEventDTO }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const et = event.event_type;
  const p = event.payload ?? {};
  const hasDetail = !!event.payload && Object.keys(event.payload).length > 0;

  if (et === "plan_review") {
    return <PlanReviewBody review={event.payload as unknown as PlanReviewPayload} />;
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
          {typeof p.reflection === "string" && p.reflection ? <Reflection text={p.reflection} /> : null}
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
