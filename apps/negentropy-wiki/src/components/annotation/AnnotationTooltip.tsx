"use client";

import type { AnnotationItem } from "@/lib/annotation/use-annotations";

interface Props {
  position: {
    x: number;
    y: number;
    annotations: AnnotationItem[];
  };
  currentUserId?: string;
  onDelete?: (annotationId: string) => Promise<void>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function AnnotationTooltip({
  position,
  currentUserId,
  onDelete,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const { x, y, annotations } = position;

  return (
    <div
      className="wiki-annotation-tooltip"
      style={{ left: `${x}px`, top: `${y}px` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {annotations.map((annotation) => (
        <div key={annotation.id} className="wiki-annotation-tooltip-item">
          {onDelete && currentUserId && annotation.user_id === currentUserId && (
            <button
              type="button"
              className="wiki-annotation-tooltip-delete"
              title="删除注解"
              onClick={(e) => {
                e.stopPropagation();
                void onDelete(annotation.id);
              }}
            >
              ×
            </button>
          )}
          <p className="wiki-annotation-tooltip-body">{annotation.body}</p>
          <div className="wiki-annotation-tooltip-meta">
            {annotation.user_picture ? (
              <img
                className="wiki-annotation-tooltip-avatar"
                src={annotation.user_picture}
                alt={annotation.user_name || ""}
                width={18}
                height={18}
              />
            ) : (
              <span className="wiki-annotation-tooltip-avatar-placeholder">
                {(annotation.user_name || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="wiki-annotation-tooltip-author">
              {annotation.user_name || "匿名"}
            </span>
            <span className="wiki-annotation-tooltip-time">
              {formatTimeAgo(annotation.created_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  return date.toLocaleDateString("zh-CN");
}
