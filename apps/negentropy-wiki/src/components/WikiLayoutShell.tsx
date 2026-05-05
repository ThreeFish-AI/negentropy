"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Wiki 三栏外壳 — 持有右栏 TOC 折叠态并把 `data-toc` 写到根节点。
 *
 * 设计要点：
 *   - 客户端组件，但首次渲染时 `collapsed = false`（与 SSR 一致）；
 *     `useEffect` 内再读取 localStorage 调整，避免 hydration mismatch。
 *   - 通过 React Context 把 `collapsed / setCollapsed` 暴露给 `WikiToc`，
 *     避免 `document.querySelector` 黑魔法。
 *   - `hasToc=false` 时强制 `data-toc="none"`，CSS Grid 自动收回第三列。
 */

const TOC_STORAGE_KEY = "wiki:toc:collapsed";

interface TocContextValue {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggle: () => void;
  hasToc: boolean;
}

const TocContext = createContext<TocContextValue | null>(null);

export function useTocLayout(): TocContextValue {
  const ctx = useContext(TocContext);
  if (!ctx) {
    // 在缺失 Provider 的情况下退化为「无 TOC」语义，避免组件硬崩。
    return {
      collapsed: false,
      setCollapsed: () => {},
      toggle: () => {},
      hasToc: false,
    };
  }
  return ctx;
}

interface WikiLayoutShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  toc?: ReactNode;
  hasToc?: boolean;
  /**
   * 顶部 Header（站点品牌 + 一级 tabs）。
   *
   * 渲染在 `.wiki-layout` 之外作为兄弟节点 —— 不参与 3 列 Grid，避免动 `data-toc` 三态。
   * Sticky 偏移由 globals.css 的 `--wiki-header-height` 处理（sidebar / toc-aside 的 top）。
   */
  header?: ReactNode;
  /** 同站多布局共存时的命名空间隔离 */
  storageKey?: string;
}

export function WikiLayoutShell({
  sidebar,
  children,
  toc,
  hasToc = false,
  header,
  storageKey = TOC_STORAGE_KEY,
}: WikiLayoutShellProps) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "1") setCollapsedState(true);
    } catch {
      // 隐私模式或被禁用时忽略
    }
  }, [storageKey]);

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  const toggle = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  const ctxValue = useMemo<TocContextValue>(
    () => ({ collapsed, setCollapsed, toggle, hasToc }),
    [collapsed, setCollapsed, toggle, hasToc],
  );

  const dataToc = !hasToc ? "none" : collapsed ? "collapsed" : "expanded";

  return (
    <TocContext.Provider value={ctxValue}>
      {header}
      <div className="wiki-layout" data-toc={dataToc} data-header={header ? "" : undefined}>
        <aside className="wiki-sidebar">{sidebar}</aside>
        <main className="wiki-main">{children}</main>
        {hasToc && <aside className="wiki-toc-aside">{toc}</aside>}
      </div>
    </TocContext.Provider>
  );
}
