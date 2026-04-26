import { unstable_noStore as noStore } from "next/cache";

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
    // 失败本次响应不写入 ISR cache，避免空列表毒化 5 分钟；
    // 回落为 per-request SSR 一次/请求，后端恢复后下次访问即可正常重建 ISR cache。
    noStore();
    console.warn(
      "[Wiki] Failed to fetch publications（已退化为 per-request SSR，恢复后自动重建 ISR）:",
      err,
    );
  }

  return (
    <main className="wiki-main wiki-home-container">
      <div className="wiki-home-hero">
        {/* eslint-disable-next-line @next/next/no-img-element -- next.config.ts 已设 images.unoptimized，next/image 在此无优化收益 */}
        <img
          src="/logo.png"
          alt="Negentropy"
          className="wiki-home-logo"
          width={96}
          height={96}
        />
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
