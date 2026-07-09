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

  it("大图（width ≥ 400）使用 width:100% 填满容器", () => {
    const md = `<img src="./images/fig.png" width="602" height="332" style="max-width:100%;height:auto;" />`;
    const { container } = render(<MarkdownRenderer content={md} />);
    const img = container.querySelector("img");

    expect(img).not.toBeNull();
    const style = img?.style;
    expect(style?.width).toBe("100%");
    expect(style?.maxWidth).toBe("100%");
    expect(style?.height).toBe("auto");
  });

  it("容器不设 translate 属性，允许浏览器翻译", () => {
    const { container } = render(<MarkdownRenderer content="Hello world" />);
    const body = container.querySelector(".wiki-markdown-body");
    expect(body).not.toBeNull();
    expect(body?.getAttribute("translate")).toBeNull();
  });

  it("小图（width < 400）不添加 width:100% 撑开样式", () => {
    const md = `<img src="./images/icon.png" width="46" height="32" style="max-width:100%;height:auto;" />`;
    const { container } = render(<MarkdownRenderer content={md} />);
    const img = container.querySelector("img");

    expect(img).not.toBeNull();
    const style = img?.style;
    // 小图不应有 width:100%，保持后端 max-width:100% 原样
    expect(style?.width).not.toBe("100%");
    expect(style?.maxWidth).toBe("100%");
  });

  // notranslate：块级豁免——代码块/公式等不参与浏览器翻译，正文其余仍可翻译。
  describe("notranslate 块级豁免", () => {
    it("fenced 代码块的 <pre> 带 notranslate，内层 <code> 不污染（语言标签不受影响）", () => {
      const md = "```js\nconst enabled = true;\n```";
      const { container } = render(<MarkdownRenderer content={md} />);

      const pre = container.querySelector(".wiki-code-block pre");
      expect(pre).not.toBeNull();
      expect(pre?.classList.contains("notranslate")).toBe(true);

      // 内层 code 不应被追加 notranslate（否则会污染 CodeBlock 的语言标签计算）。
      const code = container.querySelector(".wiki-code-block code");
      expect(code).not.toBeNull();
      expect(code?.classList.contains("notranslate")).toBe(false);
    });

    it("行内代码的 <code> 带 notranslate", () => {
      const md = "使用 `useState` 钩子管理状态。";
      const { container } = render(<MarkdownRenderer content={md} />);

      const inlineCode = container.querySelector("code");
      expect(inlineCode).not.toBeNull();
      expect(inlineCode?.textContent).toBe("useState");
      expect(inlineCode?.classList.contains("notranslate")).toBe(true);
      // 行内代码不进 pre，应为裸 code。
      expect(inlineCode?.closest("pre")).toBeNull();
    });

    it("块级公式 $$...$$ 的 .katex-display 带 notranslate", () => {
      // 独占成行的 $$ 围栏才会被 remark-math 解析为 display 公式（同行 $$...$$ 是行内）。
      const md = "$$\nE = mc^2\n$$";
      const { container } = render(<MarkdownRenderer content={md} />);

      const display = container.querySelector(".katex-display");
      expect(display).not.toBeNull();
      expect(display?.classList.contains("notranslate")).toBe(true);
    });

    it("行内公式 $...$ 的 .katex 带 notranslate", () => {
      const md = "质能方程 $E=mc^2$ 广为人知。";
      const { container } = render(<MarkdownRenderer content={md} />);

      const katex = container.querySelector(".katex");
      expect(katex).not.toBeNull();
      expect(katex?.classList.contains("notranslate")).toBe(true);
    });
  });
});
