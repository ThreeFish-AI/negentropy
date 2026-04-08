import { wikiApi, type WikiPublication, type WikiNavTreeItem } from "@/lib/wiki-api";
import Link from "next/link";

export const revalidate = 300;

/**
 * Publication 首页 — 显示导航树和文档列表
 *
 * 动态路由: /:pubSlug
 * SSG 构建时根据已发布的 Publication 列表生成静态参数。
 */

interface Props {
  params: Promise<{ pubSlug: string }>;
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

  const indexEntry = navItems.find((item) => item.is_index_page);

  return (
    <div className="wiki-layout">
      {/* 侧边栏导航 */}
      <aside className="wiki-sidebar">
        <div className="wiki-sidebar-header">{publication.name}</div>
        {publication.description && (
          <p className="wiki-sidebar-desc">{publication.description}</p>
        )}
        {indexEntry && (
          <Link href={`/${pubSlug}/${indexEntry.entry_slug}`} className="wiki-nav-link active">
            首页
          </Link>
        )}
        <nav>
          <ul className="wiki-nav-list">
            {navItems
              .filter((item) => !item.is_index_page)
              .map((item) => (
                <li key={item.entry_id} className="wiki-nav-item">
                  <Link
                    href={`/${pubSlug}/${item.entry_slug}`}
                    className="wiki-nav-link"
                  >
                    {item.entry_title || item.entry_slug}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </aside>

      {/* 主内容区 */}
      <main className="wiki-main">
        <header className="wiki-doc-header">
          <h1 className="wiki-doc-title">{publication.name}</h1>
          <div className="wiki-doc-meta">
            版本 v{publication.version} · {navItems.length} 篇文档 ·{" "}
            {publication.published_at
              ? new Date(publication.published_at).toLocaleDateString("zh-CN")
              : "尚未发布"}
          </div>
        </header>

        {indexEntry ? (
          <p className="wiki-text-hint">
            请从左侧导航选择文档，或访问{" "}
            <Link href={`/${pubSlug}/${indexEntry.entry_slug}`}>首页</Link> 开始浏览。
          </p>
        ) : (
          <p className="wiki-text-hint wiki-empty-hint">
            此 Publication 尚无文档条目。请通过后端管理界面添加文档后重新发布。
          </p>
        )}

        {/* 文档索引 */}
        {navItems.length > 0 && (
          <section className="wiki-doc-index">
            <h2>文档索引</h2>
            <ul className="wiki-doc-index-list">
              {navItems.map((item) => (
                <li key={item.entry_id}>
                  <Link
                    href={`/${pubSlug}/${item.entry_slug}`}
                    className="wiki-doc-index-item"
                  >
                    {item.is_index_page && "🏠 "}
                    {item.entry_title || item.entry_slug}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
