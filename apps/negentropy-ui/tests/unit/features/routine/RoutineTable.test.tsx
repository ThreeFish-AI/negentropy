import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoutineTable } from "@/app/interface/routine/_components/RoutineTable";
import type { RoutineDTO } from "@/features/routine";

/**
 * RoutineTable 列表渲染单测——覆盖本轮改造的关键行为：
 *  ① 任务 ID 独立列渲染 `key` + Copy 按钮；点击复制写入剪贴板且**不**触发行 `onSelect`（验证 stopPropagation）；
 *  ② STATUS 单元格：`succeeded` 芯片存在，且冗余的 `success`（termination_reason）不再单独渲染；
 *  ③ 非 success 的终止原因（如 `no_progress`）仍可见。
 *
 * 注意：jsdom 与 tests/setup.ts 均未提供 Clipboard API，故在此显式桩 `navigator.clipboard.writeText`。
 */

function makeRoutine(overrides: Partial<RoutineDTO> = {}): RoutineDTO {
  return {
    id: "id-1",
    key: "pdf-fidelity-patrol/387cc29b-c08f-49a1-9fc1-995b2782abcd",
    title: "PDF Fidelity Patrol · Demo",
    display_name: null,
    description: null,
    goal: "g",
    acceptance_criteria: "ac",
    cwd: null,
    baseline_branch: null,
    repository_id: null,
    verification_command: null,
    status: "succeeded",
    termination_reason: "success",
    current_phase: null,
    pr_url: null,
    pr_merged: null,
    pr_state: null,
    work_branch: null,
    worktree_path: null,
    max_iterations: 400,
    max_cost_usd: 1500,
    deadline_at: null,
    success_score_threshold: 85,
    no_progress_patience: 3,
    approval_mode: "auto",
    iteration_count: 6,
    total_cost_usd: 26.758,
    best_score: 95,
    last_score: 95,
    claude_session_id: null,
    reflections: [],
    config: {},
    owner_id: null,
    agent_id: null,
    created_at: null,
    updated_at: "2026-07-01T22:57:52Z",
    is_template: false,
    ...overrides,
  };
}

describe("RoutineTable", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    // jsdom 无 Clipboard API —— 显式桩，供 CopyButton 的 navigator.clipboard.writeText 调用。
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("任务 ID 独立列渲染 key + Copy 按钮；点击复制写剪贴板且不触发行 onSelect", () => {
    const onSelect = vi.fn();
    const r = makeRoutine();
    render(
      <RoutineTable routines={[r]} loading={false} onSelect={onSelect} onOpenFull={vi.fn()} />,
    );

    // ID 列展示完整 key（截断由 CSS 处理，DOM 文本仍是全量）。
    expect(screen.getByText(r.key)).toBeInTheDocument();

    // 存在带无障碍标签的 Copy 按钮。
    const copyBtn = screen.getByRole("button", { name: "复制 ID" });
    fireEvent.click(copyBtn);

    // writeText 以完整 key 同步调用（在 await 挂起前）。
    expect(writeText).toHaveBeenCalledWith(r.key);
    // stopPropagation 生效：点击复制不冒泡触发行级 onSelect（打开详情）。
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("STATUS：succeeded 芯片存在，且冗余的 success 文案不再单独渲染", () => {
    render(
      <RoutineTable
        routines={[makeRoutine({ status: "succeeded", termination_reason: "success" })]}
        loading={false}
        onSelect={vi.fn()}
        onOpenFull={vi.fn()}
      />,
    );

    expect(screen.getByText("succeeded")).toBeInTheDocument();
    // 冗余的 "success"（原 termination_reason 行）应被抑制。
    expect(screen.queryByText("success")).not.toBeInTheDocument();
  });

  it("STATUS：非 success 的终止原因（no_progress）仍可见", () => {
    render(
      <RoutineTable
        routines={[makeRoutine({ status: "failed", termination_reason: "no_progress" })]}
        loading={false}
        onSelect={vi.fn()}
        onOpenFull={vi.fn()}
      />,
    );

    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("no_progress")).toBeInTheDocument();
  });
});
