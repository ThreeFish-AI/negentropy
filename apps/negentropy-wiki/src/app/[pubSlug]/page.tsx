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
    // 尝试通过 slug 查找（当前 API 不支持 slug 查询，先列出再匹配）
    const result = await wikiApi.listPublications();
    const match = result.items.find(
      (p) => p.slug === pubSlug && p.status === "published"
    );
    if (match) {
      publication = match;
      const navResult = await wikiApi.getNavTree(match.id);
      navItems = navResult.nav_tree?.items || [];
    }
  } catch (err) {
    console.error("Failed to load publication:", err);
  }

  if (!publication) {
    return (
      <main className="wiki-main" style={{ padding: "3rem 2rem", textAlign: "center" }}>
        <h1>Wiki 未找到</h1>
        <p style={{ color: "var(--wiki-text-secondary)", marginTop: "0.5rem" }}>
          Publication &quot;{pubSlug}&quot; 不存在或未发布
        </p>
        <Link href="/" style={{ marginTop: "1rem", display: "inline-block" }}>
          ← 返回首页
        </Link>
      </main>
    );
  }

  // 找到首页条目（is_index_page = true）
  const indexEntry = navItems.find((item) => item.is_index_page);

  return (
    <div className="wiki-layout">
      {/* 侧边栏导航 */}
      <aside className="wiki-sidebar">
        <div className="wiki-sidebar-header">{publication.name}</div>
        {publication.description && (
          <p style={{ fontSize: "0.85em", color: "var(--wiki-text-secondary)", marginBottom: "1rem" }}>
            {publication.description}
          </p>
        )}
        {indexEntry && (
          <Link href={`/${pubSlug}/${indexEntry.entry_slug}`} className="wiki-nav-link active">
            📄 首页
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
            版本 v{pub.version} · {navItems.length} 篇文档 ·{" "}
            {publication.published_at
              ? new Date(publication.published_at).toLocaleDateString("zh-CN")
              : "尚未发布"}
          </div>
        </header>

        {indexEntry ? (
          <div>
            {/* 如果有首页条目，引导用户点击 */}
            <p style={{ color: "var(--wiki-text-secondary)" }}>
              请从左侧导航选择文档，或访问{" "}
              <Link href={`/${pubSlug}/${indexEntry.entry_slug}`}>首页</Link> 开始浏览。
            </p>
          </div>
        ) : (
          <div style={{ color: "var(--wiki-text-secondary)", padding: "2rem 0" }}>
            此 Publication 尚无文档条目。请通过后端管理界面添加文档后重新发布。
          </div>
        )}

        {/* 文档索引 */}
        {navItems.length > 0 && (
          <section style={{ marginTop: "3rem" }}>
            <h2>📑 文档索引</h2>
            <ul style={{ listStyle: "none", display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
              {navItems.map((item) => (
                <li key={item.entry_id}>
                  <Link
                    href={`/${pubSlug}/${item.entry_slug}`}
                    style={{
                      display: "block",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--wiki-border)",
                      transition: "all 0.12s ease",
                    }}
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
