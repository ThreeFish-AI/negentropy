"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, XCircle, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { AGENT_ROLE_META, type AgentRole, type PlanReviewPayload } from "@/features/routine";

import { MarkdownText } from "../MarkdownText";
import { LucideGlyph } from "./Icon";
import { BADGE_BASE } from "./style";

// ---------------------------------------------------------------------------
// 语义徽章配色（单一事实源）
// ---------------------------------------------------------------------------

export const BADGE_OK = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
export const BADGE_WARN = "bg-amber-500/10 text-amber-700 dark:text-amber-300";
export const BADGE_ERR = "bg-red-500/10 text-red-700 dark:text-red-300";
const BADGE_NEUTRAL = "bg-muted/60 text-text-secondary";

/** 统一状态徽章：Lucide 图标 + 标签 + 语义配色（替代 emoji，跨平台稳定渲染）。 */
export function StatusBadge({ icon: Icon, label, cls }: { icon: LucideIcon; label: string; cls: string }) {
  return (
    <span className={cn(BADGE_BASE, cls)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

/** plan_review / human_reply 的 verdict → 徽章（approve / refine）。 */
export function PlanVerdictBadge({ verdict }: { verdict: string | null | undefined }) {
  if (verdict === "approve") return <StatusBadge icon={CheckCircle2} label="Approved" cls={BADGE_OK} />;
  if (verdict === "refine") return <StatusBadge icon={RefreshCw} label="Refine" cls={BADGE_WARN} />;
  return <span className={cn(BADGE_BASE, BADGE_NEUTRAL)}>{verdict || "Review"}</span>;
}

/** module_reviews 单项状态图标（pass / warn / fail）。 */
function ModuleStatusIcon({ status }: { status: "pass" | "warn" | "fail" }) {
  if (status === "pass")
    return <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  if (status === "warn")
    return <AlertTriangle className="inline h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />;
  return <XCircle className="inline h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden />;
}

// ---------------------------------------------------------------------------
// 角色头部：图标 + 角色名（彩色胶囊），统一人/机/翼发言人标识
// ---------------------------------------------------------------------------

/**
 * 发言人头部：以 ``AGENT_ROLE_META`` 的图标 + 配色 + 标签渲染角色胶囊。
 *
 * 一核五翼 6 Agent 与 Claude Code 共用此头部——替代此前硬编码的 "Negentropy Engine" 文本，
 * 使任意 Agent 角色（含元神/本心/妙手等 Faculty）均可正确显化。
 */
export function RoleHeader({
  role,
  sublabel,
  children,
}: {
  role: AgentRole;
  sublabel?: string;
  children?: ReactNode;
}) {
  const meta = AGENT_ROLE_META[role];
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", meta.badgeClass)}>
        <LucideGlyph icon={meta.icon} className="h-3.5 w-3.5" />
        {meta.label}
      </span>
      {sublabel ? <span className="text-caption text-text-muted">{sublabel}</span> : null}
      <span className="flex-1" />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan 审阅主体 + Reflection（EngineMessageBlock 与 HumanReplyBlock 共用）
// ---------------------------------------------------------------------------

/** 可折叠的 Reflection 片段（Engine 内部反思）。 */
export function Reflection({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-caption font-medium text-text-secondary hover:text-foreground"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} aria-hidden />
        Reflection
      </button>
      {open ? <MarkdownText content={text} className="mt-1 italic" /> : null}
    </>
  );
}

/**
 * Plan 审阅主体：module_reviews（逐项 pass/warn/fail）+ feedback + reflection。
 *
 * 由「人」侧 ``human_reply``（approve/refine）复用，渲染元神对 CC 提交方案的审阅意见。
 */
export function PlanReviewBody({ review }: { review: PlanReviewPayload }) {
  return (
    <div className="space-y-2">
      {review?.module_reviews && review.module_reviews.length > 0 ? (
        <div className="space-y-1">
          {review.module_reviews.map((m, i) => (
            <div key={i} className="text-caption text-text-secondary">
              <ModuleStatusIcon status={m.status} />{" "}
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
      {review?.reflection ? <Reflection text={review.reflection} /> : null}
    </div>
  );
}
