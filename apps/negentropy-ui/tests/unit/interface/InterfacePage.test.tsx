import { render } from "@testing-library/react";
import { useRouter } from "next/navigation";

import InterfacePage from "@/app/interface/page";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: () => "/interface",
}));

describe("InterfacePage", () => {
  it("mount 后立即 redirect 到 /dashboard", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);

    render(<InterfacePage />);

    expect(replace).toHaveBeenCalledWith("/dashboard");
  });
});
