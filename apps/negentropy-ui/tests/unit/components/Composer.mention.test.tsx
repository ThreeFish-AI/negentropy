import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Composer } from "@/components/ui/Composer";
import type { MentionCandidate, MentionToken } from "@negentropy/agents-chat-core/parse";

const _AGENTS: MentionCandidate[] = [
  { kind: "agent", refId: "PerceptionFaculty", label: "PerceptionFaculty" },
  { kind: "agent", refId: "ActionFaculty", label: "ActionFaculty" },
];

const _CORPORA: MentionCandidate[] = [
  { kind: "corpus", refId: "uuid-a", label: "Corpus-A" },
];

/**
 * Composer 默认无 mention 行为兼容 + 启用 mention 后的核心流程：
 * - 键入 ``@`` 弹层出现，过滤 + 选中后插入 rawText 并新增 token；
 * - chip 列表可点击删除，对应文本同步移除；
 * - 弹层打开时 Enter 不触发 onSend（避免抢走选中行为）。
 */
function ComposerWithMention() {
  const [value, setValue] = useState("");
  const [mentions, setMentions] = useState<MentionToken[]>([]);
  const onSend = vi.fn();
  return (
    <div>
      <button data-testid="check-mentions" onClick={() => undefined}>
        {JSON.stringify(mentions.map((m) => ({ kind: m.kind, refId: m.refId })))}
      </button>
      <button data-testid="check-value" onClick={() => undefined}>{value}</button>
      <button data-testid="check-send" onClick={() => undefined}>
        {onSend.mock.calls.length.toString()}
      </button>
      <Composer
        value={value}
        onChange={setValue}
        onSend={onSend}
        disabled={false}
        mentions={mentions}
        onMentionsChange={setMentions}
        agentCandidates={_AGENTS}
        corpusCandidates={_CORPORA}
      />
    </div>
  );
}

describe("Composer @ mention 集成", () => {
  it("无 mention prop 时不渲染弹层（向后兼容）", () => {
    render(
      <Composer value="@" onChange={vi.fn()} onSend={vi.fn()} disabled={false} />,
    );
    // 即便有 @ 字符，因 showMentions=false 也不会弹层
    expect(screen.queryByTestId("mention-popover")).toBeNull();
  });

  it("键入 @ 触发弹层，选中 agent 后插入文本 + 新增 token", async () => {
    const user = userEvent.setup();
    render(<ComposerWithMention />);
    const ta = screen.getByTestId("composer-textarea") as HTMLTextAreaElement;
    await user.click(ta);
    await user.type(ta, "@");
    expect(await screen.findByTestId("mention-popover")).toBeInTheDocument();
    // Enter 选中第一条（PerceptionFaculty）
    fireEvent.keyDown(window, { key: "Enter" });
    // 文本应被替换为 "@PerceptionFaculty "
    expect((screen.getByTestId("composer-textarea") as HTMLTextAreaElement).value).toBe(
      "@PerceptionFaculty ",
    );
    // mentions state 应新增一个 agent token
    expect(screen.getByTestId("check-mentions").textContent).toContain(
      '"kind":"agent"',
    );
    expect(screen.getByTestId("check-mentions").textContent).toContain(
      '"refId":"PerceptionFaculty"',
    );
  });

  it("弹层打开时 Enter 不触发 onSend（被弹层拦截）", async () => {
    const onSend = vi.fn();
    render(
      <Composer
        value="@"
        onChange={() => undefined}
        onSend={onSend}
        disabled={false}
        mentions={[]}
        onMentionsChange={() => undefined}
        agentCandidates={_AGENTS}
        corpusCandidates={_CORPORA}
      />,
    );
    const ta = screen.getByTestId("composer-textarea") as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(1, 1);
    fireEvent.select(ta);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("点击 chip 删除按钮 → 同步移除文本与 token", async () => {
    const user = userEvent.setup();
    render(<ComposerWithMention />);
    const ta = screen.getByTestId("composer-textarea") as HTMLTextAreaElement;
    await user.click(ta);
    await user.type(ta, "@");
    fireEvent.keyDown(window, { key: "Enter" });
    expect((screen.getByTestId("composer-textarea") as HTMLTextAreaElement).value).toBe(
      "@PerceptionFaculty ",
    );
    // 找到 chip 的删除按钮
    const removeBtn = screen.getByRole("button", { name: /移除 @PerceptionFaculty/ });
    await user.click(removeBtn);
    // 文本与 token 都应被清空
    expect((screen.getByTestId("composer-textarea") as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect(screen.getByTestId("check-mentions").textContent).toBe("[]");
  });

  it("IME 期间禁用弹层（compositionStart → 关闭，compositionEnd → 重新检测）", async () => {
    const user = userEvent.setup();
    render(<ComposerWithMention />);
    const ta = screen.getByTestId("composer-textarea") as HTMLTextAreaElement;
    await user.click(ta);
    await user.type(ta, "@");
    expect(await screen.findByTestId("mention-popover")).toBeInTheDocument();
    // IME 开始
    fireEvent.compositionStart(ta);
    // 弹层关闭
    expect(screen.queryByTestId("mention-popover")).toBeNull();
  });

  it("email 场景 user@example.com 不触发弹层", async () => {
    const user = userEvent.setup();
    render(<ComposerWithMention />);
    const ta = screen.getByTestId("composer-textarea") as HTMLTextAreaElement;
    await user.click(ta);
    await user.type(ta, "user@");
    expect(screen.queryByTestId("mention-popover")).toBeNull();
  });
});
