"use client";

import { useMemo, useState } from "react";
import { Bot, ChevronRight, Cpu, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { JsonViewer } from "@/components/ui/JsonViewer";
import {
  AGENT_ROLE_META,
  deriveAgentRole,
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

/** 默认展开策略：最后一轮 + 含错轮次 → 展开；其余 → 折叠。 */
function isTurnDefaultExpanded(turn: EventTurn, index: number, total: number): boolean {
  if (index === total - 1) return true; // 最后一轮：展开（当前活跃）
  if (turn.hasError) return true; // 含错轮次：展开（错误可见性）
  return false;
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
  | { kind: "turn"; turn: EventTurn; defaultExpanded: boolean }
  | { kind: "plan_review"; event: RoutineIterationEventDTO }
  | { kind: "system_event"; event: RoutineIterationEventDTO; label: string };

/** 将所有事件编排为对话块序列。 */
function buildConversationBlocks(
  groups: Record<EventGroup, RoutineIterationEventDTO[]>,
  execTurns: EventTurn[],
): ConversationBlock[] {
  const blocks: ConversationBlock[] = [];
  const order: EventGroup[] = ["execution", "plan_review", "result", "gate", "evaluation"];

  for (const g of order) {
    const list = groups[g];
    if (!list || list.length === 0) continue;

    if (g === "execution") {
      for (let i = 0; i < execTurns.length; i++) {
        const turn = execTurns[i];
        blocks.push({
          kind: "turn",
          turn,
          defaultExpanded: isTurnDefaultExpanded(turn, i, execTurns.length),
        });
      }
    } else if (g === "plan_review") {
      for (const ev of list) {
        blocks.push({ kind: "plan_review", event: ev });
      }
    } else {
      // result / gate / evaluation → 系统通知
      for (const ev of list) {
        blocks.push({ kind: "system_event", event: ev, label: EVENT_GROUP_LABEL[g] });
      }
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

/**
 * 单次迭代「全过程」动作时间线 —— 对话式布局。
 *
 * Claude Code 的 Turns 居左（被调用者），NegentropyEngine 的 Plan Review 居右（系统本我），
 * 系统级事件（gate / evaluation / result）居中。
 */
export function IterationEventTimeline({
  events,
  live,
}: {
  events: RoutineIterationEventDTO[];
  /** 是否处于在途实时态（显示 LIVE 脉冲）。 */
  live?: boolean;
}) {
  const groups = useMemo(() => groupEvents(events), [events]);
  const execTurns = useMemo(() => groupIntoTurns(groups.execution), [groups.execution]);
  const blocks = useMemo(() => buildConversationBlocks(groups, execTurns), [groups, execTurns]);

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

      {/* 对话流 */}
      <div className="space-y-2.5">
        {blocks.map((block) => {
          switch (block.kind) {
            case "turn":
              return (
                <ClaudeCodeTurnBubble
                  key={`turn-${block.turn.turnNumber}`}
                  turn={block.turn}
                  defaultExpanded={block.defaultExpanded}
                />
              );
            case "plan_review":
              return (
                <EngineReviewBubble
                  key={`review-${block.event.seq}`}
                  ev={block.event}
                />
              );
            case "system_event":
              return (
                <SystemEventPill
                  key={`sys-${block.event.seq}`}
                  ev={block.event}
                  label={block.label}
                />
              );
          }
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 对话气泡组件
// ---------------------------------------------------------------------------

/** Claude Code Turn 气泡（左侧）。 */
function ClaudeCodeTurnBubble({
  turn,
  defaultExpanded,
}: {
  turn: EventTurn;
  defaultExpanded: boolean;
}) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const expanded = manualExpanded ?? defaultExpanded;
  const title = deriveTurnTitle(turn);

  return (
    <div className="flex gap-2.5 py-0.5">
      {/* 左侧头像 */}
      <div className="flex shrink-0 flex-col items-center pt-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10">
          <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        </div>
      </div>
      {/* 气泡内容 */}
      <div
        className={cn(
          "min-w-0 max-w-[85%] rounded-2xl rounded-tl-sm border p-3 shadow-sm transition-colors",
          turn.hasError
            ? "border-red-500/30 bg-red-500/[0.03]"
            : "border-border bg-card",
        )}
      >
        {/* Header */}
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
            Claude Code
          </span>
          <span className="text-[10px] text-text-muted">Turn {turn.turnNumber}</span>
          <span className="text-[10px] tabular-nums text-text-muted">{turn.events.length} events</span>
          {turn.hasError && (
            <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:text-red-400">
              error
            </span>
          )}
        </div>
        {/* Turn 标题（可折叠） */}
        <button
          type="button"
          onClick={() => setManualExpanded((v) => !(v ?? defaultExpanded))}
          aria-expanded={expanded}
          className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/30"
        >
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 text-text-muted transition-transform", expanded && "rotate-90")}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-xs text-foreground" title={title}>
            {title}
          </span>
        </button>
        {/* 展开后的事件列表 */}
        {expanded && (
          <ol className="mt-2 space-y-1 border-l border-border pl-3">
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
function EngineReviewBubble({ ev }: { ev: RoutineIterationEventDTO }) {
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
    <div className="flex flex-row-reverse gap-2.5 py-0.5">
      {/* 右侧头像 */}
      <div className="flex shrink-0 flex-col items-center pt-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10">
          <Cpu className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
        </div>
      </div>
      {/* 气泡内容 */}
      <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tr-sm border border-sky-500/20 bg-sky-500/[0.03] p-3">
        {/* Header */}
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
            NegentropyEngine
          </span>
          <span className="text-[10px] text-text-muted">Plan Review</span>
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

/** 系统级事件（gate / evaluation / result）—— 居中 pill 样式。 */
function SystemEventPill({ ev, label }: { ev: RoutineIterationEventDTO; label: string }) {
  const [open, setOpen] = useState(false);
  const isError = payloadIsError(ev.payload);
  const icon = eventTypeIcon(ev.event_type, ev.tool_name);
  const title = resolveEventTitle(ev.event_type, ev.title || extractSubtitle(ev.payload), ev.tool_name);
  const hasDetail = ev.payload && Object.keys(ev.payload).length > 0;

  return (
    <div className="flex justify-center py-1">
      <div className="inline-flex max-w-[90%] flex-col items-center">
        <button
          type="button"
          onClick={() => hasDetail && setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
            isError
              ? "border-red-500/30 bg-red-500/[0.03] text-red-600 dark:text-red-400"
              : "border-border bg-muted/30 text-text-secondary hover:bg-muted/50",
            hasDetail && "cursor-pointer",
          )}
        >
          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${eventTypeClass(ev.event_type, isError)}`}>
            <EventIcon icon={icon} className="h-3 w-3" />
          </span>
          <span className="text-[10px] text-text-muted">{label}</span>
          <span className="truncate">{title}</span>
          {isError && (
            <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:text-red-400">
              error
            </span>
          )}
          {ev.cost_usd != null && ev.cost_usd > 0 && (
            <span className="text-[10px] tabular-nums text-text-muted">${ev.cost_usd.toFixed(4)}</span>
          )}
        </button>
        {open && hasDetail && (
          <div className="mt-2 w-full rounded-md border border-border bg-card p-3">
            <EventDetail payload={ev.payload} />
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
