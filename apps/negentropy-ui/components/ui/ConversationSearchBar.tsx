"use client";

import { useEffect, useRef } from "react";

export function ConversationSearchBar({
  query,
  onQueryChange,
  matchCount,
  currentIndex,
  onNavigateNext,
  onNavigatePrev,
  onClose,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  matchCount: number;
  currentIndex: number;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          onNavigatePrev();
        } else {
          onNavigateNext();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNavigateNext, onNavigatePrev]);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <svg
        className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="搜索对话内容..."
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400 min-w-[120px] dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      <span className="whitespace-nowrap text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
        {matchCount > 0 ? `${currentIndex}/${matchCount}` : "无结果"}
      </span>
      <button
        type="button"
        onClick={onNavigatePrev}
        disabled={matchCount === 0}
        className="rounded p-0.5 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-700"
        title="上一个 (Shift+Enter)"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m4.5 15.75 7.5-7.5 7.5 7.5"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={onNavigateNext}
        disabled={matchCount === 0}
        className="rounded p-0.5 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-700"
        title="下一个 (Enter)"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-0.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
        title="关闭 (Escape)"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18 18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
