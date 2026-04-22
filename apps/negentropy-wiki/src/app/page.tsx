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
    publications = result.items;
  } catch (err) {
    console.warn(
      "[Wiki] Failed to fetch publications（后端不可达时回落为空列表，由 ISR 在首次请求时自愈）:",
      err,
    );
  }

  return (
    <main className="wiki-main wiki-home-container">
      <div className="wiki-home-hero">
        <h1 className="wiki-home-title">Negentropy Wiki</h1>
        <p className="wiki-home-subtitle">
          知识库发布站点 — 浏览已发布的文档集合
        </p>
      </div>

      {publications.length === 0 ? (
        <div className="wiki-empty-state">
          <p className="wiki-empty-title">暂无已发布的 Wiki</p>
          <p className="wiki-empty-hint">
            请在后端管理界面创建并发布 Wiki Publication
          </p>
        </div>
      ) : (
        <div className="wiki-pub-grid">
          {publications.map((publication) => (
            <a key={publication.id} href={`/${publication.slug}`} className="wiki-pub-card">
              <h2 className="wiki-pub-card-name">{publication.name}</h2>
              {publication.description && (
                <p className="wiki-pub-card-desc">{publication.description}</p>
              )}
              <div className="wiki-pub-card-meta">
                <span className="wiki-badge published">v{publication.version}</span>
                <span>{publication.entries_count} 篇文档</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
