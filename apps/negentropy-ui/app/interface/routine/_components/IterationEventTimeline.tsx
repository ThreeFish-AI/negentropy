"use client";

import { useMemo, useState } from "react";
import { Bot, ChevronRight, Cpu, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { JsonViewer } from "@/components/ui/JsonViewer";
import {
  AGENT_ROLE_META,
  deriveAgentRole,
  type AgentRole,
  type PlanReviewPayload,
  type RoutineIterationEventDTO,
} from "@/features/routine";

import {
  EVENT_GROUP_LABEL,
  type EventGroup,
  eventGroup,
  eventTypeClass,
  eventTypeIcon,

  resolveEventTitle,
  scoreColorClass,
  deriveTaskStatus,
  taskStatusDotClass,
  taskStatusLabel,
} from "./status-style";

// ---------------------------------------------------------------------------
// Turn（轮次）聚合 —— 将执行阶段事件按 Claude Code 的 Turn 边界分组
// ---------------------------------------------------------------------------

/** 执行阶段事件按 Turn（轮次）聚合。 */
interface EventTurn {
  /** 1-based 显示序号。 */
  turnNumber: number;
  /** Turn 首事件（assistant 或 system）。 */
  leadEvent: RoutineIterationEventDTO;
  /** Turn 内所有事件，按 seq 升序。 */
  events: RoutineIterationEventDTO[];
  /** 是否包含 tool_result.is_error === true 的事件。 */
  hasError: boolean;
}

/** 将 execution 组事件按 Turn 边界聚合：
 * - 每个 `assistant` 事件开启新 Turn
 * - 首个 `system` 事件（无既有 Turn 时）开启 Turn 1（init）
 * - `tool_use` / `tool_result` / `system_retry` / `_truncated` / `unknown` 归入当前 Turn
 * - 兜底：`current === null` 时任意事件开启 Turn 1
 */
function groupIntoTurns(events: RoutineIterationEventDTO[]): EventTurn[] {
  const turns: EventTurn[] = [];
  let current: EventTurn | null = null;

  for (const ev of events) {
    const isBoundary =
      ev.event_type === "assistant" ||
      (ev.event_type === "system" && current === null) ||
      current === null; // 兜底：首条事件非 system/assistant

    if (isBoundary) {
      if (current) turns.push(current);
      current = {
        turnNumber: turns.length + 1,
        leadEvent: ev,
        events: [ev],
        hasError: false,
      };
    } else {
      // isBoundary === false → current 必然已初始化
      current!.events.push(ev);
    }

    if (ev.event_type === "tool_result" && payloadIsError(ev.payload)) {
      if (current) current.hasError = true;
    }
  }

  if (current) turns.push(current);
  return turns;
}

/** 从 Turn 的首事件及事件序列中推导人可读标题。
 * 优先级：assistant payload.text（首行 80 字符）→ 首个 tool_use 标题 → assistant 标题翻译 → 兜底。
 */
function deriveTurnTitle(turn: EventTurn): string {
  const ev = turn.leadEvent;
  if (ev.event_type === "system") {
    return resolveEventTitle(ev.event_type, ev.title || extractSubtitle(ev.payload), ev.tool_name);
  }
  if (ev.event_type === "assistant") {
    // 尝试提取 assistant 的推理文本首行
    const text = typeof ev.payload?.text === "string" ? (ev.payload.text as string).trim() : "";
    if (text) {
      const firstLine = text.split("\n")[0];
      return firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine;
    }
    // 无 text → 从首个 tool_use 事件提取标题
    const firstTool = turn.events.find((e) => e.event_type === "tool_use");
    if (firstTool) {
      return resolveEventTitle(firstTool.event_type, firstTool.title, firstTool.tool_name);
    }
    return resolveEventTitle(ev.event_type, ev.title, ev.tool_name);
  }
  return `Turn ${turn.turnNumber}`;
}

/** 渲染 Lucide 图标 —— 以 prop 传入组件引用，避免「render 期间创建组件」lint 误报。 */
function EventIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon className={className} aria-hidden />;
}

