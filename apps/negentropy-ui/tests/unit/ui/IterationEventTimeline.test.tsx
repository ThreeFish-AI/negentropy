import { fireEvent, render, screen } from "@testing-library/react";

import { describe, expect, it } from "vitest";

import { IterationEventTimeline } from "@/app/interface/routine/_components/IterationEventTimeline";
import type { RoutineIterationEventDTO } from "@/features/routine";

/**
 * 覆盖 paseo 风格扁平转录流（{@link IterationEventTimeline} → TranscriptView）：
 * - 工具调用呈紧凑单行（displayName + summary），点击就地展开命令/输出；
 * - assistant 文本行内流式 Markdown；
 * - system 事件标题翻译（SystemRow）；
 * - Engine 事件（result/gate/evaluation/plan_review）呈「Negentropy Engine」消息块；
 * - TaskCreate/TaskUpdate 行内状态指示；
 * - Engine 事件按 seq 时序交织；运行态脉冲。
 */

/** 构造一条审计事件（默认 tool_use/Read）。 */
function makeEvent(overrides: Partial<RoutineIterationEventDTO> = {}): RoutineIterationEventDTO {
  return {
    id: "e1",
    iteration_id: "it1",
    routine_id: "r1",
    seq: 1,
    event_type: "tool_use",
    tool_name: "Read",
    title: null,
    payload: {},
    cost_usd: null,
    created_at: "2026-06-01T09:08:07+00:00",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 工具调用行：displayName + summary（由 tool_name + payload.input 派生）
// ---------------------------------------------------------------------------

describe("IterationEventTimeline 工具调用行", () => {
  it("Read 行显示 'Read' 标签与文件路径摘要（路径进 title 悬浮）", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ tool_name: "Read", payload: { tool_id: "t1", input: { file_path: "src/app/page.tsx" } } })]}
      />,
    );
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("src/app/page.tsx")).toBeInTheDocument();
    expect(document.querySelector(`[title="src/app/page.tsx"]`)).not.toBeNull();
  });

  it("Bash 行显示为 'Shell' + 命令摘要", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ tool_name: "Bash", payload: { tool_id: "t1", input: { command: "git branch --show-current" } } })]}
      />,
    );
    expect(screen.getByText("Shell")).toBeInTheDocument();
    expect(screen.getByText("git branch --show-current")).toBeInTheDocument();
  });

  it("Grep 行显示为 'Search' + pattern 摘要", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ tool_name: "Grep", payload: { tool_id: "t1", input: { pattern: "useState" } } })]}
      />,
    );
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("useState")).toBeInTheDocument();
  });

  it("mcp__ 工具名归一为人读叶名", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ tool_name: "mcp__playwright__browser_navigate", payload: { tool_id: "t1", input: {} } })]}
      />,
    );
    expect(screen.getByText("Browser Navigate")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// tool_use ↔ tool_result 配对 + 就地展开
// ---------------------------------------------------------------------------

describe("IterationEventTimeline 工具展开与配对", () => {
  it("展开 Bash 行后显示配对 tool_result 的输出；折叠态不可见", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 1, tool_name: "Bash", payload: { tool_id: "t1", input: { command: "git status --short" } } }),
      makeEvent({ seq: 2, id: "e2", event_type: "tool_result", tool_name: null, payload: { tool_use_id: "t1", output: "M page.tsx", is_error: false } }),
    ];
    render(<IterationEventTimeline events={events} />);

    // 折叠态：输出不可见
    expect(screen.queryByText(/M page\.tsx/)).toBeNull();

    // 点击行展开
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/M page\.tsx/)).toBeInTheDocument();
  });

  it("tool_result.is_error 时行显示 error 徽章", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 1, tool_name: "Bash", payload: { tool_id: "t1", input: { command: "false" } } }),
      makeEvent({ seq: 2, id: "e2", event_type: "tool_result", tool_name: null, payload: { tool_use_id: "t1", output: "boom", is_error: true } }),
    ];
    render(<IterationEventTimeline events={events} />);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("tool_result 不单独渲染为行（被对应 tool_use 消费）", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 1, tool_name: "Read", payload: { tool_id: "t1", input: { file_path: "a.ts" } } }),
      makeEvent({ seq: 2, id: "e2", event_type: "tool_result", tool_name: null, payload: { tool_use_id: "t1", output: "x", is_error: false } }),
    ];
    render(<IterationEventTimeline events={events} />);
    // 仅一个工具行 button（tool_result 不再生成独立行）
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// assistant 文本：行内流式 Markdown
// ---------------------------------------------------------------------------

