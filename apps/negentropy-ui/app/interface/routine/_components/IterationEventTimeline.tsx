"use client";

import { useMemo, useState } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { JsonViewer } from "@/components/ui/JsonViewer";
import type { RoutineIterationEventDTO } from "@/features/routine";

import {
  EVENT_GROUP_LABEL,
  type EventGroup,
  eventGroup,
  eventTypeClass,
  eventTypeIcon,
  eventTypeLabel,
} from "./status-style";

/** 渲染 Lucide 图标 —— 以 prop 传入组件引用，避免「render 期间创建组件」lint 误报。 */
function EventIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon className={className} aria-hidden />;
}

/**
 * 单次迭代「全过程」动作时间线 —— 纵向、单列、可扫读（LangSmith / Langfuse run 视图范式）。
 *
 * 每个动作：左侧类型图标（颜色 + 图标双编码）+ 单行标题 + 可点击展开输入/输出/上下文。
 * 结构化 payload 用 JsonViewer（折叠树 + 复制），长文本/命令输出用 <pre> 保留换行与截断标记。
 * 动作按 执行(execution) → 结果(result) → 门控(gate) → 评估(evaluation) 分组。
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

  if (events.length === 0) {
    return null; // 空态由抽屉统一渲染（区分待审批/已中止/capture 关闭等上下文）
  }

  const order: EventGroup[] = ["execution", "result", "gate", "evaluation"];

  return (
    <div className="space-y-5">
      {order.map((g) => {
        const list = groups[g];
        if (!list || list.length === 0) return null;
        return (
          <section key={g}>
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {EVENT_GROUP_LABEL[g]}
              </h4>
              <span className="text-[10px] tabular-nums text-text-muted">{list.length}</span>
              {live && g === "execution" && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                  LIVE
                </span>
              )}
            </div>
            <ol className="relative space-y-1 border-l border-border pl-0">
              {list.map((ev) => (
                <EventRow key={`${ev.seq}-${ev.id}`} ev={ev} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function groupEvents(events: RoutineIterationEventDTO[]): Record<EventGroup, RoutineIterationEventDTO[]> {
  const out: Record<EventGroup, RoutineIterationEventDTO[]> = {
    execution: [],
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

function EventRow({ ev }: { ev: RoutineIterationEventDTO }) {
  const [open, setOpen] = useState(false);
  const isError = payloadIsError(ev.payload);
  const icon = eventTypeIcon(ev.event_type, ev.tool_name);
  const title = ev.title || ev.tool_name || eventTypeLabel(ev.event_type);
  const hasDetail = ev.payload && Object.keys(ev.payload).length > 0;

  return (
    <li className="relative -ml-px pl-4">
      {/* 时间线节点圆点 */}
      <span className="absolute left-0 top-2.5 -translate-x-1/2">
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
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
          hasDetail ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
        }`}
      >
        {hasDetail && (
          <ChevronRight
            className={`h-3 w-3 shrink-0 text-text-muted transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          />
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-foreground" title={title}>
          {title}
        </span>
        {isError && (
          <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:text-red-400">
            error
          </span>
        )}
        {ev.cost_usd != null && ev.cost_usd > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-text-muted">${ev.cost_usd.toFixed(4)}</span>
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
