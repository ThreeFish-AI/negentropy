/**
 * ReasoningPanel 单元测试（P2-4 G3）
 *
 * 验证：
 * - mergeSteps 同 stepId 去重 + finished 优先；
 * - 默认收起 / 点击展开 / localStorage 持久化；
 * - 50 步硬上限 + "+N 更多" 折叠；
 * - 空 steps 不渲染（hasReasoning 守卫）。
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ReasoningPanel,
  mergeSteps,
  type ReasoningStepData,
} from "@/components/ui/ReasoningPanel";

const STORAGE_KEY = "home.reasoning_panel.expanded";

const step = (id: string, stepId: string, phase: "started" | "finished", title = "PerceptionFaculty"): ReasoningStepData => ({
  id,
  stepId,
  phase,
  title,
});

describe("mergeSteps", () => {
  it("同 stepId 的 started 后接 finished → 仅保留 finished", () => {
    const out = mergeSteps([step("a", "s1", "started"), step("b", "s1", "finished")]);
    expect(out).toHaveLength(1);
    expect(out[0].phase).toBe("finished");
  });

  it("不同 stepId 互不影响", () => {
    const out = mergeSteps([
      step("a", "s1", "started"),
      step("b", "s2", "started"),
      step("c", "s1", "finished"),
    ]);
    expect(out).toHaveLength(2);
    const s1 = out.find((s) => s.stepId === "s1");
    const s2 = out.find((s) => s.stepId === "s2");
    expect(s1?.phase).toBe("finished");
    expect(s2?.phase).toBe("started");
  });

  it("started → started：保留首条（去重）", () => {
    const out = mergeSteps([step("a", "s1", "started"), step("b", "s1", "started")]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("a");
  });

  it("空数组 → 空", () => {
    expect(mergeSteps([])).toEqual([]);
  });
});

describe("ReasoningPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("空 steps 不渲染（避免空容器污染 bubble）", () => {
    const { container } = render(<ReasoningPanel steps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("默认收起，summary 显示步数与 running 状态", () => {
    render(<ReasoningPanel steps={[step("a", "s1", "started")]} />);
    const panel = screen.getByTestId("reasoning-panel");
    expect(panel).toHaveAttribute("data-expanded", "false");
    expect(screen.getByText(/推理中.*1.*步/)).toBeInTheDocument();
  });

  it("全 finished 时 summary 显示 '思考完成'", () => {
    render(
      <ReasoningPanel
        steps={[step("a", "s1", "finished"), step("b", "s2", "finished")]}
      />,
    );
    expect(screen.getByText(/思考完成.*2.*步/)).toBeInTheDocument();
  });

  it("点击展开后 localStorage 写入 '1'，再点收起写 '0'", () => {
    render(<ReasoningPanel steps={[step("a", "s1", "finished")]} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.getByTestId("reasoning-panel")).toHaveAttribute("data-expanded", "true");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");

    fireEvent.click(button);
    expect(screen.getByTestId("reasoning-panel")).toHaveAttribute("data-expanded", "false");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("0");
  });

  it("挂载时从 localStorage 恢复展开状态", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    render(<ReasoningPanel steps={[step("a", "s1", "finished")]} />);
    // 等待 useEffect
    return Promise.resolve().then(() => {
      expect(screen.getByTestId("reasoning-panel")).toHaveAttribute("data-expanded", "true");
    });
  });

  it("超过 50 步硬上限 → 显示 '+N 更多步骤已折叠'", () => {
    const many = Array.from({ length: 60 }, (_, i) => step(`s-${i}`, `step-${i}`, "finished"));
    render(<ReasoningPanel steps={many} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/\+10 更多步骤已折叠/)).toBeInTheDocument();
  });

  it("aria-expanded 属性反映折叠状态（可访问性）", () => {
    render(<ReasoningPanel steps={[step("a", "s1", "finished")]} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
