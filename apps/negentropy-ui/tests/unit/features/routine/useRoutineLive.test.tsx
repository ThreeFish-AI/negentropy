import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "@/features/routine/api";
import { liteFromIteration, useFleetSeed, useRoutineLive } from "@/features/routine/hooks/useRoutineLive";
import type {
  RoutineDTO,
  RoutineIterationDTO,
  RoutineIterationLite,
  RoutineKpis,
  RoutineStreamEvent,
} from "@/features/routine";

/**
 * useRoutineLive 实时数据层单测。
 *
 * 覆盖：① liteFromIteration 投影；② applyIterationEvent 的「新迭代客户端戳记 / 同迭代沿用」
 * 两条分支与缺字段早退；③ seedLatest 的「同迭代优先权威 started_at / 否则覆盖」；
 * ④ applyRoutineEvent / applyIterationEvent 去抖动触发列表 refresh；⑤ useFleetSeed 的
 * recent=1 探测回填与 active=false / 空候选短路。
 */

const KPIS: RoutineKpis = {
  total: 1,
  running: 1,
  paused: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
  pending: 0,
  total_cost_usd: 0,
  avg_iterations: 0,
};

function makeRoutine(id: string, status: RoutineDTO["status"] = "running"): RoutineDTO {
  return {
    id,
    key: id,
    title: id,
    display_name: null,
    description: null,
    goal: "g",
    acceptance_criteria: "ac",
    cwd: null,
    baseline_branch: null,
    verification_command: null,
    status,
    termination_reason: null,
    current_phase: null,
    pr_url: null,
    work_branch: null,
    worktree_path: null,
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
    is_template: false,
  };
}

function makeIteration(id: string): RoutineIterationDTO {
  return {
    id,
    routine_id: "r1",
    seq: 1,
    status: "in_flight",
    phase: null,
    prompt: null,
    resume_session_id: null,
    exec_status: null,
    summary: null,
    claude_session_id: null,
    cost_usd: 0.05,
    turn_count: 2,
    exec_error: null,
    score: null,
    verdict: null,
    reflection: null,
    eval_error: null,
    gate_exit_code: null,
    started_at: "2026-01-01T00:00:00.000Z",
    finished_at: null,
  };
}

describe("liteFromIteration", () => {
  it("将完整迭代 DTO 投影为字段子集 Lite", () => {
    const lite = liteFromIteration({
      id: "it1",
      seq: 2,
      status: "evaluated",
      phase: null,
      score: 80,
      verdict: "progressing",
      turn_count: 3,
      cost_usd: 0.12,
      started_at: "2026-01-01T00:00:00.000Z",
      finished_at: "2026-01-01T00:01:00.000Z",
    });
    expect(lite).toEqual({
      id: "it1",
      seq: 2,
      status: "evaluated",
      phase: null,
      score: 80,
      verdict: "progressing",
      turn_count: 3,
      cost_usd: 0.12,
      started_at: "2026-01-01T00:00:00.000Z",
      finished_at: "2026-01-01T00:01:00.000Z",
    });
  });
});

