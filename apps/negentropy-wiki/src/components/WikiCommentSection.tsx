"use client";

import { useState, useCallback } from "react";

/**
 * Wiki 评论区 — UI 壳。
 *
 * 包含评论编辑器（textarea + 工具栏 + 提交按钮）和评论列表（空状态）。
 * 后端 API 尚不支持评论，提交按钮当前为 disabled 状态。
 */
export function WikiCommentSection({
  commentCount = 0,
}: {
  entryId: string;
  commentCount?: number;
}) {
  const [text, setText] = useState("");

  const insertMarkdown = useCallback((prefix: string, suffix: string) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".wiki-comment-textarea",
    );
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);
    const next = text.slice(0, start) + prefix + selected + suffix + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length,
      );
    });
  }, [text]);

  return (
    <section className="wiki-comment-section">
      <h3 className="wiki-comment-heading">
        评论 {commentCount > 0 && <span className="wiki-comment-count">({commentCount})</span>}
      </h3>

      <div className="wiki-comment-composer">
        <textarea
          className="wiki-comment-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="欢迎评论"
          rows={3}
        />
        <div className="wiki-comment-toolbar">
          <button
            type="button"
            className="wiki-comment-toolbar-btn"
            title="加粗"
            onClick={() => insertMarkdown("**", "**")}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className="wiki-comment-toolbar-btn"
            title="斜体"
            onClick={() => insertMarkdown("*", "*")}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className="wiki-comment-toolbar-btn"
            title="下划线"
            onClick={() => insertMarkdown("<u>", "</u>")}
          >
            U
          </button>
          <button
            type="button"
            className="wiki-comment-toolbar-btn"
            title="代码块"
            onClick={() => insertMarkdown("`", "`")}
          >
            {"</>"}
          </button>
          <button
            type="button"
            className="wiki-comment-toolbar-btn"
            title="链接"
            onClick={() => insertMarkdown("[", "](url)")}
          >
            🔗
          </button>
        </div>
        <div className="wiki-comment-footer">
          <span className="wiki-comment-charcount">{text.length} 字</span>
          <button
            type="button"
            className="wiki-comment-submit"
            disabled
            title="评论功能即将上线"
          >
            提交
          </button>
        </div>
      </div>

      <div className="wiki-comment-list">
        {commentCount === 0 && (
          <p className="wiki-comment-empty">暂无评论，来发表第一条评论吧~</p>
        )}
      </div>
    </section>
  );
}
