"use client";

import { useCallback, type FormEvent } from "react";
import { useWikiSearch } from "@/components/WikiSearchProvider";

/**
 * Wiki 搜索框 — 点击触发全站单例搜索 modal（⌘K 由 WikiSearchProvider 统一监听）。
 *
 * 放置于侧栏顶部（searchSlot）。本组件仅作触发器，不持有 modal 状态，
 * 故桌面 aside 与移动抽屉两处复用时不会产生重复弹窗。
 */
export function WikiSearchBox() {
  const { openSearch } = useWikiSearch();

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      openSearch();
    },
    [openSearch],
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
        placeholder="搜索文档..."
        aria-label="搜索文档"
        readOnly
        onClick={() => openSearch()}
        onKeyDown={(e) => {
          if (e.key === "Enter") openSearch();
        }}
      />
      <kbd className="wiki-search-kbd" aria-hidden="true">
        ⌘K
      </kbd>
    </form>
  );
}
