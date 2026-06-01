import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IterationEventTimeline } from "@/app/interface/routine/_components/IterationEventTimeline";
import type { RoutineIterationEventDTO } from "@/features/routine";

/** 构造一条 tool_use 审计事件（归入「执行」分组，必渲染一行）。 */
function makeEvent(overrides: Partial<RoutineIterationEventDTO> = {}): RoutineIterationEventDTO {
  return {
    id: "e1",
    iteration_id: "it1",
    routine_id: "r1",
    seq: 1,
    event_type: "tool_use",
    tool_name: "Read",
    title: "Read /repo/a/b/c/target_file.py",
    payload: {},
    cost_usd: null,
    created_at: "2026-06-01T09:08:07+00:00",
    ...overrides,
  };
}

describe("IterationEventTimeline 步骤行：路径完整度 + 每行时间戳", () => {
  it("路径标题：文件名尾部成独立块永不裁剪，完整标题进 title 悬浮", () => {
    const title = "Read /repo/a/b/c/target_file.py";
    render(<IterationEventTimeline events={[makeEvent({ title })]} />);
    // 文件名尾部单独成 span（前缀即便被 truncate 也不会丢失）
    expect(screen.getByText("target_file.py")).toBeInTheDocument();
    // 完整标题可悬浮查看（拆分为头/尾两段，故整串只存在于 title 属性）
    expect(document.querySelector(`[title="${title}"]`)).not.toBeNull();
  });

  it("每行渲染本地化时间戳，悬浮显示完整日期时间", () => {
    const created = "2026-06-01T09:08:07+00:00";
    render(<IterationEventTimeline events={[makeEvent({ created_at: created })]} />);
    // 与组件同口径计算，规避 CI 时区/locale 漂移
    expect(screen.getByText(new Date(created).toLocaleTimeString())).toBeInTheDocument();
    expect(document.querySelector(`[title="${new Date(created).toLocaleString()}"]`)).not.toBeNull();
  });

  it("created_at 为空时不渲染时间戳（防御 null，覆盖在途未落库占位）", () => {
    const probe = new Date("2026-06-01T09:08:07+00:00").toLocaleTimeString();
    render(<IterationEventTimeline events={[makeEvent({ created_at: null })]} />);
    expect(screen.queryByText(probe)).toBeNull();
  });

  it("非路径标题（无斜杠）整串渲染，不误拆尾段", () => {
    render(<IterationEventTimeline events={[makeEvent({ tool_name: "Bash", title: "Bash: pytest -q" })]} />);
    expect(screen.getByText("Bash: pytest -q")).toBeInTheDocument();
  });
});
