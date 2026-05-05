/**
 * P3-2 Approval UI 单测：
 * - ApprovalPolicySelector 持久化 + 切换；
 * - ApprovalDialog 渲染最早 pending + Approve / Deny / 错误兜底。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import {
  ApprovalPolicySelector,
  DEFAULT_APPROVAL_POLICY,
  useApprovalPolicy,
} from "@/components/ui/ApprovalPolicySelector";
import { ApprovalDialog } from "@/components/ui/ApprovalDialog";

const STORAGE_KEY = "home.approval_policy";

describe("ApprovalPolicySelector", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("默认 per_tool（与后端 DEFAULT_POLICY 对齐）", () => {
    render(<ApprovalPolicySelector />);
    const wrapper = screen.getByTestId("approval-policy-selector");
    expect(wrapper).toHaveAttribute("data-policy", DEFAULT_APPROVAL_POLICY);
    expect(DEFAULT_APPROVAL_POLICY).toBe("per_tool");
  });

  it("切换 always 后写入 localStorage 并 dispatch storage event", () => {
    render(<ApprovalPolicySelector />);
    const select = screen.getByLabelText("审批策略") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "always" } });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("always");
    expect(screen.getByTestId("approval-policy-selector")).toHaveAttribute("data-policy", "always");
  });

  it("切换 never 后再切回 per_tool", () => {
    render(<ApprovalPolicySelector />);
    const select = screen.getByLabelText("审批策略") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "never" } });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("never");
    fireEvent.change(select, { target: { value: "per_tool" } });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("per_tool");
  });

  it("非法 storage 值回退到默认", () => {
    window.localStorage.setItem(STORAGE_KEY, "invalid_value");
    render(<ApprovalPolicySelector />);
    expect(screen.getByTestId("approval-policy-selector")).toHaveAttribute(
      "data-policy",
      DEFAULT_APPROVAL_POLICY,
    );
  });

  it("useApprovalPolicy 返回当前值与 setter", () => {
    function Probe() {
      const { mode } = useApprovalPolicy();
      return <span data-testid="probe">{mode}</span>;
    }
    window.localStorage.setItem(STORAGE_KEY, "always");
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("always");
  });
});

describe("ApprovalDialog", () => {
  it("pending 为空时返回 null（零回归）", () => {
    const { container } = render(<ApprovalDialog pending={null} onRespond={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("空 dict 返回 null", () => {
    const { container } = render(<ApprovalDialog pending={{}} onRespond={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("有 pending 时渲染 modal + 工具名 + label + 风险标签", () => {
    render(
      <ApprovalDialog
        pending={{
          a1: {
            action_id: "a1",
            tool_name: "write_file",
            label: "即将写入 /tmp/important",
            risk_tier: "high",
          },
        }}
        onRespond={vi.fn()}
      />,
    );
    const modal = screen.getByTestId("approval-dialog");
    expect(modal).toHaveAttribute("data-action-id", "a1");
    expect(modal).toHaveAttribute("data-risk-tier", "high");
    expect(modal).toHaveTextContent("write_file");
    expect(modal).toHaveTextContent("即将写入 /tmp/important");
    expect(modal).toHaveTextContent("高风险");
  });

  it("多条 pending 按 requested_at 升序选首条", () => {
    render(
      <ApprovalDialog
        pending={{
          a2: { action_id: "a2", tool_name: "send_email", label: "later", requested_at: 200 },
          a1: { action_id: "a1", tool_name: "write_file", label: "earlier", requested_at: 100 },
        }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByTestId("approval-dialog")).toHaveAttribute("data-action-id", "a1");
  });

  it("Approve 按钮调用 onRespond('approved') + reason", async () => {
    const onRespond = vi.fn().mockResolvedValue(undefined);
    render(
      <ApprovalDialog
        pending={{ a1: { action_id: "a1", tool_name: "send_email", label: "x" } }}
        onRespond={onRespond}
      />,
    );
    fireEvent.change(screen.getByTestId("approval-reason"), { target: { value: "looks good" } });
    fireEvent.click(screen.getByTestId("approval-approve"));
    await waitFor(() =>
      expect(onRespond).toHaveBeenCalledWith("a1", "approved", "looks good"),
    );
  });

  it("Deny 按钮调用 onRespond('denied')", async () => {
    const onRespond = vi.fn().mockResolvedValue(undefined);
    render(
      <ApprovalDialog
        pending={{ a1: { action_id: "a1", tool_name: "send_email", label: "x" } }}
        onRespond={onRespond}
      />,
    );
    fireEvent.click(screen.getByTestId("approval-deny"));
    await waitFor(() => expect(onRespond).toHaveBeenCalledWith("a1", "denied", undefined));
  });

  it("onRespond 抛错时显示 approval-error 文案", async () => {
    const onRespond = vi.fn().mockRejectedValue(new Error("backend offline"));
    render(
      <ApprovalDialog
        pending={{ a1: { action_id: "a1", tool_name: "send_email", label: "x" } }}
        onRespond={onRespond}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("approval-approve"));
    });
    expect(screen.getByTestId("approval-error")).toHaveTextContent("backend offline");
  });

  it("args_preview 非空时渲染预览块；空 dict 时不渲染", () => {
    const { rerender } = render(
      <ApprovalDialog
        pending={{
          a1: {
            action_id: "a1",
            tool_name: "write_file",
            label: "x",
            args_preview: { path: "/etc/hosts" },
          },
        }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByTestId("approval-args-preview")).toHaveTextContent("/etc/hosts");

    rerender(
      <ApprovalDialog
        pending={{ a1: { action_id: "a1", tool_name: "write_file", label: "x", args_preview: {} } }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("approval-args-preview")).toBeNull();
  });
});
