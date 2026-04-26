import {
  wikiApi,
  type WikiPublication,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";
import { WikiNavTree } from "@/components/WikiNavTree";
import { WikiLayoutShell } from "@/components/WikiLayoutShell";
import Link from "next/link";

export const revalidate = 300;

/**
 * Publication 首页 — 显示层级导航树与索引入口
 *
 * 动态路由: /:pubSlug
 *
 * 复用 `WikiLayoutShell` 但 `hasToc=false`（首页本身没有正文 TOC），
 * 保持与详情页一致的左栏折叠风格与三栏 Grid 行为。
 */

interface Props {
  params: Promise<{ pubSlug: string }>;
}

function findIndexEntry(items: WikiNavTreeItem[]): WikiNavTreeItem | null {
  for (const item of items) {
    if (item.is_index_page && item.entry_id) return item;
    if (item.children && item.children.length > 0) {
      const nested = findIndexEntry(item.children);
      if (nested) return nested;
    }
  }
  return null;
}

function countLeafEntries(items: WikiNavTreeItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.entry_id) total += 1;
    if (item.children && item.children.length > 0) {
      total += countLeafEntries(item.children);
    }
  }
  return total;
}

export default async function WikiPublicationPage({ params }: Props) {
  const { pubSlug } = await params;

  let publication: WikiPublication | null = null;
  let navItems: WikiNavTreeItem[] = [];

  try {
    const match = await wikiApi.findPublicationBySlug(pubSlug);
    if (match) {
      publication = match;
      const navResult = await wikiApi.getNavTree(match.id);
      navItems = navResult.nav_tree?.items || [];
    }
  } catch (err) {
    console.error(`[Wiki] Failed to load publication "${pubSlug}":`, err);
  }

  if (!publication) {
    return (
      <main className="wiki-main wiki-not-found">
        <h1>Wiki 未找到</h1>
        <p className="wiki-not-found-hint">
          Publication &quot;{pubSlug}&quot; 不存在或未发布
        </p>
        <Link href="/" className="wiki-back-link">
          ← 返回首页
        </Link>
      </main>
    );
  }

  const indexEntry = findIndexEntry(navItems);
  const entriesTotal = countLeafEntries(navItems);

  const sidebar = (
    <>
      <div className="wiki-sidebar-header">
        <div className="wiki-sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- next.config.ts 已设 images.unoptimized，next/image 在此无优化收益 */}
          <img
            src="/logo.png"
            alt="Negentropy"
            className="wiki-sidebar-logo"
          />
          <span className="wiki-sidebar-title">{publication.name}</span>
        </div>
      </div>
      {publication.description && (
        <p className="wiki-sidebar-desc">{publication.description}</p>
      )}
      {indexEntry && (
        <Link
          href={`/${pubSlug}/${indexEntry.entry_slug}`}
          className="wiki-nav-link active"
        >
          🏠 首页
        </Link>
      )}
      <nav>
        <WikiNavTree items={navItems} pubSlug={pubSlug} />
      </nav>
    </>
  );

  return (
    <WikiLayoutShell sidebar={sidebar} hasToc={false}>
      <header className="wiki-doc-header">
        <h1 className="wiki-doc-title">{publication.name}</h1>
        <div className="wiki-doc-meta">
          版本 v{publication.version} · {entriesTotal} 篇文档 ·{" "}
          {publication.published_at
            ? new Date(publication.published_at).toLocaleDateString("zh-CN")
            : "尚未发布"}
        </div>
      </header>

      {entriesTotal === 0 ? (
        <p className="wiki-text-hint wiki-empty-hint">
          此 Publication 尚无文档条目，请通过后端管理界面
          <Link href={`/`} style={{ textDecoration: "underline" }}>
            同步 Catalog
          </Link>
          后重新发布。
        </p>
      ) : indexEntry ? (
        <p className="wiki-text-hint">
          请从左侧导航选择文档，或直接访问{" "}
          <Link href={`/${pubSlug}/${indexEntry.entry_slug}`}>首页</Link>。
        </p>
      ) : (
        <p className="wiki-text-hint">请从左侧导航选择文档开始阅读。</p>
      )}
    </WikiLayoutShell>
  );
}
