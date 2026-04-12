import { wikiApi, type WikiEntryContent } from "@/lib/wiki-api";
import { renderMarkdown } from "@/lib/markdown";
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

  // 1. 通过 slug 查找 publication
  try {
    const publication = await wikiApi.findPublicationBySlug(pubSlug);
    if (publication) {
      // 2. 通过 slug 查找 entry_id
      const entryId = await wikiApi.findEntryId(publication.id, entrySlug);
      if (entryId) {
        content = await wikiApi.getEntryContent(entryId);
      }
    }
  } catch (err) {
    console.warn(`[Wiki] Failed to load entry "${pubSlug}/${entrySlug}":`, err);
  }

  if (!content || !content.markdown_content) {
    return (
      <main className="wiki-main wiki-not-found">
        <h1>文档未找到</h1>
        <p className="wiki-not-found-hint">
          文档 &quot;{entrySlug}&quot; 不存在或内容为空
        </p>
        <div className="wiki-not-found-actions">
          <Link href={`/${pubSlug}`}>← 返回 {pubSlug}</Link>
          <Link href="/">返回首页</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="wiki-layout">
      {/* 侧边栏 */}
      <aside className="wiki-sidebar">
        <div className="wiki-sidebar-header">
          <Link href={`/${pubSlug}`} className="wiki-sidebar-back">
            ← {pubSlug}
          </Link>
        </div>
        <nav className="wiki-sidebar-reading">
          <p className="wiki-reading-label">正在阅读:</p>
          <strong className="wiki-reading-title">{content.entry_title || entrySlug}</strong>
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
