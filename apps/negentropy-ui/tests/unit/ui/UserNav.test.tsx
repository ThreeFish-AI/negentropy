import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UserNav } from "@/components/layout/UserNav";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      name: "Aurelius Huang",
      email: "aurelius@example.com",
      picture: "https://example.com/avatar.png",
    },
    login: vi.fn(),
    logout: vi.fn(),
    status: "authenticated",
  }),
}));

describe("UserNav", () => {
  it("头像加载失败时回退到首字母头像", () => {
    render(<UserNav />);

    const image = screen.getByRole("img", { name: "Aurelius Huang" });
    fireEvent.error(image);

    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
