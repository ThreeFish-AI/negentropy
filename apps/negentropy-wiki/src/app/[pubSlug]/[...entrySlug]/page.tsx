import {
  wikiApi,
  type WikiEntry,
  type WikiEntryContent,
  type WikiNavTreeItem,
  type WikiPublication,
} from "@/lib/wiki-api";
import { WikiNavTree } from "@/components/WikiNavTree";
import { renderMarkdown } from "@/lib/markdown";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 300;

/**
 * Wiki 文档详情页 — 渲染 Markdown 内容（支持层级路径）
 *
 * 动态路由: /:pubSlug/*entrySlug
 * 因 entry_slug 可能包含 "/"（Materialized Path），使用 catch-all 段捕获。
 */

interface Props {
  params: Promise<{ pubSlug: string; entrySlug: string[] }>;
}

type LoadStatus = "ok" | "missing" | "pending" | "orphaned";

function joinSlug(entrySlug: string[] | string): string {
  return Array.isArray(entrySlug) ? entrySlug.join("/") : entrySlug;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pubSlug, entrySlug } = await params;
  const slug = joinSlug(entrySlug);
  return {
    title: `${slug} — ${pubSlug}`,
    description: `Negentropy Wiki 文档页面`,
  };
}

export default async function WikiEntryPage({ params }: Props) {
  const { pubSlug, entrySlug } = await params;
  const slug = joinSlug(entrySlug);

  let publication: WikiPublication | null = null;
  let navItems: WikiNavTreeItem[] = [];
  let content: WikiEntryContent | null = null;
  let status: LoadStatus = "missing";

  try {
    publication = await wikiApi.findPublicationBySlug(pubSlug);
    if (publication) {
      const [navResult, entriesResult] = await Promise.all([
        wikiApi.getNavTree(publication.id),
        wikiApi.getEntries(publication.id),
      ]);
      navItems = navResult.nav_tree?.items || [];

      const entry: WikiEntry | undefined = entriesResult.items.find(
        (e) => e.entry_slug === slug,
      );
      if (entry) {
        if (entry.status === "orphaned" || entry.document_id === null) {
          status = "orphaned";
        } else {
          content = await wikiApi.getEntryContent(entry.id);
          if (content && content.markdown_content && content.markdown_content.trim()) {
            status = "ok";
          } else {
            status = "pending";
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[Wiki] Failed to load entry "${pubSlug}/${slug}":`, err);
  }

  if (status === "orphaned") {
    return (
      <main className="wiki-main wiki-not-found">
        <h1>该文档已失效</h1>
        <p className="wiki-not-found-hint">
          文档 &quot;{slug}&quot; 的源文件已被移除或转移，条目暂时无法访问。
        </p>
        <div className="wiki-not-found-actions">
          <Link href={`/${pubSlug}`}>← 返回 {pubSlug}</Link>
          <Link href="/">返回首页</Link>
        </div>
      </main>
    );
  }

  if (!publication || status === "missing") {
    return (
      <main className="wiki-main wiki-not-found">
        <h1>文档未找到</h1>
        <p className="wiki-not-found-hint">
          文档 &quot;{slug}&quot; 不存在或未发布
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
      {/* 侧边栏导航 */}
      <aside className="wiki-sidebar">
        <div className="wiki-sidebar-header">
          <Link
            href={`/${pubSlug}`}
            className="wiki-sidebar-back wiki-sidebar-brand"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- next.config.ts 已设 images.unoptimized，next/image 在此无优化收益 */}
            <img
              src="/logo.png"
              alt="Negentropy"
              className="wiki-sidebar-logo"
            />
            <span className="wiki-sidebar-title">← {publication.name}</span>
          </Link>
        </div>
        {navItems.length > 0 && (
          <nav>
            <WikiNavTree items={navItems} pubSlug={pubSlug} activeSlug={slug} />
          </nav>
        )}
      </aside>

      {/* 主内容区 */}
      <main className="wiki-main">
        {status === "pending" ? (
          <>
            <header className="wiki-doc-header">
              <h1 className="wiki-doc-title">
                {content?.entry_title || slug}
              </h1>
              <div className="wiki-doc-meta">
                来源: {content?.document_filename || "未知"}
              </div>
            </header>
            <section className="wiki-pending-card">
              <h2>📄 文档内容尚未生成</h2>
              <p>
                该条目已收录至 Wiki，但源文档的 Markdown 尚未提取完成。请在
                Negentropy 管理后台的
                <strong> Knowledge › Documents </strong>
                页面为该文档触发「提取 Markdown」后，重新发布 Publication。
              </p>
              <p className="wiki-text-hint">
                发布成功后，SSG 会在 5 分钟内的 ISR 窗口重新拉取内容；如需立即生效，可重新构建站点。
              </p>
            </section>
          </>
        ) : (
          content && (
            <>
              <header className="wiki-doc-header">
                <h1 className="wiki-doc-title">
                  {content.entry_title || slug}
                </h1>
                <div className="wiki-doc-meta">
                  来源: {content.document_filename || "未知"}
                  {content.document_id &&
                    ` · 文档 ID: ${String(content.document_id).slice(0, 8)}...`}
                </div>
              </header>

              {/* Markdown 内容渲染 */}
              <article
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(content.markdown_content || ""),
                }}
              />
            </>
          )
        )}
      </main>
    </div>
  );
}
