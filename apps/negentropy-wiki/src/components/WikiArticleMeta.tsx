"use client";

import { useEntryStats } from "@/lib/use-entry-stats";

interface WikiArticleMetaProps {
  entryId: string;
  authorName?: string | null;
  authorUrl?: string | null;
  publishedAt?: string | null;
  sourceUrl?: string | null;
}

/**
 * 文章元数据栏 — 展示在标题与正文之间
 *
 * 静态数据（作者 / 发布时间 / 源头链接）由 SSG 注入 props；
 * 动态数据（浏览 / 评论 / 注解计数）在客户端通过 /stats 端点获取。
 */
export function WikiArticleMeta({
  entryId,
  authorName,
  authorUrl,
  publishedAt,
  sourceUrl,
}: WikiArticleMetaProps) {
  const { stats } = useEntryStats(entryId);

  const commentTotal = stats
    ? stats.comment_count + stats.annotation_count
    : null;

  const hasAnyMeta = authorName || publishedAt || sourceUrl || stats;

  if (!hasAnyMeta) return null;

  return (
    <div className="wiki-article-meta">
      {/* 作者 */}
      {authorName && (
        <span className="wiki-meta-author">
          <AuthorAvatar
            authorName={authorName}
            authorUrl={authorUrl}
          />
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

      {authorName && (publishedAt || stats || sourceUrl) && (
        <span className="wiki-meta-sep">·</span>
      )}

      {/* 发布时间 */}
      {publishedAt && (
        <span className="wiki-meta-item">
          <CalendarIcon />
          {formatDate(publishedAt)}
        </span>
      )}

      {/* 浏览次数 */}
      <span className="wiki-meta-item">
        <EyeIcon />
        {stats ? formatNumber(stats.view_count) : "–"}
      </span>

      {/* 评论总数（评论 + 注解） */}
      <span className="wiki-meta-item">
        <CommentIcon />
        {commentTotal !== null ? formatNumber(commentTotal) : "–"}
      </span>

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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// 内联 SVG 图标（15×15，opacity 0.55，与 wiki 现有无图标库风格一致）
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

function EyeIcon() {
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
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function CommentIcon() {
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
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3z" />
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
