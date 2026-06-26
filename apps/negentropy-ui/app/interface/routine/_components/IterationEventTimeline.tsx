"use client";

import { useMemo } from "react";

import {
  AGENT_ROLE_META,
  deriveAgentRole,
  type RoutineIterationEventDTO,
} from "@/features/routine";

import { EVENT_GROUP_LABEL, type EventGroup, eventGroup } from "./status-style";
import { TranscriptView } from "./transcript/TranscriptView";

/** 统一徽章胶囊基类（分组统计 pill）。 */
const BADGE_BASE = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";

/**
 * 单次迭代「全过程」动作时间线 —— paseo 风格扁平转录流。
 *
 * 保留顶部分组统计栏 + LIVE 脉冲；主体委托 {@link TranscriptView} 渲染：
 * Claude Code 的 assistant 文本与紧凑工具调用行，与 Negentropy Engine 消息块按 seq 时序交织。
 */
export function IterationEventTimeline({
  events,
  live,
}: {
  events: RoutineIterationEventDTO[];
  /** 是否处于在途实时态（显示 LIVE 脉冲；驱动工具行运行态）。 */
  live?: boolean;
}) {
  const groups = useMemo(() => groupEvents(events), [events]);

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
            <span key={g} className={`${BADGE_BASE} ${meta.badgeClass}`}>
              <Icon className="h-3 w-3" aria-hidden />
              {EVENT_GROUP_LABEL[g]} ({list.length})
            </span>
          );
        })}
        {live && (
          <span className="inline-flex items-center gap-1 text-caption font-semibold text-sky-600 dark:text-sky-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
            LIVE
          </span>
        )}
      </div>

      {/* 扁平转录流 */}
      <TranscriptView events={events} live={live} />
    </div>
  );
}

/** 按时间线分组键聚合事件（供统计栏计数）。 */
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
