import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  // ---------------------------------------------------------------------------
  // 基础结构
  // ---------------------------------------------------------------------------

  it("包裹在 .wiki-markdown-body 容器中", () => {
    const result = renderMarkdown("hello");
    expect(result).toContain('class="wiki-markdown-body"');
    expect(result).toMatch(/^<div class="wiki-markdown-body"><p>.*<\/p><\/div>$/);
  });

  it("处理空字符串", () => {
    const result = renderMarkdown("");
    expect(result).toBe('<div class="wiki-markdown-body"><p></p></div>');
  });

  // ---------------------------------------------------------------------------
  // 标题
  // ---------------------------------------------------------------------------

  it("渲染 H1 标题", () => {
    expect(renderMarkdown("# Hello")).toContain("<h1>Hello</h1>");
  });

  it("渲染 H2 标题", () => {
    expect(renderMarkdown("## World")).toContain("<h2>World</h2>");
  });

  it("渲染 H3 标题", () => {
    expect(renderMarkdown("### Section")).toContain("<h3>Section</h3>");
  });

  it("渲染 H4 标题", () => {
    expect(renderMarkdown("#### Sub-section")).toContain("<h4>Sub-section</h4>");
  });

  it("不将非行首的 # 视为标题", () => {
    const result = renderMarkdown("text # not a heading");
    expect(result).not.toContain("<h1>");
  });

  // ---------------------------------------------------------------------------
  // 粗体 / 斜体
  // ---------------------------------------------------------------------------

  it("渲染粗体文本", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });

  it("渲染斜体文本", () => {
    expect(renderMarkdown("*italic*")).toContain("<em>italic</em>");
  });

  it("粗体和斜体组合", () => {
    const result = renderMarkdown("**bold** and *italic*");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });

  // ---------------------------------------------------------------------------
  // 代码
  // ---------------------------------------------------------------------------

  it("渲染行内代码", () => {
    expect(renderMarkdown("`code`")).toContain("<code>code</code>");
  });

  it("渲染代码块", () => {
    const md = "```js\nconsole.log('hi');\n```";
    const result = renderMarkdown(md);
    expect(result).toContain('<pre><code class="language-js">');
    expect(result).toContain("console.log(");
  });

  it("渲染无语言标识的代码块", () => {
    const md = "```\nplain code\n```";
    const result = renderMarkdown(md);
    expect(result).toContain('<pre><code class="language-">');
    expect(result).toContain("plain code");
  });

  // ---------------------------------------------------------------------------
  // 链接与图片
  // ---------------------------------------------------------------------------

  it("渲染链接", () => {
    const result = renderMarkdown("[link](https://example.com)");
    expect(result).toContain('<a href="https://example.com">link</a>');
  });

  it("渲染图片", () => {
    const result = renderMarkdown("![alt text](https://img.example.com/pic.png)");
    expect(result).toContain('<img src="https://img.example.com/pic.png" alt="alt text" />');
  });

  // ---------------------------------------------------------------------------
  // 引用块
  // ---------------------------------------------------------------------------

  it("渲染引用块", () => {
    const result = renderMarkdown("> quoted text");
    expect(result).toContain("<blockquote>quoted text</blockquote>");
  });

  // ---------------------------------------------------------------------------
  // 列表
  // ---------------------------------------------------------------------------

  it("渲染无序列表（-）", () => {
    const result = renderMarkdown("- item one");
    expect(result).toContain("<li>item one</li>");
  });

  it("渲染无序列表（*）", () => {
    const result = renderMarkdown("* item two");
    expect(result).toContain("<li>item two</li>");
  });

  it("渲染有序列表", () => {
    const result = renderMarkdown("1. first\n2. second");
    expect(result).toContain("<li>first</li>");
    expect(result).toContain("<li>second</li>");
  });

  // ---------------------------------------------------------------------------
  // 分隔线与段落
  // ---------------------------------------------------------------------------

  it("渲染分隔线", () => {
    expect(renderMarkdown("---")).toContain("<hr />");
  });

  it("段落分隔（双换行）", () => {
    const result = renderMarkdown("paragraph one\n\nparagraph two");
    expect(result).toContain("</p><p>");
  });

  it("单个换行转为 <br />", () => {
    const result = renderMarkdown("line one\nline two");
    expect(result).toContain("line one<br />line two");
  });

  // ---------------------------------------------------------------------------
  // XSS 防护
  // ---------------------------------------------------------------------------

  it("转义 HTML 尖括号（防止 XSS）", () => {
    const result = renderMarkdown("<script>alert('xss')</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("转义 & 符号", () => {
    const result = renderMarkdown("A & B");
    expect(result).toContain("A &amp; B");
  });

  it("转义 > 符号（非引用块上下文）", () => {
    const result = renderMarkdown("a > b");
    expect(result).toContain("a &gt; b");
  });

  // ---------------------------------------------------------------------------
  // 综合场景
  // ---------------------------------------------------------------------------

  it("渲染包含多种元素的复杂 Markdown", () => {
    const md = [
      "# Title",
      "",
      "Some **bold** and *italic* text with `code`.",
      "",
      "> A quote",
      "",
      "- item 1",
      "- item 2",
      "",
      "[Link](https://example.com)",
    ].join("\n");

    const result = renderMarkdown(md);
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain("<code>code</code>");
    expect(result).toContain("<blockquote>");
    expect(result).toContain("<li>item 1</li>");
    expect(result).toContain("<li>item 2</li>");
    expect(result).toContain('<a href="https://example.com">Link</a>');
  });
});
