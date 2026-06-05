"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import type { WikiSearchResultItem } from "@/lib/search-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WikiSearchModalProps {
  onClose: () => void;
  pubSlug: string;
  /** 搜索框传入的初始值 */
  initialQuery?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Debounce hook：通过 effect 同步最新回调，避免在 render 期间写 ref */
function useDebouncedCallback(
  fn: (q: string) => void,
  delayMs: number,
): (q: string) => void {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    (q: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(q), delayMs);
    },
    [delayMs],
  );
}

/** 在 snippet 文本中高亮 query 关键词 */
function highlightSnippet(
  snippet: string,
  query: string,
): Array<{ text: string; highlight: boolean }> {
  if (!query.trim()) return [{ text: snippet, highlight: false }];

  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return [{ text: snippet, highlight: false }];

  const pattern = new RegExp(`(${terms.join("|")})`, "gi");
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;

  for (const match of snippet.matchAll(new RegExp(pattern.source, "gi"))) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      parts.push({ text: snippet.slice(lastIndex, idx), highlight: false });
    }
    parts.push({ text: match[0], highlight: true });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < snippet.length) {
    parts.push({ text: snippet.slice(lastIndex), highlight: false });
  }
  return parts.length ? parts : [{ text: snippet, highlight: false }];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WikiSearchModal({
  onClose,
  pubSlug,
  initialQuery = "",
}: WikiSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<WikiSearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 挂载时聚焦输入框，卸载时把焦点归还触发器（组件由 WikiSearchProvider
  // 条件渲染控制挂载/卸载，故初始 state 已为最新 initialQuery，无需 effect 重置）
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      // 恢复焦点到打开 modal 前的元素（可访问性：键盘/读屏用户不丢失焦点）
      previouslyFocused?.focus?.();
    };
  }, []);

  // Body scroll lock（组件挂载即锁定，卸载时恢复）
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // 执行搜索
  const doSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        // 清空输入：取消挂起的 in-flight 请求，避免其返回后回填已清空的界面
        abortRef.current?.abort();
        setResults([]);
        setSearched(false);
        setLoading(false);
        return;
      }

      // 取消上一次请求
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pubSlug, query: trimmed }),
          signal: controller.signal,
        });
        if (!res.ok) {
          console.error("[WikiSearch] API error:", res.status);
          setResults([]);
        } else {
          const data = await res.json();
          setResults(data.items || []);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[WikiSearch] fetch error:", err);
          setResults([]);
        }
      } finally {
        setLoading(false);
        setSearched(true);
        setActiveIndex(-1);
      }
    },
    [pubSlug],
  );

  // Debounced search
  const debouncedSearch = useDebouncedCallback(doSearch, 300);

  // 输入变化时触发 debounce search
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      debouncedSearch(value);
    },
    [debouncedSearch],
  );

  // Escape 关闭
  useEffect(() => {
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // 跳转到结果页
  const handleNavigate = useCallback(
    (item: WikiSearchResultItem) => {
      const snippetParam = encodeURIComponent(item.snippet.slice(0, 60));
      const url = `${item.wikiUrl}?search_snippet=${snippetParam}`;
      onClose();
      window.location.href = url;
    },
    [onClose],
  );

  // 键盘导航（在 dialog 内的 keydown）
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        const item = results[activeIndex];
        handleNavigate(item);
      }
    },
    [results, activeIndex, handleNavigate],
  );

  // 计算分数最大值用于归一化（combined 为后端融合分数）
  const maxScore = useMemo(() => {
    if (!results.length) return 0;
    return Math.max(...results.map((r) => r.scores?.combined ?? 0), 0.001);
  }, [results]);

  // 使用 createPortal 将模态框挂载到 body，避免受侧栏 CSS 影响
  return createPortal(
    <div
      className="wiki-search-modal-root"
      onClick={(e) => {
        // 点击背景关闭（仅 overlay，不包含 dialog 内容）
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="wiki-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="搜索文档"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="wiki-search-dialog-header">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0, color: "var(--wiki-text-secondary)" }}
          >
            <path
              d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"
              fill="currentColor"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="wiki-search-dialog-input"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="搜索文档..."
            aria-label="搜索文档"
          />
          <button
            className="wiki-search-dialog-close"
            onClick={onClose}
            aria-label="关闭搜索"
          >
            ✕
          </button>
        </div>

        {/* Results */}
        <div className="wiki-search-dialog-results" ref={resultsRef}>
          {loading && (
            <div className="wiki-search-dialog-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="wiki-search-skeleton" />
              ))}
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="wiki-search-dialog-empty">
              未找到与「{query}」相关的文档片段
            </div>
          )}

          {!loading &&
            results.map((item, idx) => {
              const score = item.scores?.combined ?? 0;
              const scorePct = Math.round((score / maxScore) * 100);
              const parts = highlightSnippet(item.snippet, query);

              return (
                <button
                  key={item.id}
                  className="wiki-search-result"
                  data-active={idx === activeIndex}
                  onClick={() => handleNavigate(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <div className="wiki-search-result-title">
                    {item.entryTitle}
                  </div>
                  <div className="wiki-search-result-snippet">
                    {parts.map((p, i) =>
                      p.highlight ? (
                        <mark key={i}>{p.text}</mark>
                      ) : (
                        <span key={i}>{p.text}</span>
                      ),
                    )}
                  </div>
                  <div className="wiki-search-result-meta">
                    <div
                      className="wiki-search-result-score"
                      style={{ width: `${Math.max(scorePct, 8)}%` }}
                    />
                    {item.sourceUri && (
                      <span className="wiki-search-result-source">
                        {item.sourceUri.split("/").pop()}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>

        {/* Footer */}
        <div className="wiki-search-dialog-footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> 导航
          </span>
          <span>
            <kbd>↵</kbd> 跳转
          </span>
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
