import { render } from "@testing-library/react";
import { Card } from "@/components/ui/Card";

describe("Card", () => {
  it("默认渲染为带 sm 阴影的卡片容器", () => {
    const { container } = render(<Card>content</Card>);

    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe("DIV");
    expect(el.textContent).toBe("content");
    expect(el.className).toContain("rounded-card");
    expect(el.className).toContain("shadow-sm");
    expect(el.className).not.toContain("cursor-pointer");
  });

  it("flat elevation 不含阴影，interactive 启用 hover 过渡", () => {
    const { container } = render(
      <Card elevation="flat" interactive>
        click me
      </Card>,
    );

    const el = container.firstElementChild as HTMLElement;
    // flat: 无静态阴影类（shadow-sm / shadow-md），仅 hover 时叠加
    expect(el.className).not.toMatch(/(?<!hover:)shadow-(sm|md)\b/);
    expect(el.className).toContain("cursor-pointer");
    expect(el.className).toContain("hover:shadow-md");
  });
});
