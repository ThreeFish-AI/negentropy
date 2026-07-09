import { render, screen } from "@testing-library/react";

import { describe, expect, it } from "vitest";

import { UserBubble } from "@/components/transcript/UserBubble";
import { formatElapsed } from "@/components/transcript/WorkingIndicator";
import type { TranscriptItem } from "@/components/transcript/types";

type UserItem = Extract<TranscriptItem, { kind: "user" }>;
const userItem: UserItem = { kind: "user", seq: 1, id: "u1", text: "你好，世界。" };

describe("UserBubble（A：Studio 用户头像注入）", () => {
  it("提供 avatar 时渲染在气泡侧（锚定「人」的一方）", () => {
    render(
      <UserBubble
        item={userItem}
        avatar={<span data-testid="user-avatar">A</span>}
      />,
    );
    expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
    expect(screen.getByText("你好，世界。")).toBeInTheDocument();
  });

  it("不提供 avatar 时不渲染头像位（气泡仍正常）", () => {
    const { container } = render(<UserBubble item={userItem} />);
    expect(screen.getByText("你好，世界。")).toBeInTheDocument();
    expect(container.querySelector('[data-testid="user-avatar"]')).toBeNull();
  });
});

describe("formatElapsed（C：在途态耗时格式化）", () => {
  it("<60s → \"Ns\"", () => {
    expect(formatElapsed(0)).toBe("0s");
    expect(formatElapsed(45_000)).toBe("45s");
  });

  it("≥60s → \"Nm Ns\"", () => {
    expect(formatElapsed(60_000)).toBe("1m 0s");
    expect(formatElapsed(83_000)).toBe("1m 23s");
  });

  it("负值兜底为 0s（防时钟回退）", () => {
    expect(formatElapsed(-500)).toBe("0s");
  });
});