describe("useRoutineLive", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "fetchRoutines").mockResolvedValue({
      items: [makeRoutine("r1")],
      next_cursor: null,
      has_more: false,
    });
    vi.spyOn(api, "fetchKpis").mockResolvedValue(KPIS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applyIterationEvent: 新迭代进入 in_flight 时客户端戳记 started_at，同迭代后续事件沿用", async () => {
    const { result } = renderHook(() => useRoutineLive({}));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.applyIterationEvent({
        type: "iteration",
        id: "it1",
        routine_id: "r1",
        status: "in_flight",
        seq: 1,
        turn_count: 0,
        cost_usd: 0,
      } satisfies RoutineStreamEvent);
    });
    const first = result.current.latestByRoutine["r1"];
    expect(first?.status).toBe("in_flight");
    expect(first?.seq).toBe(1);
    expect(first?.started_at).toBeTruthy();

    // 同一迭代后续事件：沿用既有 started_at，并更新 score/verdict（走 cur 分支）。
    act(() => {
      result.current.applyIterationEvent({
        type: "iteration",
        id: "it1",
        routine_id: "r1",
        status: "evaluated",
        score: 88,
        verdict: "pass",
      } satisfies RoutineStreamEvent);
    });
    const second = result.current.latestByRoutine["r1"];
    expect(second?.status).toBe("evaluated");
    expect(second?.score).toBe(88);
    expect(second?.verdict).toBe("pass");
    expect(second?.started_at).toBe(first?.started_at);

    // 缺 routine_id 的事件被忽略（早退分支），不改变状态。
    act(() => {
      result.current.applyIterationEvent({ type: "iteration", id: "x", status: "in_flight" });
    });
    expect(Object.keys(result.current.latestByRoutine)).toEqual(["r1"]);
  });

  it("seedLatest: 同一迭代优先权威 started_at，缺失则回退已有客户端戳", () => {
    const { result } = renderHook(() => useRoutineLive({}));

    const authoritative: RoutineIterationLite = {
      id: "it1",
      seq: 1,
      status: "in_flight",
      started_at: "2026-01-01T00:00:00.000Z",
    };
    act(() => result.current.seedLatest("r1", authoritative));
    expect(result.current.latestByRoutine["r1"]?.started_at).toBe("2026-01-01T00:00:00.000Z");

    // 同 id 但新 lite 无 started_at → 回退已有；状态仍更新。
    act(() =>
      result.current.seedLatest("r1", { id: "it1", seq: 1, status: "executed", started_at: null }),
    );
    expect(result.current.latestByRoutine["r1"]?.status).toBe("executed");
    expect(result.current.latestByRoutine["r1"]?.started_at).toBe("2026-01-01T00:00:00.000Z");

    // 不同 routine：直接写入。
    act(() => result.current.seedLatest("r2", { id: "it9", seq: 1, status: "dispatched" }));
    expect(result.current.latestByRoutine["r2"]?.id).toBe("it9");
  });

  it("applyRoutineEvent / 重复调用合并去抖动，最终触发一次列表 refresh", async () => {
    const { result } = renderHook(() => useRoutineLive({}));
    await waitFor(() => expect(api.fetchRoutines).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.applyRoutineEvent();
      result.current.applyRoutineEvent(); // 第二次命中「已有待发」早退分支
    });

    await waitFor(() => expect(api.fetchRoutines).toHaveBeenCalledTimes(2), { timeout: 1500 });
  });
});

describe("useFleetSeed", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("为缺 started_at 的运行中 routine 拉 recent=1 并回填权威迭代", async () => {
    const detailSpy = vi.spyOn(api, "fetchRoutineDetail").mockResolvedValue({
      ...makeRoutine("r1"),
      iterations: [makeIteration("it1")],
    });
    const seed = vi.fn();

    renderHook(() => useFleetSeed(true, [makeRoutine("r1")], {}, seed));

    await waitFor(() => expect(detailSpy).toHaveBeenCalledWith("r1", 1));
    await waitFor(() =>
      expect(seed).toHaveBeenCalledWith("r1", expect.objectContaining({ id: "it1", started_at: "2026-01-01T00:00:00.000Z" })),
    );
  });

  it("active=false 时不发起探测", () => {
    const detailSpy = vi.spyOn(api, "fetchRoutineDetail");
    const seed = vi.fn();

    renderHook(() => useFleetSeed(false, [makeRoutine("r1")], {}, seed));

    expect(detailSpy).not.toHaveBeenCalled();
    expect(seed).not.toHaveBeenCalled();
  });

  it("已有带 started_at 的当前迭代时跳过该 routine（空候选短路）", () => {
    const detailSpy = vi.spyOn(api, "fetchRoutineDetail");
    const seed = vi.fn();
    const latest: Record<string, RoutineIterationLite> = {
      r1: { id: "it1", seq: 1, status: "in_flight", started_at: "2026-01-01T00:00:00.000Z" },
    };

    renderHook(() => useFleetSeed(true, [makeRoutine("r1")], latest, seed));

    expect(detailSpy).not.toHaveBeenCalled();
  });
});
