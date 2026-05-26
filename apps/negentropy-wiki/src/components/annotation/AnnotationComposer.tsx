"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface Props {
  quotedText: string;
  position: { x: number; y: number };
  onSubmit: (body: string) => void;
  onCancel: () => void;
}

export function AnnotationComposer({ quotedText, position, onSubmit, onCancel }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!text.trim()) return;
    onSubmit(text.trim());
  }, [text, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [onCancel, handleSubmit],
  );

  return (
    <div
      className="wiki-annotation-composer"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <blockquote className="wiki-annotation-quote">{quotedText}</blockquote>
      <textarea
        ref={textareaRef}
        className="wiki-annotation-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入注解..."
        rows={2}
      />
      <div className="wiki-annotation-composer-actions">
        <button type="button" className="wiki-annotation-cancel-btn" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="wiki-annotation-submit-btn"
          disabled={!text.trim()}
          onClick={handleSubmit}
        >
          提交
        </button>
      </div>
    </div>
  );
}
