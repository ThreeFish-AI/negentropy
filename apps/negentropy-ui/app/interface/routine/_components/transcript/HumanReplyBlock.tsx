"use client";

import { CheckCircle2, MessageSquareReply, RefreshCw, XCircle } from "lucide-react";

import { MarkdownText } from "../MarkdownText";
import { BADGE_ERR, BADGE_OK, BADGE_WARN, PlanReviewBody, RoleHeader, StatusBadge } from "./message-shared";
import type { HumanReplyMode, TranscriptItem } from "./types";

/** mode → 头部右侧 verdict 徽章（approve ✔ / refine 🔄 / deny ✗ / answer 💬）。 */
function ReplyBadge({ mode }: { mode: HumanReplyMode }) {
  switch (mode) {
    case "approve_plan":
      return <StatusBadge icon={CheckCircle2} label="Approved" cls={BADGE_OK} />;
    case "approve_exit":
      return <StatusBadge icon={CheckCircle2} label="Approved" cls={BADGE_OK} />;
    case "refine_plan":
      return <StatusBadge icon={RefreshCw} label="Refine" cls={BADGE_WARN} />;
    case "deny_tool":
      return <StatusBadge icon={XCircle} label="Denied" cls={BADGE_ERR} />;
    case "answer_question":
      return <StatusBadge icon={MessageSquareReply} label="Answered" cls={BADGE_OK} />;
  }
}

/**
 * 「人」（一核五翼 6 Agent）对 CC 的应答气泡（human → machine，居右）。
 *
 * 头部经 ``RoleHeader`` 以扮演该动作的 Agent 角色元数据渲染（元神审 Plan / 本心答问 / 妙手门控），
 * 使 6 Agent 在「人」侧显化。按 ``mode`` 分发主体：
 * - approve_plan / refine_plan：复用 ``PlanReviewBody``（module_reviews + feedback + reflection）；
 * - answer_question / approve_exit：Markdown 渲染应答正文；
 * - deny_tool：拒绝理由。
 * 右对齐由 TranscriptView 外层包裹实现。
 */
export function HumanReplyBlock({ item }: { item: Extract<TranscriptItem, { kind: "human_reply" }> }) {
  const { mode, role, text, review } = item;
  const isPlanReview = mode === "approve_plan" || mode === "refine_plan";

  return (
    <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tr-sm bg-muted px-4 py-3">
      <RoleHeader role={role}>
        <ReplyBadge mode={mode} />
      </RoleHeader>
      {isPlanReview && review ? (
        <PlanReviewBody review={review} />
      ) : text ? (
        <MarkdownText content={text} />
      ) : (
        <span className="text-caption italic text-text-muted">（无应答正文）</span>
      )}
    </div>
  );
}
