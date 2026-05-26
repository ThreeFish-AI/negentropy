"use client";

import { useState, useCallback } from "react";
import { useWikiAuth } from "@/lib/auth/wiki-auth";
import { useComments, type CommentItem } from "@/lib/comment/use-comments";

export function WikiCommentSection({ entryId }: { entryId: string; commentCount?: number }) {
  const { status: authStatus, user, login } = useWikiAuth();
  const { comments, total, loading, createComment, deleteComment } = useComments(entryId);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    const comment = await createComment(text.trim());
    if (comment) {
      setText("");
    }
    setSubmitting(false);
  }, [text, submitting, createComment]);

  const handleDelete = useCallback(
    async (commentId: string) => {
      await deleteComment(commentId);
    },
    [deleteComment],
  );

  const isAuthenticated = authStatus === "authenticated";

  return (
    <section className="wiki-comment-section">
      <h3 className="wiki-comment-heading">
        评论 {total > 0 && <span className="wiki-comment-count">({total})</span>}
      </h3>

      {isAuthenticated ? (
        <div className="wiki-comment-composer">
          <textarea
            className="wiki-comment-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="发表评论..."
            rows={3}
          />
          <div className="wiki-comment-footer">
            <span className="wiki-comment-charcount">{text.length} 字</span>
            <button
              type="button"
              className="wiki-comment-submit"
              disabled={!text.trim() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "提交中..." : "提交"}
            </button>
          </div>
        </div>
      ) : (
        <div className="wiki-comment-login-prompt">
          <button type="button" className="wiki-comment-login-btn" onClick={login}>
            登录后评论
          </button>
        </div>
      )}

      <div className="wiki-comment-list">
        {loading && comments.length === 0 && (
          <p className="wiki-comment-empty">加载评论中...</p>
        )}
        {!loading && total === 0 && (
          <p className="wiki-comment-empty">暂无评论，来发表第一条评论吧~</p>
        )}
        {comments.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            currentUserId={user?.userId}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </section>
  );
}

function CommentCard({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: CommentItem;
  currentUserId?: string;
  onDelete: (id: string) => Promise<void>;
}) {
  const isOwner = currentUserId && comment.user_id === currentUserId;
  const timeAgo = formatTimeAgo(comment.created_at);

  return (
    <div className="wiki-comment-card">
      <div className="wiki-comment-card-header">
        {comment.user_picture ? (
          <img
            className="wiki-comment-avatar"
            src={comment.user_picture}
            alt={comment.user_name || ""}
            width={28}
            height={28}
          />
        ) : (
          <div className="wiki-comment-avatar-placeholder">
            {(comment.user_name || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <span className="wiki-comment-author">{comment.user_name || "匿名"}</span>
        <span className="wiki-comment-time">{timeAgo}</span>
        {isOwner && (
          <button
            type="button"
            className="wiki-comment-delete-btn"
            title="删除评论"
            onClick={() => void onDelete(comment.id)}
          >
            &times;
          </button>
        )}
      </div>
      <p className="wiki-comment-body">{comment.body}</p>
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
