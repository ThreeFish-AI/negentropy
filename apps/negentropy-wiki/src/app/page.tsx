import { wikiApi, type WikiPublication } from "@/lib/wiki-api";

// ISR: 5 分钟增量再验证
export const revalidate = 300;

/**
 * Wiki 首页 — 列出所有已发布的 Publication
 *
 * SSG 构建时预渲染，ISR 增量更新。
 */
export default async function WikiHomePage() {
  let publications: WikiPublication[] = [];

  try {
    const result = await wikiApi.listPublications();
    publications = result.items.filter((p) => p.status === "published");
  } catch (err) {
    console.error("Failed to fetch publications:", err);
  }

  return (
    <main className="wiki-main" style={{ maxWidth: "960px", margin: "0 auto", padding: "3rem 2rem" }}>
      <div className="wiki-home-hero">
        <h1 className="wiki-home-title">📚 Negentropy Wiki</h1>
        <p className="wiki-home-subtitle">
          知识库发布站点 — 浏览已发布的文档集合
        </p>
      </div>

      {publications.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--wiki-text-secondary)" }}>
          <p style={{ fontSize: "1.1em" }}>暂无已发布的 Wiki</p>
          <p style={{ marginTop: "0.5rem", fontSize: "0.9em" }}>
            请在后端管理界面创建并发布 Wiki Publication
          </p>
        </div>
      ) : (
        <div className="wiki-pub-grid">
          {publications.map((pub) => (
            <a key={pub.id} href={`/${pub.slug}`} className="wiki-pub-card">
              <h2 className="wiki-pub-card-name">{pub.name}</h2>
              {pub.description && (
                <p className="wiki-pub-card-desc">{pub.description}</p>
              )}
              <div className="wiki-pub-card-meta">
                <span className="wiki-badge published">v{pub.version}</span>
                <span>{pub.entries_count} 篇文档</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
