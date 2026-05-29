import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MentionPopover } from "@/components/ui/MentionPopover";
import type { MentionCandidate } from "@negentropy/agents-chat-core/parse";

const _AGENTS: MentionCandidate[] = [
  {
    kind: "agent",
    refId: "PerceptionFaculty",
    label: "PerceptionFaculty",
    description: "感知系部",
  },
  {
    kind: "agent",
    refId: "ActionFaculty",
    label: "ActionFaculty",
    description: "知行系部",
  },
];

const _CORPORA: MentionCandidate[] = [
  {
    kind: "corpus",
    refId: "uuid-a",
    label: "Corpus-A",
    description: "ML papers",
  },
  {
    kind: "corpus",
    refId: "uuid-b",
    label: "Corpus-B",
    description: "Cooking recipes",
  },
];

function _renderPopover(
  overrides: Partial<Parameters<typeof MentionPopover>[0]> = {},
) {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(
    <MentionPopover
      open
      position={{ top: 100, left: 50 }}
      queryText=""
      agentCandidates={_AGENTS}
      corpusCandidates={_CORPORA}
      onPick={onPick}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onPick, onClose };
}

describe("MentionPopover", () => {
  it("open=false → 不渲染", () => {
    render(
      <MentionPopover
        open={false}
        position={{ top: 0, left: 0 }}
        queryText=""
        agentCandidates={_AGENTS}
        corpusCandidates={_CORPORA}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("mention-popover")).toBeNull();
  });

  it("默认 Tab 为 Agents，展示 agent 候选项", () => {
    _renderPopover();
    expect(screen.getByTestId("mention-popover")).toBeInTheDocument();
    expect(screen.getByText("PerceptionFaculty")).toBeInTheDocument();
    expect(screen.getByText("ActionFaculty")).toBeInTheDocument();
    // 此时不应渲染 corpus 候选
    expect(screen.queryByText("Corpus-A")).toBeNull();
  });

  it("点击 Tab 切换显示 corpus 候选", async () => {
    const user = userEvent.setup();
    _renderPopover();
    await user.click(screen.getByTestId("mention-tab-corpus"));
    expect(screen.getByText("Corpus-A")).toBeInTheDocument();
    expect(screen.queryByText("PerceptionFaculty")).toBeNull();
  });

  it("Tab 按钮使用 aria-label 暴露中文类别名（图标 only）", () => {
    _renderPopover();
    expect(screen.getByTestId("mention-tab-agent")).toHaveAttribute(
      "aria-label",
      "Agents",
    );
    expect(screen.getByTestId("mention-tab-corpus")).toHaveAttribute(
      "aria-label",
      "Corpus",
    );
  });

  it("queryText 过滤候选项（不区分大小写）", () => {
    _renderPopover({ queryText: "PERC" });
    expect(screen.getByText("PerceptionFaculty")).toBeInTheDocument();
    expect(screen.queryByText("ActionFaculty")).toBeNull();
  });

  it("queryText 命中 description 也算匹配", () => {
    _renderPopover({ queryText: "感知" });
    expect(screen.getByText("PerceptionFaculty")).toBeInTheDocument();
    expect(screen.queryByText("ActionFaculty")).toBeNull();
  });

  it("Enter 选中当前活动条目 → onPick", () => {
    const { onPick } = _renderPopover();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0]).toMatchObject({
      kind: "agent",
      refId: "PerceptionFaculty",
    });
  });

  it("Esc 关闭 → onClose", () => {
    const { onClose } = _renderPopover();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("↓ 切换下一条目后 Enter → 选中第 2 条", () => {
    const { onPick } = _renderPopover();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onPick.mock.calls[0][0]).toMatchObject({ refId: "ActionFaculty" });
  });

  it("空匹配 → 显示「暂无匹配」", () => {
    _renderPopover({ queryText: "no_such_thing_xyz" });
    expect(screen.getByTestId("mention-empty")).toBeInTheDocument();
  });

  it("agentsLoading=true → 显示加载中", () => {
    _renderPopover({ agentsLoading: true });
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it("agentsError → 显示错误", () => {
    _renderPopover({ agentsError: "网络超时" });
    expect(screen.getByTestId("mention-error")).toBeInTheDocument();
    expect(screen.getByText(/网络超时/)).toBeInTheDocument();
  });

  it("切换到 Corpus Tab 后选中 → onPick.kind=corpus", async () => {
    const user = userEvent.setup();
    const { onPick } = _renderPopover();
    await user.click(screen.getByTestId("mention-tab-corpus"));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onPick.mock.calls[0][0]).toMatchObject({
      kind: "corpus",
      refId: "uuid-a",
    });
  });

  it("点击候选项 → onPick", async () => {
    const user = userEvent.setup();
    const { onPick } = _renderPopover();
    await user.click(screen.getByText("ActionFaculty"));
    expect(onPick.mock.calls[0][0]).toMatchObject({ refId: "ActionFaculty" });
  });
});