// ---------------------------------------------------------------------------
// 对话式布局：按 Agent 角色左右分列
// ---------------------------------------------------------------------------

/** 对话块：一个可独立渲染的对话单元，由 Agent 角色决定对齐方向。 */
type ConversationBlock =
  | { kind: "turn"; turn: EventTurn }
  | { kind: "plan_review"; event: RoutineIterationEventDTO }
  | { kind: "engine_event"; event: RoutineIterationEventDTO; label: string };

// ---------------------------------------------------------------------------
// 同发言人聚合 —— 将连续同 role 的 ConversationBlock 合并为一组
// ---------------------------------------------------------------------------

/** 连续同发言人对话块聚合。 */
interface SpeakerGroup {
  /** 稳定唯一 key（用于 React 列表渲染）。 */
  id: string;
  /** 聚合后的 Agent 角色。 */
  role: AgentRole;
  /** 连续同 role 的对话块序列。 */
  blocks: ConversationBlock[];
}

/** 从 ConversationBlock 推导发言人角色。 */
function blockRole(block: ConversationBlock): AgentRole {
  return block.kind === "turn" ? "claude_code" : "engine";
}

/** 将连续同发言人的 ConversationBlock 聚合为 SpeakerGroup 序列。 */
function groupConsecutiveBlocks(blocks: ConversationBlock[]): SpeakerGroup[] {
  if (blocks.length === 0) return [];

  const groups: SpeakerGroup[] = [];
  let current: SpeakerGroup | null = null;

  for (const block of blocks) {
    const role = blockRole(block);

    if (current && current.role === role) {
      current.blocks.push(block);
    } else {
      if (current) groups.push(current);
      const firstSeq = block.kind === "turn"
        ? block.turn.turnNumber
        : block.event.seq;
      current = {
        id: `group-${role}-${firstSeq}`,
        role,
        blocks: [block],
      };
    }
  }

  if (current) groups.push(current);
  return groups;
}

/** 将已累积的 execution 事件聚合为 Turn 块并追加到 blocks，同时维护全局 Turn 编号。 */
function flushAccumulator(
  acc: RoutineIterationEventDTO[],
  blocks: ConversationBlock[],
  turnOffset: { value: number },
): void {
  if (acc.length === 0) return;
  const turns = groupIntoTurns(acc);
  for (let i = 0; i < turns.length; i++) {
    // 重编号以保持全局连续（groupIntoTurns 内部从 1 开始，需加上偏移）
    turns[i].turnNumber = turnOffset.value + i + 1;
    blocks.push({ kind: "turn", turn: turns[i] });
  }
  turnOffset.value += turns.length;
  acc.length = 0;
}

