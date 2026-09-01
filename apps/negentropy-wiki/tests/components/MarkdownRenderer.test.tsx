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

  // remark-math-sanitize：净化 PDF 提取语料的病态公式节点（货币误配对/未转义 %/Unicode 符号）。
  describe("remark-math-sanitize", () => {
    it("货币 $ 误配对（数学体含 CJK）降级回正文文本，$ 字面可见", () => {
      // 真实语料形态：相邻货币 $ 被 remark-math 配成 inlineMath，中间中文全进 math mode。
      const md = "按输入 $3/ 百万 token 、输出 $15/ 百万 token 的示例价格计算";
      const { container } = render(<MarkdownRenderer content={md} />);

      expect(container.querySelector(".katex")).toBeNull();
      const text = container.querySelector(".wiki-markdown-body")?.textContent ?? "";
      expect(text).toContain("$3/ 百万 token 、输出 $15/ 百万 token");
    });

    it("正常行内公式（数学体无 CJK）不受影响", () => {
      const md = "质能方程 $E=mc^2$ 广为人知。";
      const { container } = render(<MarkdownRenderer content={md} />);

      expect(container.querySelector(".katex")).not.toBeNull();
    });

    it("\\text{中文} 是合法用法，不触发 CJK 误降级", () => {
      const md = "向量投影 $\\text{A 在 B 上的投影} = \\frac{\\text{点积}}{\\text{B 的长度}}$";
      const { container } = render(<MarkdownRenderer content={md} />);

      expect(container.querySelector(".katex")).not.toBeNull();
    });

    it("未转义的 % 被转义，渲染不再吞掉其后内容（commentAtEnd 修复）", () => {
      const md = "$11.5%\\to15.0%$";
      const { container } = render(<MarkdownRenderer content={md} />);

      const katex = container.querySelector(".katex");
      expect(katex).not.toBeNull();
      // 修复前 % 后内容被当 TeX 注释吞掉，只剩 11.5；修复后应完整可见。
      expect(katex?.textContent).toContain("15.0");
      expect(katex?.textContent).toContain("%");
    });

    it("‖ 归一为 \\Vert，公式正常渲染（unknownSymbol 修复）", () => {
      const md = "KL 散度不对称：KL $(P‖Q) \\neq$ KL $(Q‖P)$";
      const { container } = render(<MarkdownRenderer content={md} />);

      const maths = container.querySelectorAll(".katex");
      expect(maths.length).toBe(2);
    });

    it("• 归一为 \\bullet，公式正常渲染", () => {
      const md = "$•$ Action model: Primary execution model for tool-";
      const { container } = render(<MarkdownRenderer content={md} />);

      expect(container.querySelector(".katex")).not.toBeNull();
    });

    it("病态公式净化后渲染零 KaTeX 告警（循证验证）", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const md = [
          "三轮调用总共 $0.022 ——看似很便宜。如果完全没有缓存，三轮输入成本约为 $0.029 ，加上输出后合计约 $0.036",
          "$11.5%\\to15.0%$",
          "KL $(P‖Q) \\neq$ KL $(Q‖P)$",
          "$•$ Action model",
          "$$\n    d_{L2}^2 = \\underbrace{\\|a\\|^2 + \\|b\\|^2}_{常数 2}\n$$",
        ].join("\n\n");
        const { container } = render(<MarkdownRenderer content={md} />);
        expect(container.querySelector(".wiki-markdown-body")).not.toBeNull();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it("display 公式下标裸 CJK 包进 \\text{}，渲染为文本模式", () => {
      // mdast-util-math 对 display 公式把值存两份（node.value + data.hChildren 内
      // code>text 副本），须同步更新才能到达 KaTeX——本用例锁住该路径。
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const md = "$$\n    d_{L2}^2 = \\underbrace{\\|a\\|^2 + \\|b\\|^2}_{常数 2} - 2\\underbrace{(a\\cdot b)}_{\\text{点积/Cos}}\n$$";
        const { container } = render(<MarkdownRenderer content={md} />);
        const anns = [...container.querySelectorAll("annotation")].map((a) => a.textContent ?? "");
        const target = anns.find((t) => t.includes("d_{L2}"));
        expect(target).toContain("_{\\text{常数 2}}");
      } finally {
        warn.mockRestore();
      }
    });
  });
});
