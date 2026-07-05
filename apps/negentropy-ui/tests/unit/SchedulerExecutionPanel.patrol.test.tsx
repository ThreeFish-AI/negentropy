import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SchedulerExecutionPanel } from "@/app/interface/scheduler/_components/SchedulerExecutionPanel";
import type { TaskExecutionDTO } from "@/features/scheduler";

const baseExec = (over: Partial<TaskExecutionDTO>): TaskExecutionDTO => ({
  id: "e1",
  task_id: "t1",
  task_key: "pdf_fidelity_patrol",
  handler_kind: "pdf_fidelity_patrol",
  role: "supervisor",
  scenario: "pdf_fidelity",
  category: "cognitive",
  started_at: "2026-06-27T00:00:00Z",
  finished_at: "2026-06-27T00:00:01Z",
  status: "ok",
  duration_ms: 1000,
  tokens_used: null,
  output_summary: "patrol started: doc=d1",
  error: null,
  fire_reason: "tick",
  skill_id: null,
  skill_schedule_id: null,
  memory_id: null,
  pipeline_run_id: null,
  thread_id: null,
  metrics: {},
  ...over,
});

describe("SchedulerExecutionPanel — 派生 Routine 深链（metrics.routine_id）", () => {
  it("metrics.routine_id 存在时渲染「派生 Routine →」深链到 Routine 详情", () => {
    render(
      <SchedulerExecutionPanel
        executions={[baseExec({ metrics: { routine_id: "r-123", doc_id: "d1" } })]}
        loading={false}
      />,
    );
    const link = screen.getByText(/派生 Routine/).closest("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/interface/routine?sel=r-123");
  });

  it("无 metrics.routine_id 时不渲染派生链接", () => {
    render(<SchedulerExecutionPanel executions={[baseExec({ metrics: {} })]} loading={false} />);
    expect(screen.queryByText(/派生 Routine/)).toBeNull();
  });

  it("error 状态不渲染派生链接（即使带 metrics）", () => {
    render(
      <SchedulerExecutionPanel
        executions={[baseExec({ status: "failed", error: "boom", metrics: { routine_id: "r-9" } })]}
        loading={false}
      />,
    );
    expect(screen.queryByText(/派生 Routine/)).toBeNull();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("metrics.reason 存在时渲染跳过原因徽标（取代 silent ok）", () => {
    render(
      <SchedulerExecutionPanel
        executions={[baseExec({ metrics: { reason: "no_pending_docs" } })]}
        loading={false}
      />,
    );
    expect(screen.getByText("无待检 PDF 文档")).toBeInTheDocument();
  });

  it("metrics.reason=spawned 渲染「已派生 Routine」徽标 + 派生链接", () => {
    render(
      <SchedulerExecutionPanel
        executions={[baseExec({ metrics: { reason: "spawned", routine_id: "r-1", doc_id: "d-1" } })]}
        loading={false}
      />,
    );
    expect(screen.getByText("已派生 Routine")).toBeInTheDocument();
    // 同时存在「派生 Routine →」深链（用 role=link 精确定位，避开徽标文本）
    const link = screen.getByRole("link", { name: /派生 Routine/ });
    expect(link.getAttribute("href")).toBe("/interface/routine?sel=r-1");
  });
});
