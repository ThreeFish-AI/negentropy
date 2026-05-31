"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchRoutineDetail } from "../api";
import type {
  IterationStatus,
  RoutineDTO,
  RoutineFilters,
  RoutineIterationLite,
  RoutinePhase,
  RoutineStreamEvent,
  Verdict,
} from "../types";
import { useRoutineData } from "./useRoutineData";

/**
 * Routine 实时数据层 —— 在 [[useRoutineData]] 之上叠加：
 *
 * 1. **去抖动结构刷新**：SSE 事件不再每条触发全量重拉，而是合并到 ~500ms 尾沿，
 *    用于更新列表级数字（iteration_count / cost / best_score）与排序/KPI，杜绝 hammering。
 * 2. **latestByRoutine 映射**：按 routine_id 维护「当前迭代精简快照」，由 SSE 即时驱动闭环阶段，
 *    跨列表刷新存活（不被重拉清空）。
 * 3. **客户端起始时刻**：SSE ``in_flight`` 事件不带 started_at，首次见到即以客户端时刻近似戳记
 *    （误差 < 1s），配合 [[useRoutineData]] 列表与 ``recent=1`` 探测（authoritative started_at）。
 *
 * 订阅本身仍由页面持有的 [[useRoutineStream]] 负责（保留单连接 + connected 指示），
 * 本 hook 仅暴露事件应用方法供其回调。
 */

const REFRESH_DEBOUNCE_MS = 500;

type LatestMap = Record<string, RoutineIterationLite>;

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function useRoutineLive(filters: Partial<RoutineFilters>) {
  const base = useRoutineData(filters);
  const [latestByRoutine, setLatest] = useState<LatestMap>({});

  // 去抖动刷新：始终调用最新的 base.refresh（filterKey 变化时其 identity 会变）。
  const refreshRef = useRef(base.refresh);
  useEffect(() => {
    refreshRef.current = base.refresh;
  }, [base.refresh]);
  const debTimer = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (debTimer.current !== null) return; // 已有待发，合并
    debTimer.current = window.setTimeout(() => {
      debTimer.current = null;
      void refreshRef.current();
    }, REFRESH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debTimer.current !== null) window.clearTimeout(debTimer.current);
    };
  }, []);

  /** 直接以一个 Lite 覆盖某 routine 的当前迭代（用于 recent=1 探测 / 详情回填）。 */
  const seedLatest = useCallback((routineId: string, lite: RoutineIterationLite) => {
    setLatest((prev) => {
      const cur = prev[routineId];
      // 同一迭代时优先采用 lite 的 authoritative started_at，缺失才回退已有客户端近似戳。
      if (cur && cur.id && lite.id && cur.id === lite.id) {
        return { ...prev, [routineId]: { ...lite, started_at: lite.started_at ?? cur.started_at } };
      }
      return { ...prev, [routineId]: lite };
    });
  }, []);

  /** 应用一条 ``iteration`` 事件：合并到 latestByRoutine（按迭代 id 辨识换代）。 */
  const applyIterationEvent = useCallback(
    (ev: RoutineStreamEvent) => {
      const routineId = ev.routine_id;
      const status = ev.status as IterationStatus | undefined;
      if (!routineId || !status) return;
      const evId = typeof ev.id === "string" ? ev.id : undefined;

      setLatest((prev) => {
        const cur = prev[routineId];
        const isNewIteration = !cur || (evId !== undefined && cur.id !== evId);

        // 起始时刻：仅在「新迭代刚进入 in_flight」时以客户端时刻近似戳记。
        let startedAt = isNewIteration ? undefined : cur?.started_at;
        if (status === "in_flight" && !startedAt) {
          startedAt = new Date().toISOString();
        }

        const next: RoutineIterationLite = {
          id: evId ?? cur?.id,
          seq: asNumber(ev.seq) ?? (isNewIteration ? undefined : cur?.seq),
          status,
          phase: "phase" in ev ? ((ev.phase as RoutinePhase | null) ?? null) : isNewIteration ? null : cur?.phase,
          score: "score" in ev ? (asNumber(ev.score) ?? null) : isNewIteration ? null : cur?.score,
          verdict:
            "verdict" in ev
              ? ((ev.verdict as Verdict | null) ?? null)
              : isNewIteration
                ? null
                : cur?.verdict,
          turn_count: asNumber(ev.turn_count) ?? (isNewIteration ? undefined : cur?.turn_count),
          cost_usd: asNumber(ev.cost_usd) ?? (isNewIteration ? undefined : cur?.cost_usd),
          started_at: startedAt,
          finished_at: isNewIteration ? undefined : cur?.finished_at,
        };
        return { ...prev, [routineId]: next };
      });

      scheduleRefresh(); // 列表级数字（iteration_count/cost/best_score）稍后对齐
    },
    [scheduleRefresh],
  );

  /** 应用一条 ``routine`` 事件：结构性变化（状态/排序/KPI）去抖动重拉。 */
  const applyRoutineEvent = useCallback(() => {
    scheduleRefresh();
  }, [scheduleRefresh]);

  return {
    routines: base.routines,
    kpis: base.kpis,
    loading: base.loading,
    error: base.error,
    refresh: base.refresh,
    latestByRoutine,
    seedLatest,
    applyRoutineEvent,
    applyIterationEvent,
  };
}

