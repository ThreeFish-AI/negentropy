/// <reference lib="dom" />
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";

beforeEach(() => {
  cleanup();
});

describe("MarkdownRenderer", () => {
  it("透传后端 <img> 的 width / height / style 属性", () => {
    // 模拟后端 _image_to_markdown (assembly.py R7+) 输出的内联 HTML：
    // <img src="./images/fig.png" alt="Figure 1" width="687" height="347"
    //  style="max-width:100%;height:auto;" />
    const md = `<img src="./images/fig.png" alt="Figure 1" width="687" height="347" style="max-width:100%;height:auto;" />`;

    const { container } = render(<MarkdownRenderer content={md} />);
    const img = container.querySelector("img");

    expect(img).not.toBeNull();
    expect(img?.getAttribute("width")).toBe("687");
    expect(img?.getAttribute("height")).toBe("347");
    // rehype-sanitize 会把 CSS 属性转为驼峰内联 style 对象
    const style = img?.style;
    expect(style?.maxWidth).toBe("100%");
    expect(style?.height).toBe("auto");
  });

  it("无 width/height 的标准 markdown 图片仍能正常渲染", () => {
    const md = "![alt text](./images/photo.png)";
    const { container } = render(<MarkdownRenderer content={md} />);
    const img = container.querySelector("img");

    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("./images/photo.png");
    expect(img?.getAttribute("alt")).toBe("alt text");
  });

  it("合并后端 style 与站点 borderRadius", () => {
    const md = `<img src="./images/fig.png" width="100" style="max-width:100%;height:auto;" />`;
    const { container } = render(<MarkdownRenderer content={md} />);
    const img = container.querySelector("img");

    expect(img).not.toBeNull();
    const style = img?.style;
    expect(style?.maxWidth).toBe("100%");
    expect(style?.height).toBe("auto");
    expect(style?.borderRadius).toMatch(/var\(--wiki-radius\)/);
  });
});
