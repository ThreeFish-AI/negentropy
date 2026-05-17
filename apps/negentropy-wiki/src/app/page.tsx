import { unstable_noStore as noStore } from "next/cache";

import { wikiApi, type WikiPublication } from "@/lib/wiki-api";

// ISR: 5 分钟增量再验证
export const revalidate = 300;

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
  return `${Math.floor(diffDays / 365)} 年前`;
}

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
    noStore();
    console.warn(
      "[Wiki ISR] Failed to fetch publications (degraded to per-request SSR; will rebuild ISR on next success):",
      err,
    );
  }

  const totalEntries = publications.reduce((sum, p) => sum + (p.entries_count ?? 0), 0);
  const latestDate = publications
    .filter((p) => p.published_at)
    .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())[0]?.published_at;

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
        {publications.length > 0 && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "1.5rem",
            fontSize: "0.88em",
            color: "var(--wiki-text-secondary)",
          }}>
            <span>{publications.length} 个 Publication</span>
            <span>·</span>
            <span>{totalEntries} 篇文档</span>
            {latestDate && (
              <>
                <span>·</span>
                <span>最近更新 {formatRelativeDate(latestDate)}</span>
              </>
            )}
          </div>
        )}
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: `hsl(${hashStr(publication.id) % 360}, 65%, 50%)`,
                  flexShrink: 0,
                }} />
                <h2 className="wiki-pub-card-name" style={{ marginBottom: 0 }}>
                  {publication.name}
                </h2>
              </div>
              {publication.description && (
                <p className="wiki-pub-card-desc">
                  {publication.description.length > 120
                    ? publication.description.slice(0, 120) + "..."
                    : publication.description}
                </p>
              )}
              <div className="wiki-pub-card-meta">
                <span className="wiki-badge published">v{publication.version}</span>
                <span>{publication.entries_count} 篇文档</span>
                {publication.published_at && (
                  <span>{formatRelativeDate(publication.published_at)}</span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}

function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
