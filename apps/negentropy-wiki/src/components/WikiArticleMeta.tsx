interface WikiArticleMetaProps {
  authorName?: string | null;
  authorUrl?: string | null;
  publishedAt?: string | null;
  sourceUrl?: string | null;
}

/**
 * 文章元数据栏 — 展示在标题与正文之间
 *
 * 纯静态化后仅保留静态字段（作者 / 发布时间 / 源头链接），由 SSG 从静态内容包
 * 直接注入。浏览 / 评论 / 注解等动态计数随纯静态化移除（站点不再依赖后端）。
 */
export function WikiArticleMeta({
  authorName,
  authorUrl,
  publishedAt,
  sourceUrl,
}: WikiArticleMetaProps) {
  const hasAnyMeta = authorName || publishedAt || sourceUrl;

  if (!hasAnyMeta) return null;

  return (
    <div className="wiki-article-meta">
      {/* 作者 */}
      {authorName && (
        <span className="wiki-meta-author">
          <AuthorAvatar authorName={authorName} authorUrl={authorUrl} />
          {authorUrl ? (
            <a
              className="wiki-meta-author-name"
              href={authorUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {authorName}
            </a>
          ) : (
            <span className="wiki-meta-author-name">{authorName}</span>
          )}
        </span>
      )}

      {authorName && (publishedAt || sourceUrl) && (
        <span className="wiki-meta-sep">·</span>
      )}

      {/* 发布时间 */}
      {publishedAt && (
        <span className="wiki-meta-item">
          <CalendarIcon />
          {formatDate(publishedAt)}
        </span>
      )}

      {/* 源头链接 */}
      {sourceUrl && (
        <>
          <span className="wiki-meta-sep">·</span>
          <span className="wiki-meta-item">
            <ExternalLinkIcon />
            <a
              className="wiki-meta-source-link"
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              原文链接
            </a>
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子组件 & 工具函数
// ---------------------------------------------------------------------------

function AuthorAvatar({
  authorName,
  authorUrl,
}: {
  authorName: string;
  authorUrl?: string | null;
}) {
  // 尝试从 GitHub URL 提取头像
  let avatarSrc: string | null = null;
  if (authorUrl) {
    const ghMatch = authorUrl.match(/github\.com\/([^/?#]+)/);
    if (ghMatch) {
      avatarSrc = `https://avatars.githubusercontent.com/${ghMatch[1]}?s=48`;
    }
  }

  if (avatarSrc) {
    return (
      <img
        className="wiki-meta-author-avatar"
        src={avatarSrc}
        alt={authorName}
        width={24}
        height={24}
      />
    );
  }

  // 首字母回退
  return (
    <span className="wiki-meta-author-avatar-fallback">
      {authorName.charAt(0).toUpperCase()}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// 内联 SVG 图标（与 wiki 现有无图标库风格一致）
// ---------------------------------------------------------------------------

function CalendarIcon() {
  return (
    <svg
      className="wiki-meta-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <line x1="5" y1="1" x2="5" y2="4" />
      <line x1="11" y1="1" x2="11" y2="4" />
      <line x1="2" y1="7" x2="14" y2="7" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="wiki-meta-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 1.5h5.5V7" />
      <path d="M14.5 1.5L7.5 8.5" />
      <path d="M6.5 3H3a1.5 1.5 0 00-1.5 1.5V13A1.5 1.5 0 003 14.5h8.5A1.5 1.5 0 0013 13V9.5" />
    </svg>
  );
}
