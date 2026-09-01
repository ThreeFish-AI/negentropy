import { render } from "@testing-library/react";
import ReactMarkdown from "react-markdown";
import { defaultRemarkPlugins, defaultRehypePlugins } from "@/utils/markdown-plugins";

/**
 * remarkMathSanitize 接入 defaultRemarkPlugins 的回归护栏。
 *
 * 该插件与 `apps/negentropy-wiki/src/components/markdown/remark-math-sanitize.ts`
 * 是孪生副本，本文件用例与 wiki 端 MarkdownRenderer.test.tsx 的对应用例同步维护。
 */
function renderMd(md: string) {
  return render(
    <div data-testid="md">
      <ReactMarkdown remarkPlugins={defaultRemarkPlugins} rehypePlugins={defaultRehypePlugins}>
        {md}
      </ReactMarkdown>
    </div>,
  );
}

describe("defaultRemarkPlugins · remarkMathSanitize", () => {
  it("相邻货币 $ 误配对降级回正文，文本不被打乱重复", () => {
    // 未净化时 remark-math 把两个 $ 配成 inlineMath，实测正文被打乱、
    // `$15` 段渲染成 `$3` 段并触发多次 KaTeX 告警。LLM 回复中报价文本极常见。
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container } = renderMd("输入 $3/ 百万 token ，输出 $15/ 百万 token 。");

      expect(container.querySelector(".katex")).toBeNull();
      const text = container.textContent ?? "";
      expect(text).toContain("$3/ 百万 token");
      expect(text).toContain("$15/ 百万 token");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("正常行内公式不受影响", () => {
    const { container } = renderMd("质能方程 $E=mc^2$ 广为人知。");

    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("未转义的 % 被转义，其后内容不被当注释吞掉", () => {
    const { container } = renderMd("$11.5%\\to15.0%$");

    const katex = container.querySelector(".katex");
    expect(katex).not.toBeNull();
    expect(katex?.textContent).toContain("15.0");
    expect(katex?.textContent).toContain("%");
  });

  it("\\text{} 内的裸 % 同样被转义（catcode 14 不分模式）", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container } = renderMd("$\\text{增长 50%}$");

      expect(container.querySelector(".katex")).not.toBeNull();
      expect(container.querySelector(".katex-error")).toBeNull();
      // KaTeX 文本模式把空格输出为 NBSP（U+00A0），归一后再比对。
      expect(container.querySelector(".katex")?.textContent?.replace(/\u00A0/g, " "))
        .toContain("增长 50%");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("‖ 归一为 \\Vert，公式正常渲染", () => {
    const { container } = renderMd("KL 散度不对称：KL $(P‖Q) \\neq$ KL $(Q‖P)$");

    expect(container.querySelectorAll(".katex").length).toBe(2);
  });

  it("\\textrm 等 KaTeX 文本宏内的 CJK 不触发误降级", () => {
    const { container } = renderMd(
      "梯度 $g = \\textrm{方向导数}$ 与 $h = \\textnormal{常规}$ 及 $k = \\textsf{无衬线}$",
    );

    expect(container.querySelectorAll(".katex").length).toBe(3);
  });

  it("下标裸 CJK 包进 \\text{}，非 CJK（谚文）不被误包", () => {
    const { container } = renderMd("$$\nd_{常数 2} + e_{한글}\n$$");

    const ann = container.querySelector("annotation")?.textContent ?? "";
    expect(ann).toContain("_{\\text{常数 2}}");
    expect(ann).toContain("e_{한글}");
    expect(ann).not.toContain("\\text{한글}");
  });
});
