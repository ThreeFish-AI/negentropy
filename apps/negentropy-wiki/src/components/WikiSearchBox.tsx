"use client";

import { useState, useCallback, type FormEvent } from "react";

/**
 * Wiki Header 搜索框 — UI 壳，后续接入搜索 API。
 */
export function WikiSearchBox() {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!value.trim()) return;
      // TODO: 接入后端搜索 API 或跳转搜索结果页
    },
    [value],
  );

  return (
    <form className="wiki-search-box" onSubmit={handleSubmit} role="search">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"
          fill="currentColor"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜索文档..."
        aria-label="搜索文档"
      />
    </form>
  );
}