/** 将所有事件按 seq 时序编排为对话块序列（Claude Code Turn 与 Engine 事件交织排列）。 */
function buildConversationBlocks(
  sortedEvents: RoutineIterationEventDTO[],
): ConversationBlock[] {
  const blocks: ConversationBlock[] = [];
  const acc: RoutineIterationEventDTO[] = [];
  const turnOffset = { value: 0 };

  for (const ev of [...sortedEvents].sort((a, b) => a.seq - b.seq)) {
    const g = eventGroup(ev.event_type);

    if (g === "execution") {
      acc.push(ev);
    } else {
      // Engine 事件前先刷出已累积的 execution Turn
      flushAccumulator(acc, blocks, turnOffset);

      if (g === "plan_review") {
        blocks.push({ kind: "plan_review", event: ev });
      } else {
        // result / gate / evaluation → Engine 右侧气泡
        blocks.push({ kind: "engine_event", event: ev, label: EVENT_GROUP_LABEL[g] });
      }
    }
  }

  // 刷出尾部残留的 execution 事件
  flushAccumulator(acc, blocks, turnOffset);

  return blocks;
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

/**
 * 单次迭代「全过程」动作时间线 —— 对话式布局。
 *
 * Claude Code 的 Turns 居左（被调用者），NegentropyEngine 的 Plan Review 居右（系统本我），
 * Engine 级事件（gate / evaluation / result）居右（系统本我）。
 */
export function IterationEventTimeline({
  events,
  live,
}: {
  events: RoutineIterationEventDTO[];
  /** 是否处于在途实时态（显示 LIVE 脉冲）。 */
  live?: boolean;
}) {
  // 统计栏仍按分类计数
  const groups = useMemo(() => groupEvents(events), [events]);
  // 对话块按 seq 时序交织排列（Turn 与 Engine 事件穿插）
  const blocks = useMemo(() => buildConversationBlocks(events), [events]);
  // 连续同发言人聚合
  const speakerGroups = useMemo(() => groupConsecutiveBlocks(blocks), [blocks]);

  if (events.length === 0) {
    return null; // 空态由抽屉统一渲染
  }

  return (
    <div className="space-y-3">
      {/* 分组统计栏 */}
      <div className="flex flex-wrap items-center gap-2">
        {(["execution", "plan_review", "result", "gate", "evaluation"] as const).map((g) => {
          const list = groups[g];
          if (!list || list.length === 0) return null;
          const role = deriveAgentRole(list[0].event_type);
          const meta = AGENT_ROLE_META[role];
          const Icon = meta.icon;
          return (
            <span key={g} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.badgeClass}`}>
              <Icon className="h-3 w-3" aria-hidden />
              {EVENT_GROUP_LABEL[g]} ({list.length})
            </span>
          );
        })}
        {live && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
            LIVE
          </span>
        )}
      </div>

      {/* 对话流（按同发言人聚合） */}
      <div className="space-y-2.5">
        {speakerGroups.map((group) => (
          <SpeakerGroupBubble key={group.id} group={group} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 对话气泡组件
// ---------------------------------------------------------------------------

/** 按对话块类型分发渲染，透传 showHeader 控制头像/标签显隐。 */
function renderBlock(block: ConversationBlock, showHeader: boolean) {
  switch (block.kind) {
    case "turn":
      return (
        <ClaudeCodeTurnBubble
          key={`turn-${block.turn.turnNumber}`}
          turn={block.turn}
          showHeader={showHeader}
        />
      );
    case "plan_review":
      return (
        <EngineReviewBubble
          key={`review-${block.event.seq}`}
          ev={block.event}
          showHeader={showHeader}
        />
      );
    case "engine_event":
      return (
        <EngineEventBubble
          key={`engine-${block.event.seq}`}
          ev={block.event}
          label={block.label}
          showHeader={showHeader}
        />
      );
  }
}

/** 同发言人聚合气泡：单块组直接渲染，多块组共享头像+标签。 */
function SpeakerGroupBubble({ group }: { group: SpeakerGroup }) {
  const meta = AGENT_ROLE_META[group.role];
  const Icon = meta.icon;
  const isLeft = group.role === "claude_code";

  // 单块组：直接渲染完整气泡（向后兼容，零视觉变化）
  if (group.blocks.length === 1) {
    return renderBlock(group.blocks[0], true);
  }

  // 多块组：头像+标签仅显示一次，子气泡紧凑堆叠
  return (
    <div className={cn("flex gap-2.5 py-0.5", !isLeft && "flex-row-reverse")}>
      {/* 统一头像 */}
      <div className="flex shrink-0 flex-col items-center pt-2">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full",
          isLeft ? "bg-violet-500/10" : "bg-sky-500/10",
        )}>
          <Icon className={cn(
            "h-3.5 w-3.5",
            isLeft ? "text-violet-600 dark:text-violet-400" : "text-sky-600 dark:text-sky-400",
          )} />
        </div>
      </div>
      {/* 聚合内容区 */}
      <div className="min-w-0 max-w-[85%] space-y-1.5">
        {/* 统一发言人标签 */}
        <div className="flex items-center gap-2 px-1">
          <span className={cn(
            "text-[10px] font-semibold",
            isLeft ? "text-violet-600 dark:text-violet-400" : "text-sky-600 dark:text-sky-400",
          )}>
            {meta.label}
          </span>
        </div>
        {/* 子气泡（不含头像/发言人标签） */}
        {group.blocks.map((block) => renderBlock(block, false))}
      </div>
    </div>
  );
}

/** Claude Code Turn 气泡（左侧）—— 可折叠，默认收起。
 *  展开后 Turn 内事件平铺为 EventRow 列表。 */
function ClaudeCodeTurnBubble({
  turn,
  showHeader = true,
}: {
  turn: EventTurn;
  /** 是否显示头像列和发言人标签（聚合时子气泡设为 false）。 */
  showHeader?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const title = deriveTurnTitle(turn);

  return (
    <div className={cn("py-0.5", showHeader && "flex gap-2.5")}>
      {/* 左侧头像（仅独立渲染时显示） */}
      {showHeader && (
        <div className="flex shrink-0 flex-col items-center pt-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10">
            <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          </div>
        </div>
      )}
      {/* 气泡内容 */}
      <div
        className={cn(
          "min-w-0 rounded-2xl border p-3 shadow-sm transition-colors",
          showHeader ? "max-w-[85%] rounded-tl-sm" : "w-full",
          turn.hasError
            ? "border-red-500/30 bg-red-500/[0.03]"
            : "border-border bg-card",
        )}
      >
        {/* 可点击的折叠 Header */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
        >
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 text-text-muted transition-transform", !collapsed && "rotate-90")}
            aria-hidden
          />
          {showHeader && (
            <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
              Claude Code
            </span>
          )}
          <span className="text-[10px] font-medium text-foreground">Turn {turn.turnNumber}</span>
          <span className="text-[10px] tabular-nums text-text-muted">{turn.events.length} events</span>
          {turn.hasError && (
            <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:text-red-400">
              error
            </span>
          )}
          {/* 摘要标题（始终显示，帮助折叠态下快速了解 Turn 内容） */}
          <span className="min-w-0 flex-1 truncate text-[10px] text-text-muted" title={title}>
            {title}
          </span>
        </button>
        {/* EventRow 列表——展开态可见 */}
        {!collapsed && (
          <ol className="mt-1.5 space-y-1 border-l border-border pl-3">
            {turn.events.map((ev) => (
              <EventRow key={`${ev.seq}-${ev.id}`} ev={ev} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/** NegentropyEngine Plan Review 气泡（右侧）。 */
function EngineReviewBubble({ ev, showHeader = true }: { ev: RoutineIterationEventDTO; showHeader?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const payload = ev.payload as unknown as PlanReviewPayload;
  const verdict = payload?.verdict;
  const score = payload?.score;
  const moduleReviews = payload?.module_reviews;
  const feedback = payload?.feedback;
  const reflection = payload?.reflection;

  const verdictConfig: Record<string, { label: string; cls: string }> = {
    approve: { label: "✅ Approved", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    refine: { label: "🔄 Refine", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  };
  const vc = verdictConfig[verdict ?? ""] ?? { label: verdict ?? "Review", cls: "bg-muted/60 text-text-secondary" };

  return (
    <div className={cn("py-0.5", showHeader && "flex flex-row-reverse gap-2.5")}>
      {/* 右侧头像（仅独立渲染时显示） */}
      {showHeader && (
        <div className="flex shrink-0 flex-col items-center pt-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10">
            <Cpu className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
          </div>
        </div>
      )}
      {/* 气泡内容 */}
      <div className={cn("min-w-0 rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-3", showHeader ? "max-w-[85%] rounded-tr-sm" : "w-full")}>
        {/* Header（仅独立渲染时显示发言人标签，verdict/score 始终显示） */}
        <div className="mb-1.5 flex items-center justify-end gap-2">
          {showHeader && (
            <>
              <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                NegentropyEngine
              </span>
              <span className="text-[10px] text-text-muted">Plan Review</span>
            </>
          )}
          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", vc.cls)}>
            {vc.label}
          </span>
          {score != null && (
            <span className={cn("text-xs font-bold tabular-nums", score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")}>
              {score}
            </span>
          )}
        </div>

        {/* 模块评审列表 */}
        {moduleReviews && moduleReviews.length > 0 && (
          <div className="space-y-1">
            {moduleReviews.map((m, i) => (
              <div key={i} className="text-[11px] text-text-secondary">
                {m.status === "pass" ? "✅" : m.status === "warn" ? "⚠️" : "❌"}{" "}
                <span className="font-medium text-foreground">{m.module}</span>: {m.comment}
              </div>
            ))}
          </div>
        )}

        {/* 反馈文本 */}
        {feedback && (
          <div className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-text-secondary">
            {feedback}
          </div>
        )}

        {/* 反思（折叠） */}
        {reflection && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-[10px] text-text-muted hover:text-foreground"
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
            Reflection
          </button>
        )}
        {expanded && reflection && (
          <p className="mt-1 text-[11px] italic text-text-muted">{reflection}</p>
        )}

        {/* 详情（raw payload） */}
        {ev.created_at && (
          <div className="mt-2 text-[10px] tabular-nums text-text-muted">
            {new Date(ev.created_at).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

/** Engine 级事件（result / gate / evaluation）—— 右侧气泡样式。 */
function EngineEventBubble({ ev, label, showHeader = true }: { ev: RoutineIterationEventDTO; label: string; showHeader?: boolean }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const isError = payloadIsError(ev.payload);
  const hasDetail = ev.payload && Object.keys(ev.payload).length > 0;
  const p = ev.payload ?? {};

  // ---- event-type-specific content extraction ----
  const et = ev.event_type;

  // result
  const resultText = typeof p.result === "string" ? p.result : null;
  const numTurns = typeof p.num_turns === "number" ? p.num_turns : null;

  // gate
  const command = typeof p.command === "string" ? p.command : null;
  const exitCode = p.exit_code as number | null | undefined;
  const gateOutput = typeof p.output === "string" ? p.output : null;
  const gateFailed = exitCode != null && exitCode !== 0;

  // evaluation
  const score = typeof p.score === "number" ? p.score : null;
  const verdict = typeof p.verdict === "string" ? p.verdict : null;
  const reflection = typeof p.reflection === "string" ? p.reflection : null;

  // verdict badge config
  const verdictBadge: Record<string, { label: string; cls: string }> = {
    succeeded: { label: "✅ Succeeded", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    progressing: { label: "🔄 Progressing", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    failed: { label: "❌ Failed", cls: "bg-red-500/10 text-red-700 dark:text-red-300" },
  };
  const vb = verdictBadge[verdict ?? ""] ?? { label: verdict ?? label, cls: "bg-muted/60 text-text-secondary" };

  return (
    <div className={cn("py-0.5", showHeader && "flex flex-row-reverse gap-2.5")}>
      {/* 右侧头像（仅独立渲染时显示） */}
      {showHeader && (
        <div className="flex shrink-0 flex-col items-center pt-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10">
            <Cpu className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
          </div>
        </div>
      )}
      {/* 气泡 */}
      <div
        className={cn(
          "min-w-0 rounded-2xl border p-3",
          showHeader ? "max-w-[85%] rounded-tr-sm" : "w-full",
          isError || gateFailed
            ? "border-red-500/20 bg-red-500/[0.03]"
            : "border-sky-500/20 bg-sky-500/[0.03]",
        )}
      >
        {/* Header（仅独立渲染时显示发言人标签） */}
        <div className="mb-1.5 flex items-center justify-end gap-2">
          {showHeader && (
            <>
              <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                NegentropyEngine
              </span>
              <span className="text-[10px] text-text-muted">{label}</span>
            </>
          )}

          {/* Result badge */}
          {et === "result" && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                isError
                  ? "bg-red-500/10 text-red-700 dark:text-red-300"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {isError ? "❌ Error" : "✅ Success"}
            </span>
          )}

          {/* Gate badge */}
          {et === "gate" && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                gateFailed
                  ? "bg-red-500/10 text-red-700 dark:text-red-300"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {gateFailed ? `❌ Exit ${exitCode}` : "✅ Passed"}
            </span>
          )}

          {/* Evaluation badge + score */}
          {et === "evaluation" && (
            <>
              <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", vb.cls)}>
                {vb.label}
              </span>
              {score != null && (
                <span className={cn("text-xs font-bold tabular-nums", scoreColorClass(score))}>
                  {score}
                </span>
              )}
            </>
          )}

          {/* Cost (result) */}
          {ev.cost_usd != null && ev.cost_usd > 0 && (
            <span className="text-[10px] tabular-nums text-text-muted">${ev.cost_usd.toFixed(4)}</span>
          )}
        </div>

        {/* ---- Content by event type ---- */}

        {/* Result content */}
        {et === "result" && (
          <>
            {numTurns != null && (
              <div className="text-[11px] text-text-secondary">
                <span className="font-medium text-foreground">{numTurns}</span> turns
              </div>
            )}
            {resultText && (
              <div className="mt-1 line-clamp-3 text-[11px] text-text-secondary">{resultText}</div>
            )}
          </>
        )}

        {/* Gate content */}
        {et === "gate" && (
          <>
            {command && (
              <div className="rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] text-text-secondary">
                <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">$ </span>
                {command}
              </div>
            )}
            {gateOutput && (
              <div className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed text-text-secondary">
                {gateOutput.length > 500 ? gateOutput.slice(0, 500) + "…" : gateOutput}
              </div>
            )}
          </>
        )}

        {/* Evaluation content */}
        {et === "evaluation" && (
          <>
            {typeof p.error === "string" && (
              <div className="rounded-md border border-red-500/20 bg-red-500/[0.03] p-2 text-[11px] text-red-600 dark:text-red-400">
                {p.error}
              </div>
            )}
            {reflection && (
              <button
                type="button"
                onClick={() => setReflectionOpen((v) => !v)}
                className="mt-2 flex items-center gap-1 text-[10px] text-text-muted hover:text-foreground"
              >
                <ChevronRight className={cn("h-3 w-3 transition-transform", reflectionOpen && "rotate-90")} />
                Reflection
              </button>
            )}
            {reflectionOpen && reflection && (
              <p className="mt-1 text-[11px] italic text-text-muted">{reflection}</p>
            )}
          </>
        )}

        {/* Expandable raw detail */}
        {hasDetail && (
          <button
            type="button"
            onClick={() => setDetailOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-[10px] text-text-muted hover:text-foreground"
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform", detailOpen && "rotate-90")} />
            Detail
          </button>
        )}
        {detailOpen && hasDetail && (
          <div className="mt-1 rounded-md border border-border bg-muted/30 p-2">
            <EventDetail payload={ev.payload} />
          </div>
        )}

        {/* Timestamp */}
        {ev.created_at && (
          <div className="mt-2 text-[10px] tabular-nums text-text-muted">
            {new Date(ev.created_at).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 辅助函数（保持原有逻辑不变）
// ---------------------------------------------------------------------------

function groupEvents(events: RoutineIterationEventDTO[]): Record<EventGroup, RoutineIterationEventDTO[]> {
  const out: Record<EventGroup, RoutineIterationEventDTO[]> = {
    execution: [],
    plan_review: [],
    result: [],
    gate: [],
    evaluation: [],
  };
  for (const ev of [...events].sort((a, b) => a.seq - b.seq)) {
    out[eventGroup(ev.event_type)].push(ev);
  }
  return out;
}

/** payload 中代表「错误」的旗标（tool_result / result 的 is_error）。 */
function payloadIsError(payload: Record<string, unknown>): boolean {
  return payload?.is_error === true;
}

/** 从旧数据的 payload.raw 中 best-effort 提取 system subtype。
 *  旧持久化数据 title=null，payload.raw 包含原始 JSON（含 subtype 字段）。 */
function extractSubtitle(payload: Record<string, unknown> | null): string | null {
  const raw = payload?.raw;
  if (typeof raw === "object" && raw !== null)
    return ((raw as Record<string, unknown>).subtype as string) ?? null;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return (p?.subtype as string) ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// EventRow（对话气泡内的单行事件——保持时间线样式）
// ---------------------------------------------------------------------------

/**
 * 路径感知的单行标题拆分：以最后一个 ``/`` 切出末段（文件名）。
 * 仅当末段非空且不含空白才钉尾（规避对含空格命令/正则的误拆），否则整串走纯 truncate。
 */
function splitPathLikeTitle(title: string): { head: string; tail: string } {
  const i = title.lastIndexOf("/");
  if (i < 0) return { head: title, tail: "" };
  const tail = title.slice(i + 1);
  if (!tail || /\s/.test(tail)) return { head: title, tail: "" };
  return { head: title.slice(0, i + 1), tail };
}

/**
 * 单行「路径感知」标题。
 */
function EventTitle({ title }: { title: string }) {
  const { head, tail } = splitPathLikeTitle(title);
  return (
    <span className="flex min-w-0 flex-1 items-baseline text-xs text-foreground" title={title}>
      <span className="truncate">{head}</span>
      {tail && <span className="shrink-0">{tail}</span>}
    </span>
  );
}

function EventRow({ ev }: { ev: RoutineIterationEventDTO }) {
  const [open, setOpen] = useState(false);
  const isError = payloadIsError(ev.payload);
  const icon = eventTypeIcon(ev.event_type, ev.tool_name);
  const title = resolveEventTitle(ev.event_type, ev.title || extractSubtitle(ev.payload), ev.tool_name);
  const taskStatus = deriveTaskStatus(ev);
  const hasDetail = ev.payload && Object.keys(ev.payload).length > 0;

  return (
    <li className="relative -ml-px pl-4">
      {/* 时间线节点圆点 */}
      <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-card ${eventTypeClass(ev.event_type, isError)}`}
        >
          <EventIcon icon={icon} className="h-3 w-3" />
        </span>
      </span>

      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={hasDetail ? open : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          hasDetail ? "cursor-pointer hover:bg-muted/50" : "cursor-default",
        )}
      >
        {hasDetail && (
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 text-text-muted transition-transform", open && "rotate-90")}
            aria-hidden
          />
        )}
        <EventTitle title={title} />
        {taskStatus && (
          <span className="flex shrink-0 items-center gap-1">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${taskStatusDotClass(taskStatus)}`}
            />
            <span className="text-[9px] font-medium text-text-muted">{taskStatusLabel(taskStatus)}</span>
          </span>
        )}
        {isError && (
          <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:text-red-400">
            error
          </span>
        )}
        {ev.cost_usd != null && ev.cost_usd > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-text-muted">${ev.cost_usd.toFixed(4)}</span>
        )}
        {ev.created_at && (
          <span
            className="shrink-0 text-[10px] tabular-nums text-text-muted"
            title={new Date(ev.created_at).toLocaleString()}
          >
            {new Date(ev.created_at).toLocaleTimeString()}
          </span>
        )}
        <span className="shrink-0 text-[10px] tabular-nums text-text-muted">#{ev.seq}</span>
      </button>

      {open && hasDetail && (
        <div className="mb-1 ml-5 mt-1 space-y-2">
          <EventDetail payload={ev.payload} />
        </div>
      )}
    </li>
  );
}

/** 长文本字段（直接渲染为可读 pre，而非 JSON 字符串字面量）。 */
const TEXT_FIELDS = ["text", "output", "result", "prompt", "raw", "reflection", "command"] as const;

function EventDetail({ payload }: { payload: Record<string, unknown> }) {
  // 拆出长文本字段单独渲染（可读性优于 JSON 字面量），其余结构化字段交给 JsonViewer。
  const textBlocks: Array<{ key: string; value: string }> = [];
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if ((TEXT_FIELDS as readonly string[]).includes(k) && typeof v === "string" && v.length > 0) {
      textBlocks.push({ key: k, value: v });
    } else if (v !== null && v !== undefined && v !== "") {
      rest[k] = v;
    }
  }

  return (
    <>
      {textBlocks.map(({ key, value }) => (
        <div key={key}>
          <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">{key}</div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-text-secondary">
            {value}
          </pre>
        </div>
      ))}
      {Object.keys(rest).length > 0 && (
        <div className="rounded-md border border-border bg-muted/30 p-2">
          <JsonViewer data={rest} />
        </div>
      )}
    </>
  );
}