/** 从完整迭代 DTO 投影出 Lite（供 recent=1 探测回填）。 */
export function liteFromIteration(it: {
  id: string;
  seq: number;
  status: IterationStatus;
  phase?: RoutinePhase | null;
  score: number | null;
  verdict: Verdict | null;
  turn_count: number;
  cost_usd: number;
  started_at: string | null;
  finished_at: string | null;
}): RoutineIterationLite {
  return {
    id: it.id,
    seq: it.seq,
    status: it.status,
    phase: it.phase ?? null,
    score: it.score,
    verdict: it.verdict,
    turn_count: it.turn_count,
    cost_usd: it.cost_usd,
    started_at: it.started_at,
    finished_at: it.finished_at,
  };
}

/**
 * Fleet 种子探测 —— 进入 Live 视图时，为缺失「当前迭代」信息的运行中/暂停 Routine
 * 拉一次 ``recent=1`` 详情回填 authoritative started_at。有界（一次性、按 routine 去重、
 * 上限封顶），非每 tick 轮询。
 */
const SEED_CAP = 24;

export function useFleetSeed(
  active: boolean,
  routines: RoutineDTO[],
  latestByRoutine: Record<string, RoutineIterationLite>,
  seedLatest: (routineId: string, lite: RoutineIterationLite) => void,
) {
  const seededRef = useRef<Set<string>>(new Set());
  const seedRef = useRef(seedLatest);
  useEffect(() => {
    seedRef.current = seedLatest;
  }, [seedLatest]);

  // 候选（纯属性派生，不读 ref）：运行中/暂停、且 map 中尚无带 started_at 的当前迭代。
  const candidates = useMemo(() => {
    if (!active) return [];
    return routines
      .filter((r) => r.status === "running" || r.status === "paused")
      .filter((r) => {
        const lite = latestByRoutine[r.id];
        return !lite || !lite.started_at;
      })
      .slice(0, SEED_CAP)
      .map((r) => r.id);
  }, [active, routines, latestByRoutine]);

  const candKey = candidates.join(",");

  useEffect(() => {
    // 去重（本会话未种过）在 effect 内读 ref，避免渲染期访问。
    const toSeed = candidates.filter((id) => !seededRef.current.has(id));
    if (toSeed.length === 0) return;
    let cancelled = false;
    for (const id of toSeed) seededRef.current.add(id);
    void Promise.all(
      toSeed.map(async (id) => {
        try {
          const detail = await fetchRoutineDetail(id, 1);
          const it = detail.iterations?.[0];
          if (cancelled) return seededRef.current.delete(id);
          if (it) seedRef.current(id, liteFromIteration(it));
        } catch {
          // 探测失败不致命：SSE 后续仍会驱动阶段（仅缺 authoritative started_at）。
          seededRef.current.delete(id);
        }
      }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 以稳定的 candKey 触发
  }, [candKey]);
}
