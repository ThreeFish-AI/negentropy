import { fireEvent, render, screen } from "@testing-library/react";
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

/** 找到 ActionGroupRow 的折叠按钮（含 ChevronRight 的 button）并点击展开。 */
function expandFirstActionGroup() {
  // ActionGroupRow 的 button 带有 aria-expanded="false"
  const buttons = screen.getAllByRole("button");
  const actionBtn = buttons.find(
    (btn) => btn.getAttribute("aria-expanded") === "false" && btn.querySelector(".lucide-chevron-right"),
  );
  if (actionBtn) fireEvent.click(actionBtn);
}

describe("IterationEventTimeline 步骤行：路径完整度 + 每行时间戳", () => {
  it("路径标题：文件名尾部成独立块永不裁剪，完整标题进 title 悬浮", () => {
    const title = "Read /repo/a/b/c/target_file.py";
    render(<IterationEventTimeline events={[makeEvent({ title })]} />);
    // ActionGroupRow 折叠态使用 EventTitle 组件，同样做路径拆分
    expect(screen.getByText("target_file.py")).toBeInTheDocument();
    // 完整标题可悬浮查看（拆分为头/尾两段，故整串只存在于 title 属性）
    expect(document.querySelector(`[title="${title}"]`)).not.toBeNull();
  });

  it("每行渲染本地化时间戳，悬浮显示完整日期时间", () => {
    const created = "2026-06-01T09:08:07+00:00";
    render(<IterationEventTimeline events={[makeEvent({ created_at: created })]} />);
    // 时间戳在 ActionGroupRow 内部的 EventRow 中，需先展开
    expandFirstActionGroup();
    // 与组件同口径计算，规避 CI 时区/locale 漂移
    expect(screen.getByText(new Date(created).toLocaleTimeString())).toBeInTheDocument();
    expect(document.querySelector(`[title="${new Date(created).toLocaleString()}"]`)).not.toBeNull();
  });

  it("created_at 为空时不渲染时间戳（防御 null，覆盖在途未落库占位）", () => {
    const probe = new Date("2026-06-01T09:08:07+00:00").toLocaleTimeString();
    render(<IterationEventTimeline events={[makeEvent({ created_at: null })]} />);
    // ActionGroupRow 折叠态不显示时间戳，展开后也不应有
    expandFirstActionGroup();
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
    // Turn 展开 → ActionGroupRow 折叠态标题 + Turn header 均显示翻译后的标题
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
    // "思考" 出现在 ActionGroupRow 折叠态标题（deriveActionGroupTitle 优先使用已知子类型翻译）
    expect(screen.getAllByText("思考").length).toBeGreaterThanOrEqual(1);
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
    // payload.text "…" 被 ActionGroupRow 标题优先使用；展开后 EventRow 中显示「推理」
    expandFirstActionGroup();
    expect(screen.getAllByText("推理").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 交织排序：Engine 事件按 seq 时序穿插在 Claude Code Turn 之间
// ---------------------------------------------------------------------------

describe("IterationEventTimeline 交织排序", () => {
  /** 获取对话流容器的子元素列表，每个子元素即一个气泡行。 */
  function getFlowChildren(container: HTMLElement): Element[] {
    const flow = container.querySelector(".space-y-2\\.5");
    if (!flow) return [];
    return Array.from(flow.children);
  }

  /** 从气泡行列表中提取标签序列：Turn N / Plan Review / Result / Gate / Evaluation。 */
  function getBubbleLabels(rows: Element[]): string[] {
    return rows.map((el) => {
      // 使用 querySelector 精确匹配 header 内的标签 span
      // Claude Code Turn: header 含 "Claude Code" span
      const ccSpan = el.querySelector("span.text-violet-600, span.text-violet-400");
      if (ccSpan) {
        // 找同级的 "Turn N" span
        const turnSpan = el.querySelector("span.text-text-muted");
        if (turnSpan) {
          const m = turnSpan.textContent?.match(/^Turn (\d+)$/);
          if (m) return `Turn ${m[1]}`;
        }
        return "Turn ?";
      }
      // Engine 气泡：查 "NegentropyEngine" span 后的 type label
      const engineLabel = el.querySelector("span.text-sky-600, span.text-sky-400");
      if (engineLabel) {
        // 找同级的 label span
        const spans = el.querySelectorAll("span");
        for (const s of spans) {
          const t = s.textContent?.trim() ?? "";
          if (t === "Plan Review") return "Plan Review";
          if (t.startsWith("结果")) return "Result";
          if (t.startsWith("门控")) return "Gate";
          if (t.startsWith("评估")) return "Evaluation";
        }
      }
      return "Unknown";
    });
  }

  it("plan_review 按 seq 穿插在 Turn 之间（单 Turn 刷新）", () => {
    // seq=0 assistant → Turn 1 | seq=1 plan_review | seq=2 assistant → Turn 2
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "第一步" } }),
      makeEvent({ seq: 1, event_type: "plan_review", title: "Plan Review", tool_name: null, payload: { verdict: "approve", score: 85, module_reviews: [], feedback: null, reflection: null } }),
      makeEvent({ seq: 2, event_type: "assistant", title: null, tool_name: null, payload: { text: "第二步" } }),
    ];

    const { container } = render(<IterationEventTimeline events={events} />);
    const labels = getBubbleLabels(getFlowChildren(container));

    // 期望：Turn 1 → Plan Review → Turn 2（plan_review 按 seq 穿插在两个 Turn 之间）
    expect(labels).toEqual(["Turn 1", "Plan Review", "Turn 2"]);
  });

  it("result/gate/evaluation 在最后一个 Turn 之后按 seq 排列", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "执行" } }),
      makeEvent({ seq: 1, event_type: "result", title: "success", tool_name: null, payload: { result: "done", is_error: false } }),
      makeEvent({ seq: 2, event_type: "gate", title: "gate", tool_name: null, payload: { command: "pytest", exit_code: 0, output: "OK" } }),
      makeEvent({ seq: 3, event_type: "evaluation", title: "eval", tool_name: null, payload: { score: 90, verdict: "succeeded", reflection: "好" } }),
    ];

    const { container } = render(<IterationEventTimeline events={events} />);
    const labels = getBubbleLabels(getFlowChildren(container));

    // 期望：Turn 1 → Result → Gate → Evaluation
    expect(labels).toEqual(["Turn 1", "Result", "Gate", "Evaluation"]);
  });

  it("多个 plan_review 穿插时全局 Turn 编号连续", () => {
    // seq=0 assistant → Turn 1 | seq=1 plan_review | seq=2 assistant → Turn 2 | seq=3 plan_review | seq=4 assistant → Turn 3
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "第一步" } }),
      makeEvent({ seq: 1, event_type: "plan_review", title: "Plan Review", tool_name: null, payload: { verdict: "approve", score: 80, module_reviews: [], feedback: null, reflection: null } }),
      makeEvent({ seq: 2, event_type: "assistant", title: null, tool_name: null, payload: { text: "第二步" } }),
      makeEvent({ seq: 3, event_type: "plan_review", title: "Plan Review", tool_name: null, payload: { verdict: "refine", score: 60, module_reviews: [], feedback: null, reflection: null } }),
      makeEvent({ seq: 4, event_type: "assistant", title: null, tool_name: null, payload: { text: "第三步" } }),
    ];

    const { container } = render(<IterationEventTimeline events={events} />);
    const labels = getBubbleLabels(getFlowChildren(container));

    // 期望：Turn 1 → Plan Review → Turn 2 → Plan Review → Turn 3（编号连续不重置）
    expect(labels).toEqual(["Turn 1", "Plan Review", "Turn 2", "Plan Review", "Turn 3"]);
  });

  it("纯 execution 事件无 Engine 事件时仍正常渲染", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "干活" } }),
      makeEvent({ seq: 1, event_type: "tool_use", tool_name: "Read", title: "Read /x.py" }),
    ];

    const { container } = render(<IterationEventTimeline events={events} />);

    // 单个 Turn，无 Engine 气泡
    const labels = getBubbleLabels(getFlowChildren(container));
    expect(labels).toEqual(["Turn 1"]);
    expect(screen.queryByText("NegentropyEngine")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ActionGroup 分组测试
// ---------------------------------------------------------------------------

describe("IterationEventTimeline ActionGroup 分组", () => {
  /** 获取 Turn 内所有 ActionGroupRow 的折叠按钮。
   *  ActionGroupRow 渲染为 <li class="relative -ml-px pl-4">，内含 <button aria-expanded>。 */
  function getActionGroupButtons(container: HTMLElement): HTMLButtonElement[] {
    // ActionGroupRow 的 <li> 有 `relative -ml-px pl-4` class
    const lis = container.querySelectorAll("li.relative.pl-4");
    return Array.from(lis)
      .map((li) => li.querySelector<HTMLButtonElement>("button[aria-expanded]"))
      .filter((btn): btn is HTMLButtonElement => btn !== null);
  }

  /** 获取所有 ActionGroupRow 的标题（从 button 内的 [title] 属性提取）。 */
  function getActionGroupTitles(container: HTMLElement): string[] {
    return getActionGroupButtons(container).map((btn) => {
      const titleEl = btn.querySelector("[title]");
      return titleEl?.getAttribute("title") ?? "";
    });
  }

  it("典型 [assistant, tool_use, tool_result] 序列聚合为 1 个动作组", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "让我读取文件" } }),
      makeEvent({ seq: 1, event_type: "tool_use", tool_name: "Read", title: "Read /src/main.ts" }),
      makeEvent({ seq: 2, event_type: "tool_result", tool_name: null, title: null, payload: { text: "file content" } }),
    ];
    const { container } = render(<IterationEventTimeline events={events} />);

    // 应有 1 个 ActionGroupRow，标题为 tool_use 的标题
    const titles = getActionGroupTitles(container);
    expect(titles.length).toBe(1);
    expect(titles).toContain("Read /src/main.ts");
  });

  it("多个 [assistant, tool_use, tool_result] 序列分为多个动作组", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "第一步" } }),
      makeEvent({ seq: 1, event_type: "tool_use", tool_name: "Read", title: "Read /a.ts" }),
      makeEvent({ seq: 2, event_type: "tool_result", tool_name: null, title: null, payload: {} }),
      makeEvent({ seq: 3, event_type: "assistant", title: null, tool_name: null, payload: { text: "第二步" } }),
      makeEvent({ seq: 4, event_type: "tool_use", tool_name: "Edit", title: "Edit /a.ts" }),
      makeEvent({ seq: 5, event_type: "tool_result", tool_name: null, title: null, payload: {} }),
      makeEvent({ seq: 6, event_type: "assistant", title: null, tool_name: null, payload: { text: "完成" } }),
    ];
    const { container } = render(<IterationEventTimeline events={events} />);

    const titles = getActionGroupTitles(container);
    // 3 个 ActionGroup: Read, Edit, "完成"
    expect(titles.length).toBe(3);
    expect(titles).toContain("Read /a.ts");
    expect(titles).toContain("Edit /a.ts");
  });

  it("单个 system 事件形成独立动作组", () => {
    render(
      <IterationEventTimeline
        events={[makeEvent({ event_type: "system", title: "init", tool_name: null, payload: {} })]}
      />,
    );
    // ActionGroupRow 标题为 "会话初始化"
    expect(screen.getAllByText("会话初始化").length).toBeGreaterThanOrEqual(1);
  });

  it("并行 tool_use 事件归入同一动作组", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "并行读取" } }),
      makeEvent({ seq: 1, event_type: "tool_use", tool_name: "Read", title: "Read /a.ts" }),
      makeEvent({ seq: 2, event_type: "tool_use", tool_name: "Read", title: "Read /b.ts" }),
      makeEvent({ seq: 3, event_type: "tool_result", tool_name: null, title: null, payload: {} }),
      makeEvent({ seq: 4, event_type: "tool_result", tool_name: null, title: null, payload: {} }),
    ];
    const { container } = render(<IterationEventTimeline events={events} />);

    // 只有 1 个 ActionGroupRow，标题为首个 tool_use 的标题
    const titles = getActionGroupTitles(container);
    expect(titles.length).toBe(1);
    expect(titles).toContain("Read /a.ts");
  });

  it("ActionGroupRow count > 1 时渲染数量 badge", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "动作" } }),
      makeEvent({ seq: 1, event_type: "tool_use", tool_name: "Read", title: "Read /x.ts" }),
      makeEvent({ seq: 2, event_type: "tool_result", tool_name: null, title: null, payload: {} }),
    ];
    const { container } = render(<IterationEventTimeline events={events} />);

    // 数量 badge 在 ActionGroupRow 按钮内，显示 "3"
    const btn = getActionGroupButtons(container)[0];
    expect(btn?.textContent).toContain("3");
  });

  it("ActionGroupRow hasError 时渲染错误 badge", () => {
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "尝试" } }),
      makeEvent({ seq: 1, event_type: "tool_use", tool_name: "Bash", title: "Bash: fail" }),
      makeEvent({ seq: 2, event_type: "tool_result", tool_name: null, title: null, payload: { is_error: true, text: "error output" } }),
    ];
    const { container } = render(<IterationEventTimeline events={events} />);

    // 错误 badge 在 ActionGroupRow 按钮内
    const btn = getActionGroupButtons(container)[0];
    const errorBadge = btn?.querySelector(".bg-red-500\\/10");
    expect(errorBadge?.textContent).toContain("error");
  });

  it("点击 ActionGroupRow 展开后显示 EventRow 列表", () => {
    const created = "2026-06-01T09:08:07+00:00";
    const events: RoutineIterationEventDTO[] = [
      makeEvent({ seq: 0, event_type: "assistant", title: null, tool_name: null, payload: { text: "动作" } }),
      makeEvent({ seq: 1, event_type: "tool_use", tool_name: "Read", title: "Read /x.ts", created_at: created }),
      makeEvent({ seq: 2, event_type: "tool_result", tool_name: null, title: null, payload: {} }),
    ];
    const { container } = render(<IterationEventTimeline events={events} />);

    // 展开前：ActionGroupRow 折叠态，内部 EventRow 不在 DOM
    const btn = getActionGroupButtons(container)[0];
    expect(btn?.getAttribute("aria-expanded")).toBe("false");

    // 点击展开
    fireEvent.click(btn!);

    // 展开后：EventRow 可见（通过 seq 标记确认）
    expect(screen.getByText("#1")).toBeInTheDocument();
    // 时间戳也可见（可能多个 EventRow 有相同时间戳，用 getAllByText）
    expect(screen.getAllByText(new Date(created).toLocaleTimeString()).length).toBeGreaterThanOrEqual(1);
  });
});
