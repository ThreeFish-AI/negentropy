"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WikiSearchModalProps {
  onClose: () => void;
  pubSlug: string;
  /** 搜索框传入的初始值 */
  initialQuery?: string;
}

/** Pagefind 检索结果（仅取展示所需字段）。 */
interface PagefindSearchResult {
  url: string;
  excerpt: string;
  title: string | null;
}

/** Pagefind 运行时模块的最小子集（构建期产物，无 TS 类型）。 */
interface PagefindModule {
  init: () => Promise<unknown>;
  search: (query: string) => Promise<{
    results: Array<{ id: string; score: number; data: () => Promise<PagefindSearchResult> }>;
  }>;
}

// ---------------------------------------------------------------------------
// Pagefind 懒加载
//
// Pagefind 索引由 postbuild（`pagefind --site out`）生成到 `out/pagefind/`，
// 仅存在于**构建产物**中。运行时通过绝对路径 `/pagefind/pagefind.js` 懒加载；
// 用变量名 + `@vite-ignore` 阻止打包器静态解析（产物路径在构建后才存在）。
// `next dev` 无该产物 → import 抛错 → 由调用方 catch 优雅降级。
// ---------------------------------------------------------------------------

const PAGEFIND_ENTRY = "/pagefind/pagefind.js";
let pagefindPromise: Promise<PagefindModule> | null = null;

/**
 * 运行时动态 import，对打包器不可见。
 *
 * Pagefind 产物 `/pagefind/pagefind.js` 仅在构建后存在于 `out/`，构建期不存在，
 * 若用静态 `import()` 会被 Turbopack 尝试解析而报 module not found。
 * 用 `new Function` 构造的 importer 不在静态分析范围内，运行时才求值。
 */
const runtimeImport = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<PagefindModule>;

function loadPagefind(): Promise<PagefindModule> {
  if (!pagefindPromise) {
    pagefindPromise = runtimeImport(PAGEFIND_ENTRY)
      .then((mod) => {
        if (typeof mod.init === "function") mod.init();
        return mod;
      })
      .catch((err) => {
        pagefindPromise = null;
        throw err;
      });
  }
  return pagefindPromise;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WikiSearchModal({
  onClose,
  initialQuery = "",
}: WikiSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PagefindSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  // 挂载时聚焦输入框，卸载时把焦点归还触发器
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // 执行搜索（Pagefind 客户端检索）
  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setUnavailable(false);
    try {
      const pagefind = await loadPagefind();
      const search = await pagefind.search(trimmed);
      // 取分数最高的前若干条；并发拉取每个结果的展示数据。
      const top = search.results.slice(0, 12);
      const dataResults = await Promise.all(top.map((r) => r.data()));
      if (reqId !== reqIdRef.current) return; // 已有更新的查询，丢弃本次结果
      setResults(dataResults);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      console.warn("[WikiSearch] Pagefind unavailable:", err);
      setResults([]);
      setUnavailable(true);
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
        setSearched(true);
        setActiveIndex(-1);
      }
    }
  }, []);

  // Debounce（300ms）封装：避免在 render 期写 ref。
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => doSearch(value), 300);
    },
    [doSearch],
  );

  // Escape 关闭
  useEffect(() => {
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // 跳转到结果页（Pagefind 的 url 已含尾斜杠，直接导航）
  const handleNavigate = useCallback(
    (item: PagefindSearchResult) => {
      onClose();
      window.location.href = item.url;
    },
    [onClose],
  );

  // 键盘导航
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
        handleNavigate(results[activeIndex]);
      }
    },
    [results, activeIndex, handleNavigate],
  );

  return createPortal(
    <div
      className="wiki-search-modal-root"
      onClick={(e) => {
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
        <div className="wiki-search-dialog-results">
          {loading && (
            <div className="wiki-search-dialog-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="wiki-search-skeleton" />
              ))}
            </div>
          )}

          {!loading && unavailable && (
            <div className="wiki-search-dialog-empty">
              搜索索引暂不可用（需在站点构建后生成）。
            </div>
          )}

          {!loading && !unavailable && searched && results.length === 0 && (
            <div className="wiki-search-dialog-empty">
              未找到与「{query}」相关的文档片段
            </div>
          )}

          {!loading &&
            results.map((item, idx) => (
              <button
                key={item.url + idx}
                className="wiki-search-result"
                data-active={idx === activeIndex}
                onClick={() => handleNavigate(item)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div className="wiki-search-result-title">
                  {item.title || item.url}
                </div>
                {/* Pagefind excerpt 已含 <mark> 高亮，安全渲染自有静态内容 */}
                <div
                  className="wiki-search-result-snippet"
                  dangerouslySetInnerHTML={{ __html: item.excerpt }}
                />
              </button>
            ))}
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
