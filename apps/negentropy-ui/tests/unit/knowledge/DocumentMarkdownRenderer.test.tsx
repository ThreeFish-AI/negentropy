import { render } from "@testing-library/react";
import { DocumentMarkdownRenderer } from "@/features/knowledge/components/DocumentMarkdownRenderer";

describe("DocumentMarkdownRenderer", () => {
  it("将相对图片路径代理到文档 assets 路由", () => {
    const { container } = render(
      <DocumentMarkdownRenderer
        content={"# Report\n\n![](./images/figure-1.png)\n![](../assets/figure-2.png)\n![](figure-3.png)"}
        corpusId="corpus-1"
        documentId="document-1"
        appName="negentropy"
      />,
    );

    const images = Array.from(container.querySelectorAll("img"));
    expect(images[0]).toHaveAttribute(
      "src",
      "/api/knowledge/base/corpus-1/documents/document-1/assets/figure-1.png?app_name=negentropy",
    );
    expect(images[1]).toHaveAttribute(
      "src",
      "/api/knowledge/base/corpus-1/documents/document-1/assets/figure-2.png?app_name=negentropy",
    );
    expect(images[2]).toHaveAttribute(
      "src",
      "/api/knowledge/base/corpus-1/documents/document-1/assets/figure-3.png?app_name=negentropy",
    );
  });

  it("保留绝对图片地址，不走代理", () => {
    const { container } = render(
      <DocumentMarkdownRenderer
        content={"![](https://example.com/image.png)"}
        corpusId="corpus-1"
        documentId="document-1"
      />,
    );

    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/image.png");
  });

  it("渲染行内数学公式 $...$ 为 KaTeX 输出", () => {
    const { container } = render(
      <DocumentMarkdownRenderer
        content={"质能方程 $E=mc^2$ 是物理学基础公式。"}
        corpusId="corpus-1"
        documentId="document-1"
      />,
    );

    const katexElements = container.querySelectorAll(".katex");
    expect(katexElements.length).toBeGreaterThanOrEqual(1);
  });

  it("渲染显示数学公式 $$...$$ 为独立 KaTeX 块", () => {
    const { container } = render(
      <DocumentMarkdownRenderer
        content={"下面是公式：\n\n$$\n\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\n$$"}
        corpusId="corpus-1"
        documentId="document-1"
      />,
    );

    const katexDisplay = container.querySelectorAll(".katex-display");
    expect(katexDisplay.length).toBeGreaterThanOrEqual(1);
  });

  it("GFM 表格中嵌入行内公式时表格和公式均正常渲染", () => {
    const { container } = render(
      <DocumentMarkdownRenderer
        content={"| 公式 | 值 |\n| --- | --- |\n| $E=mc^2$ | 质能等价 |"}
        corpusId="corpus-1"
        documentId="document-1"
      />,
    );

    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(1);
  });
});
