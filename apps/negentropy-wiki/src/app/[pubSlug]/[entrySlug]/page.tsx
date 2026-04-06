import { wikiApi, type WikiEntryContent } from "@/lib/wiki-api";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 300;

/**
 * Wiki 文档详情页 — 渲染 Markdown 内容
 *
 * 动态路由: /:pubSlug/:entrySlug
 * 从后端 API 拉取 Markdown 内容并渲染为 HTML。
 */

interface Props {
  params: Promise<{ pubSlug: string; entrySlug: string }>;
}

/**
 * 根据 entry_slug 查找对应的 entry_id
 * 当前 API 不支持按 slug 查询 entry，需要先获取 entries 列表再匹配
 */
async function findEntryId(
  pubId: string,
  entrySlug: string,
): Promise<string | null> {
  try {
    const result = await wikiApi.getEntries(pubId);
    const match = result.items.find((e) => e.entry_slug === entrySlug);
    return match?.id || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pubSlug, entrySlug } = await params;
  return {
    title: `${entrySlug} — ${pubSlug}`,
    description: `Negentropy Wiki 文档页面`,
  };
}

export default async function WikiEntryPage({ params }: Props) {
  const { pubSlug, entrySlug } = await params;

  let content: WikiEntryContent | null = null;

  // 1. 先找到 publication ID
  let pubId: string | null = null;
  try {
    const pubs = await wikiApi.listPublications();
    const pub = pubs.items.find((p) => p.slug === pubSlug && p.status === "published");
    if (pub) pubId = pub.id;
  } catch {
    // ignore
  }

  // 2. 通过 slug 找到 entry_id
  if (pubId) {
    const entryId = await findEntryId(pubId, entrySlug);
    if (entryId) {
      try {
        content = await wikiApi.getEntryContent(entryId);
      } catch {
        // ignore
      }
    }
  }

  if (!content || !content.markdown_content) {
    return (
      <main className="wiki-main" style={{ padding: "3rem 2rem", textAlign: "center" }}>
        <h1>文档未找到</h1>
        <p style={{ color: "var(--wiki-text-secondary)", marginTop: "0.5rem" }}>
          文档 &quot;{entrySlug}&quot; 不存在或内容为空
        </p>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Link href={`/${pubSlug}`}>← 返回 {pubSlug}</Link>
          <Link href="/">返回首页</Link>
        </div>
      </main>
    );
  }

  /**
   * 简易 Markdown → HTML 渲染
   *
   * 生产环境应替换为完整的 Markdown 渲染器（如 react-markdown + remark-gfm），
   * 并集成 KaTeX（数学公式）和 Mermaid（图表）渲染能力。
   * 此处提供基础实现确保 SSG 构建可运行。
   */
  function renderMarkdown(md: string): string {
    let html = md
      // 转义 HTML 特殊字符（防止 XSS）
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // 标题
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // 粗体 / 斜体
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // 行内代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 代码块
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      // 链接
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // 图片
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
      // 引用块
      .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
      // 无序列表
      .replace(/^[\-\*] (.+)$/gm, "<li>$1</li>")
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

  return (
    <div className="wiki-layout">
      {/* 侧边栏 */}
      <aside className="wiki-sidebar">
        <div className="wiki-sidebar-header">
          <Link href={`/${pubSlug}`} style={{ color: "inherit", textDecoration: "none" }}>
            ← {pubSlug}
          </Link>
        </div>
        {/* TOC 将由客户端 JS 动态生成 */}
        <nav style={{ marginTop: "1rem" }}>
          <p style={{ fontSize: "0.82em", color: "var(--wiki-text-secondary)" }}>
            正在阅读:
          </p>
          <strong style={{ fontSize: "0.92em" }}>{content.entry_title || entrySlug}</strong>
        </nav>
      </aside>

      {/* 主内容区 */}
      <main className="wiki-main">
        <header className="wiki-doc-header">
          <h1 className="wiki-doc-title">{content.entry_title || entrySlug}</h1>
          <div className="wiki-doc-meta">
            来源: {content.document_filename || "未知"}
            {content.document_filename && ` · 文档 ID: ${String(content.document_id).slice(0, 8)}...`}
          </div>
        </header>

        {/* Markdown 内容渲染 */}
        <article
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content.markdown_content) }}
        />
      </main>
    </div>
  );
}
