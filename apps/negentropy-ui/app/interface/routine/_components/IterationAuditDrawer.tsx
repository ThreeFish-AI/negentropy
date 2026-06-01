/* eslint-disable react-hooks/set-state-in-effect --
 * 同 useRoutineDetailLive：打开抽屉 / 切换迭代时在 effect 内调 fetcher（间接 setState）的
 * 既有数据加载模式，配合 reqId 防竞态。
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BaseDrawer } from "@/components/ui/BaseDrawer";
import { ErrorBanner } from "@/components/ui/ErrorState";
import {
  fetchIterationEvents,
  type RoutineActionStreamEvent,
  type RoutineIterationDTO,
  type RoutineIterationEventDTO,
} from "@/features/routine";

import { IterationEventTimeline } from "./IterationEventTimeline";
import { phaseClass, phaseLabel, scoreColorClass, verdictClass } from "./status-style";

/** 在途（执行/评估流转中）的迭代状态：抽屉据此叠加实时动作并在终态时回查权威列表。 */
const IN_FLIGHT_STATUSES = new Set(["pending_approval", "dispatched", "in_flight", "executed"]);

interface IterationAuditDrawerProps {
  open: boolean;
  onClose: () => void;
  routineId: string;
  iteration: RoutineIterationDTO | null;
  /** 该迭代的实时动作缓冲（来自 useRoutineDetailLive，仅在途迭代有值）。 */
  liveActions?: RoutineActionStreamEvent[];
}

/**
 * 单次迭代「全过程」审计抽屉。
 *
 * 数据合并策略（持久化为事实源 + 实时为增强）：
 * - 打开时懒加载持久化事件（``fetchIterationEvents``）；
 * - 若迭代在途，叠加 ``liveActions`` 实时动作，按 ``seq`` 去重（持久化优先）后升序合并；
 * - 迭代到达终态后做一次回查，取含 gate/evaluation 的权威完整列表。
 */
export function IterationAuditDrawer({
  open,
  onClose,
  routineId,
  iteration,
  liveActions,
}: IterationAuditDrawerProps) {
  const [persisted, setPersisted] = useState<RoutineIterationEventDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const iterationId = iteration?.id ?? null;
  const isInFlight = !!iteration && IN_FLIGHT_STATUSES.has(iteration.status);

  const load = useCallback(async () => {
    if (!routineId || !iterationId) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    setPersisted([]);
    try {
      // 单迭代动作数有上界（后端封顶 1000），一次性取全量（limit=1000）。
      const res = await fetchIterationEvents(routineId, iterationId, { limit: 1000 });
      if (reqId !== reqIdRef.current) return;
      setPersisted(res.items);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setError(err instanceof Error ? err.message : "加载动作事件失败");
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [routineId, iterationId]);

  // 打开 / 切换迭代 → 拉取持久化事件（load 内部已重置列表）。
  useEffect(() => {
    if (open && iterationId) void load();
  }, [open, iterationId, load]);

  // 迭代到达终态（executed→evaluated 等）后回查一次，补齐 gate/evaluation 等终态事件。
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !iteration) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = iteration.status;
    if (prev && prev !== iteration.status && !IN_FLIGHT_STATUSES.has(iteration.status)) {
      void load();
    }
  }, [open, iteration, load]);

  // 合并持久化 + 实时（持久化优先），按 seq 去重升序。
  const merged = useMemo(() => mergeEvents(persisted, isInFlight ? (liveActions ?? []) : []), [persisted, liveActions, isInFlight]);

  const title = iteration ? `Iteration #${iteration.seq} · Full View` : "Full View";

  return (
    <BaseDrawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={iteration ? <IterationMetaBar iteration={iteration} /> : undefined}
      widthClassName="[width:66.67%]"
    >
      <div className="px-5 py-4">
        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading && merged.length === 0 ? (
          <TimelineSkeleton />
        ) : merged.length > 0 ? (
          <IterationEventTimeline events={merged} live={isInFlight} />
        ) : (
          !error && <EmptyState iteration={iteration} />
        )}
      </div>
    </BaseDrawer>
  );
}

/** 抽屉副标题：相位 / 状态 / verdict / 评分 + 成本 / 轮数 / session 元信息。 */
function IterationMetaBar({ iteration }: { iteration: RoutineIterationDTO }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {iteration.phase && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${phaseClass(iteration.phase)}`}>
          {phaseLabel(iteration.phase)}
        </span>
      )}
      <span className="text-[11px] text-text-muted">{iteration.status}</span>
      {iteration.verdict && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${verdictClass(iteration.verdict)}`}>
          {iteration.verdict}
        </span>
      )}
      {iteration.score != null && (
        <span className={`text-xs font-bold tabular-nums ${scoreColorClass(iteration.score)}`}>{iteration.score}</span>
      )}
      <span className="text-text-muted">·</span>
      <span className="text-[11px] tabular-nums text-text-muted">turns {iteration.turn_count}</span>
      <span className="text-[11px] tabular-nums text-text-muted">${iteration.cost_usd.toFixed(4)}</span>
      {iteration.claude_session_id && (
        <span className="truncate font-mono text-[10px] text-text-muted" title={iteration.claude_session_id}>
          {iteration.claude_session_id.slice(0, 8)}
        </span>
      )}
    </span>
  );
}

function EmptyState({ iteration }: { iteration: RoutineIterationDTO | null }) {
  let hint = "本轮暂无动作记录。";
  if (iteration?.status === "pending_approval") hint = "该迭代待审批，审批后开始执行并记录动作。";
  else if (iteration?.status === "dispatched") hint = "该迭代已派发，执行开始后将实时记录动作。";
  else if (iteration?.status === "aborted") hint = "该迭代已中止，未捕获动作记录。";
  else if (iteration?.status === "reaped") hint = "该迭代因执行超时被回收，未捕获完整动作记录。";
  return (
    <div className="rounded-card border border-dashed border-border bg-card py-12 text-center text-sm text-text-muted">
      {hint}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="加载中">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-3 flex-1 animate-pulse rounded bg-muted" style={{ maxWidth: `${70 - i * 6}%` }} />
        </div>
      ))}
    </div>
  );
}

/** 合并持久化事件与实时动作：以 seq 为键，持久化优先，升序输出。 */
function mergeEvents(
  persisted: RoutineIterationEventDTO[],
  live: RoutineActionStreamEvent[],
): RoutineIterationEventDTO[] {
  const bySeq = new Map<number, RoutineIterationEventDTO>();
  for (const a of live) {
    bySeq.set(a.seq, {
      id: `live-${a.iteration_id}-${a.seq}`,
      iteration_id: a.iteration_id,
      routine_id: a.routine_id,
      seq: a.seq,
      event_type: a.event_type,
      tool_name: a.tool_name ?? null,
      title: a.title ?? null,
      payload: a.payload ?? {},
      cost_usd: a.cost_usd ?? null,
      created_at: a.ts ?? null, // 服务端 emit 时刻：在途行据此显示时间戳（持久化后由 DB created_at 覆盖）
    });
  }
  for (const e of persisted) {
    bySeq.set(e.seq, e); // 持久化覆盖同 seq 的实时占位
  }
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}
