import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRoutineData } from "@/features/routine/hooks/useRoutineData";
import * as api from "@/features/routine/api";
import type { RoutineDTO, RoutineKpis } from "@/features/routine";

/**
 * useRoutineData hook 单测。
 *
 * 覆盖：① 挂载后并发拉取 list + kpis 并落地 state；② filters 变化触发重拉；
 * ③ 失败分支写入 error；④ refresh() 手动刷新。
 */

const KPIS: RoutineKpis = {
  total: 2,
  running: 1,
  paused: 0,
  succeeded: 1,
  failed: 0,
  cancelled: 0,
  pending: 0,
  total_cost_usd: 1.5,
  avg_iterations: 3,
};

function makeRoutine(id: string): RoutineDTO {
  return {
    id,
    key: id,
    title: id,
    display_name: null,
    description: null,
    goal: "g",
    acceptance_criteria: "ac",
    cwd: null,
    verification_command: null,
    status: "running",
    termination_reason: null,
    current_phase: null,
    pr_url: null,
    max_iterations: 20,
    max_cost_usd: 5,
    deadline_at: null,
    success_score_threshold: 85,
    no_progress_patience: 3,
    approval_mode: "auto",
    iteration_count: 0,
    total_cost_usd: 0,
    best_score: null,
    last_score: null,
    claude_session_id: null,
    reflections: [],
    config: {},
    owner_id: null,
    agent_id: null,
    created_at: null,
    updated_at: null,
  };
}

describe("useRoutineData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("挂载后并发拉取列表与 KPI 并落地 state", async () => {
    const listSpy = vi
      .spyOn(api, "fetchRoutines")
      .mockResolvedValue({ items: [makeRoutine("r1")], next_cursor: null, has_more: false });
    const kpiSpy = vi.spyOn(api, "fetchKpis").mockResolvedValue(KPIS);

    const { result } = renderHook(() => useRoutineData({ status: "running" }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.routines).toHaveLength(1);
    expect(result.current.routines[0].id).toBe("r1");
    expect(result.current.kpis).toMatchObject({ total: 2 });
    expect(result.current.error).toBeNull();
    expect(listSpy).toHaveBeenCalledWith({ status: "running" });
    expect(kpiSpy).toHaveBeenCalledTimes(1);
  });

  it("filters 变化时重新拉取", async () => {
    const listSpy = vi
      .spyOn(api, "fetchRoutines")
      .mockResolvedValue({ items: [], next_cursor: null, has_more: false });
    vi.spyOn(api, "fetchKpis").mockResolvedValue(KPIS);

    const { result, rerender } = renderHook((props: { q: string }) => useRoutineData(props), {
      initialProps: { q: "a" },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listSpy).toHaveBeenCalledTimes(1);

    rerender({ q: "b" });
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
    expect(listSpy).toHaveBeenLastCalledWith({ q: "b" });
  });

  it("拉取失败时写入 error 并停止 loading", async () => {
    vi.spyOn(api, "fetchRoutines").mockRejectedValue(new Error("network down"));
    vi.spyOn(api, "fetchKpis").mockResolvedValue(KPIS);

    const { result } = renderHook(() => useRoutineData({}));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("network down");
    expect(result.current.routines).toHaveLength(0);
  });

  it("refresh() 触发再次拉取", async () => {
    const listSpy = vi
      .spyOn(api, "fetchRoutines")
      .mockResolvedValue({ items: [], next_cursor: null, has_more: false });
    vi.spyOn(api, "fetchKpis").mockResolvedValue(KPIS);

    const { result } = renderHook(() => useRoutineData({}));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listSpy).toHaveBeenCalledTimes(1);

    await result.current.refresh();
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
  });
});
