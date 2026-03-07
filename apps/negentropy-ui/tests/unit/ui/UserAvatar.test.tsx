import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserAvatar } from "@/components/ui/UserAvatar";

describe("UserAvatar", () => {
  it("图片加载失败时回退到首字母头像", () => {
    render(
      <UserAvatar
        picture="https://lh3.googleusercontent.com/a/avatar"
        name="Aurelius Huang"
        email="aurelius@example.com"
      />,
    );

    const image = screen.getByRole("img", { name: "Aurelius Huang" });
    fireEvent.error(image);

    expect(screen.getByLabelText("Aurelius Huang")).toHaveTextContent("A");
  });

  it("无头像地址时直接渲染首字母回退", () => {
    render(<UserAvatar name="Negentropy" email="negentropy@example.com" />);

    expect(screen.getByLabelText("Negentropy")).toHaveTextContent("N");
  });
});
