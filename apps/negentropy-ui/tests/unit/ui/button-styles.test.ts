import { outlineButtonClassName } from "@/components/ui/button-styles";

describe("outlineButtonClassName", () => {
  it("为中性描边按钮返回统一交互状态类", () => {
    const className = outlineButtonClassName("neutral", "rounded-lg px-3");

    expect(className).toContain("border-border");
    expect(className).toContain("hover:bg-muted");
    expect(className).toContain("hover:text-foreground");
    expect(className).toContain("focus-visible:ring-foreground/20");
    expect(className).toContain("rounded-lg px-3");
  });

  it("为危险描边按钮保留红色语义与交互状态类", () => {
    const className = outlineButtonClassName("danger");

    expect(className).toContain("border-red-300");
    expect(className).toContain("hover:bg-red-50");
    expect(className).toContain("hover:text-red-700");
    expect(className).toContain("dark:hover:bg-red-950/40");
    expect(className).toContain("focus-visible:ring-red-200");
  });
});
