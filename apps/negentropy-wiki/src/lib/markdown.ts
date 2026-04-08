/**
 * 简易 Markdown → HTML 渲染器
 *
 * 基于正则替换的轻量级实现，覆盖常见 Markdown 语法子集。
 * 生产环境如需完整 GFM、KaTeX 数学公式或 Mermaid 图表支持，
 * 建议升级为 react-markdown + remark-gfm + rehype-katex 方案。
 */

/**
 * 将 Markdown 文本转换为可直接渲染的 HTML 字符串
 *
 * 支持的语法：标题 (H1-H4)、粗体/斜体、行内代码、代码块、
 * 链接、图片、引用块、无序/有序列表、分隔线、段落。
 *
 * @param md - 原始 Markdown 文本
 * @returns 包含 `.wiki-markdown-body` 容器的 HTML 字符串
 */
export function renderMarkdown(md: string): string {
  const html = md
    // 转义 HTML 特殊字符（防止 XSS）
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // 标题（从 H4 到 H1，避免贪婪匹配）
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // 粗体 / 斜体
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // 代码块（必须在行内代码之前处理）
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre><code class="language-$1">$2</code></pre>',
    )
    // 行内代码
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // 图片（必须在链接之前处理，因为 ![...](...) 包含 [...](...)）
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // 引用块
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    // 无序列表
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // 分隔线
    .replace(/^---$/gm, "<hr />")
    // 段落
    .replace(/\n\n+/g, "</p><p>")
    // 单个换行转为 <br>
    .replace(/\n/g, "<br />");

  return `<div class="wiki-markdown-body"><p>${html}</p></div>`;
}