describe("IterationEventTimeline assistant 文本", () => {
  it("assistant 文本以 Markdown 段落渲染", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "assistant", tool_name: null, payload: { text: "正在检查当前分支。" } })]}
      />,
    );
    expect(screen.getByText("正在检查当前分支。")).toBeInTheDocument();
  });

  it("thinking 文本渲染其内容（不再显示『思考』标签）", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "assistant", title: "thinking", tool_name: null, payload: { text: "推理内容在此" } })]}
      />,
    );
    expect(screen.getByText("推理内容在此")).toBeInTheDocument();
    expect(screen.queryByText("思考")).not.toBeInTheDocument();
  });

  it("空 assistant（仅 raw、无 text）不渲染空行", () => {
    const { container } = render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "assistant", title: null, tool_name: null, payload: { raw: { foo: 1 } } })]}
      />,
    );
    // 转录流容器（.flex.flex-col）无子元素
    const flow = container.querySelector(".flex.flex-col");
    expect(flow?.children.length ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// system 事件标题翻译（SystemRow 保留 resolveEventTitle + raw.subtype 兜底）
// ---------------------------------------------------------------------------

describe("IterationEventTimeline system 事件标题翻译", () => {
  it("system/init 显示「会话初始化」", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "system", title: "init", tool_name: null, payload: { model: "claude-opus" } })]}
      />,
    );
    expect(screen.getByText("会话初始化")).toBeInTheDocument();
    expect(screen.queryByText("init")).not.toBeInTheDocument();
  });

  it("system/api_retry 显示「API 重试」", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "system", title: "api_retry", tool_name: null, payload: {} })]}
      />,
    );
    expect(screen.getByText("API 重试")).toBeInTheDocument();
  });

  it("旧持久化 system 事件（title=null，payload.raw 含 subtype）提取并翻译", () => {
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
    expect(screen.getByText("任务通知")).toBeInTheDocument();
  });

  it("未知 system 子类型回退显示「系统事件」", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "system", title: null, tool_name: null, payload: {} })]}
      />,
    );
    expect(screen.getByText("系统事件")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Engine 事件：Negentropy Engine 消息块
// ---------------------------------------------------------------------------

describe("IterationEventTimeline Engine 消息块", () => {
  it("result/success 显示 Negentropy Engine 标签、结果分组、Success 徽章与 turns 数", () => {
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
    expect(screen.getByText("Negentropy Engine")).toBeInTheDocument();
    expect(screen.getByText("结果 · Result")).toBeInTheDocument();
    expect(screen.getByText("✅ Success")).toBeInTheDocument();
    expect(screen.getByText((_c, el) => el?.textContent === "3 turns")).toBeInTheDocument();
  });

  it("gate 通过显示「✅ Passed」", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "gate", title: "gate", tool_name: null, payload: { command: "pnpm test", exit_code: 0, output: "OK" } })]}
      />,
    );
    expect(screen.getByText("✅ Passed")).toBeInTheDocument();
    expect(screen.getByText("门控 · Gate")).toBeInTheDocument();
  });

  it("evaluation 显示 verdict 徽章与评分", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "evaluation", title: "eval", tool_name: null, payload: { score: 90, verdict: "succeeded", reflection: "好" } })]}
      />,
    );
    expect(screen.getByText("✅ Succeeded")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
  });

  it("plan_review approve 显示「✅ Approved」", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "plan_review", title: "Plan Review", tool_name: null, payload: { verdict: "approve", score: 85, module_reviews: [], feedback: "", reflection: "" } })]}
      />,
    );
    expect(screen.getByText("✅ Approved")).toBeInTheDocument();
    expect(screen.getByText("Plan 审阅 · Review")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TaskCreate / TaskUpdate：行内状态指示
// ---------------------------------------------------------------------------

describe("IterationEventTimeline TaskCreate/TaskUpdate 状态指示", () => {
  it("TaskUpdate in_progress 显示蓝色脉冲状态点 + 标签", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ tool_name: "TaskUpdate", payload: { tool_id: "t1", input: { status: "in_progress", taskId: "3" } } })]}
      />,
    );
    expect(screen.getByText("in progress")).toBeInTheDocument();
    const dot = document.querySelector(".animate-pulse.inline-block");
    expect(dot).not.toBeNull();
    expect(dot?.className).toContain("bg-sky-500");
  });

  it("TaskUpdate completed 显示绿色状态点", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ tool_name: "TaskUpdate", payload: { tool_id: "t1", input: { status: "completed", taskId: "3" } } })]}
      />,
    );
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(document.querySelector(".bg-emerald-500.inline-block")).not.toBeNull();
  });

  it("TaskCreate 无显式 status 默认 pending，并以 subject 作摘要", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ tool_name: "TaskCreate", payload: { tool_id: "t1", input: { subject: "Fix auth" } } })]}
      />,
    );
    expect(screen.getByText("Fix auth")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(document.querySelector(".bg-text-muted.inline-block")).not.toBeNull();
  });

  it("非 Task 工具不显示状态指示器", () => {
    render(<IterationEventTimeline events={[makeEvent({ tool_name: "Read", payload: { tool_id: "t1", input: { file_path: "x.py" } } })]} />);
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
    expect(screen.queryByText("in progress")).not.toBeInTheDocument();
    expect(screen.queryByText("completed")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 交织排序：Engine 事件按 seq 时序穿插在 Claude Code 行之间
// ---------------------------------------------------------------------------

describe("IterationEventTimeline 交织排序", () => {
  /** 在转录流容器 innerHTML 中按出现位置断言时序严格递增。 */
  function expectOrder(container: HTMLElement, markers: string[]) {
    const flow = container.querySelector(".flex.flex-col");
    const html = flow?.innerHTML ?? "";
    const indices = markers.map((m) => html.indexOf(m));
    for (const idx of indices) expect(idx).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  }

  it("plan_review 按 seq 穿插在 assistant 文本之间", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "第一步" } }),
      makeEvent({ seq: 1, id: "e2", event_type: "plan_review", title: "Plan Review", tool_name: null, payload: { verdict: "approve", score: 85, module_reviews: [], feedback: "", reflection: "" } }),
      makeEvent({ seq: 2, id: "e3", event_type: "assistant", title: null, tool_name: null, payload: { text: "第二步" } }),
    ];
    const { container } = render(<IterationEventTimeline events={events} />);
    expectOrder(container, ["第一步", "✅ Approved", "第二步"]);
  });

  it("result/gate/evaluation 在最后的执行项之后按 seq 排列", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "执行中" } }),
      makeEvent({ seq: 1, id: "e2", event_type: "result", title: "success", tool_name: null, payload: { result: "done", is_error: false } }),
      makeEvent({ seq: 2, id: "e3", event_type: "gate", title: "gate", tool_name: null, payload: { command: "pytest", exit_code: 0, output: "OK" } }),
      makeEvent({ seq: 3, id: "e4", event_type: "evaluation", title: "eval", tool_name: null, payload: { score: 90, verdict: "succeeded", reflection: "好" } }),
    ];
    const { container } = render(<IterationEventTimeline events={events} />);
    expectOrder(container, ["执行中", "✅ Success", "✅ Passed", "✅ Succeeded"]);
  });

  it("纯 execution 事件无 Engine 块时仍正常渲染", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "干活" } }),
      makeEvent({ seq: 1, id: "e2", event_type: "tool_use", tool_name: "Read", payload: { tool_id: "t1", input: { file_path: "x.py" } } }),
    ];
    render(<IterationEventTimeline events={events} />);
    expect(screen.getByText("干活")).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.queryByText("Negentropy Engine")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 运行态：tool_use 无配对 result + live → 脉冲
// ---------------------------------------------------------------------------

describe("IterationEventTimeline 运行态", () => {
  it("在途 tool_use（无 tool_result）显示运行中脉冲点", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ tool_name: "Bash", payload: { tool_id: "t1", input: { command: "pnpm test" } } })]}
        live
      />,
    );
    const dot = document.querySelector(".animate-pulse.bg-sky-500");
    expect(dot).not.toBeNull();
  });

  it("非 live 时无运行中脉冲点", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ tool_name: "Bash", payload: { tool_id: "t1", input: { command: "pnpm test" } } })]}
      />,
    );
    // 顶部 LIVE 脉冲点（sky-500 animate-pulse）也不应存在
    expect(document.querySelector(".animate-pulse.bg-sky-500")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 空态
// ---------------------------------------------------------------------------

describe("IterationEventTimeline 空态", () => {
  it("无事件时返回 null（空态由抽屉统一渲染）", () => {
    const { container } = render(<IterationEventTimeline events={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
