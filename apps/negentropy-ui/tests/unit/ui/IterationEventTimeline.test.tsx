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

describe("IterationEventTimeline 事件标题翻译", () => {
  it("system/init 显示「会话初始化」而非原始 'init'", () => {
    render(
      <IterationEventTimeline
        events={[
          makeEvent({ event_type: "system", title: "init", tool_name: null, payload: { model: "claude-opus" } }),
        ]}
      />,
    );
    // Turn 聚合后，标题同时出现在 ClaudeCodeTurnBubble header 和嵌套 EventRow，故用 getAllByText
    expect(screen.getAllByText("会话初始化").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("init")).not.toBeInTheDocument();
  });

  it("system 非 init（有 title）显示翻译后的子类型标签", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "system", title: "api_retry", tool_name: null, payload: {} })]}
      />,
    );
    expect(screen.getAllByText("API 重试").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("api_retry")).not.toBeInTheDocument();
  });

  it("system/task_started 显示「后台任务启动」", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "system", title: "task_started", tool_name: null, payload: {} })]}
      />,
    );
    expect(screen.getAllByText("后台任务启动").length).toBeGreaterThanOrEqual(1);
  });

  it("system/task_progress 显示「任务进度」", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "system", title: "task_progress", tool_name: null, payload: {} })]}
      />,
    );
    expect(screen.getAllByText("任务进度").length).toBeGreaterThanOrEqual(1);
  });

  it("旧持久化 system 事件（title=null，payload.raw 中含 subtype）提取并翻译子类型", () => {
    render(
      <IterationEventTimeline
        events={[
          makeEvent({
            event_type: "system",
            title: null,
            tool_name: null,
            payload: { raw: { type: "system", subtype: "task_notification" } },
          }),
        ]}
      />,
    );
    expect(screen.getAllByText("任务通知").length).toBeGreaterThanOrEqual(1);
  });

  it("未知 system 子类型回退显示「系统事件」", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "system", title: null, tool_name: null, payload: {} })]}
      />,
    );
    expect(screen.getAllByText("系统事件").length).toBeGreaterThanOrEqual(1);
  });

  it("assistant/thinking 显示「思考」而非原始 'thinking'", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "assistant", title: "thinking", tool_name: null, payload: { text: "…" } })]}
      />,
    );
    expect(screen.getByText("思考")).toBeInTheDocument();
    expect(screen.queryByText("thinking")).not.toBeInTheDocument();
  });

  it("result/success 渲染为 EngineEventBubble，显示 NegentropyEngine 标签和 Success badge", () => {
    render(
      <IterationEventTimeline
        events={[
          makeEvent({
            event_type: "result",
            title: "success",
            tool_name: null,
            payload: { result: "done", is_error: false, num_turns: 3 },
          }),
        ]}
      />,
    );
    // EngineEventBubble 显示 NegentropyEngine 标签
    expect(screen.getByText("NegentropyEngine")).toBeInTheDocument();
    // 显示「结果 · Result」分组标签
    expect(screen.getByText("结果 · Result")).toBeInTheDocument();
    // 成功时显示 ✅ Success badge
    expect(screen.getByText("✅ Success")).toBeInTheDocument();
    // 显示 turns 数（数字在 <span> 内，" turns" 在外层 div，用函数匹配器）
    expect(screen.getByText((_content, el) => el?.textContent === "3 turns")).toBeInTheDocument();
    // 不显示原始 'success' 文本
    expect(screen.queryByText("success")).not.toBeInTheDocument();
  });

  it("tool_use 描述性标题不受翻译影响（透传原始 title）", () => {
    render(<IterationEventTimeline events={[makeEvent({ title: "Read /repo/app.py" })]} />);
    expect(screen.getByText("app.py")).toBeInTheDocument(); // 路径拆分后文件名独立
    expect(screen.queryByText("Read /repo/app.py")).not.toBeInTheDocument(); // 整串不在文本中
  });

  it("assistant 无 title 回退显示「推理」", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "assistant", title: null, tool_name: null, payload: { text: "…" } })]}
      />,
    );
    expect(screen.getByText("推理")).toBeInTheDocument();
  });
});
