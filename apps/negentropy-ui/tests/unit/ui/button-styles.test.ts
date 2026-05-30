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

  it("为危险描边按钮使用语义化 destructive 令牌", () => {
    const className = outlineButtonClassName("danger");

    expect(className).toContain("border-destructive/40");
    expect(className).toContain("text-destructive");
    expect(className).toContain("hover:border-destructive/60");
    expect(className).toContain("hover:bg-destructive/10");
    expect(className).toContain("focus-visible:ring-destructive/30");
  });
});
