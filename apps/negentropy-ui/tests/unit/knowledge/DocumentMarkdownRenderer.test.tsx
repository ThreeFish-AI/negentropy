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
});
