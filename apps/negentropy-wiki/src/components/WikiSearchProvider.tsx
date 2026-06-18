"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { WikiSearchModal } from "@/components/WikiSearchModal";

/**
 * Wiki 搜索单例 Provider
 *
 * 职责边界（正交分解：机制与策略分离）：
 *   - 本 Provider 持有全站唯一的搜索 modal 状态与 ⌘K 全局监听（机制）；
 *   - WikiSearchBox 仅作为触发器调用 openSearch（策略入口）。
 *
 * 设计动机：侧栏内容同时渲染于桌面 aside 与移动端抽屉（见 WikiLayoutShell），
 * 若每个 WikiSearchBox 各自持有 modal 状态 + ⌘K 监听，会导致重复弹窗。
 * 单例 Provider 是单一事实源，从根源消除「双 modal」竞态。
 */

interface WikiSearchContextValue {
  /** 打开搜索 modal；可选携带初始查询词 */
  openSearch: (initialQuery?: string) => void;
  /** 关闭搜索 modal */
  closeSearch: () => void;
}

const WikiSearchContext = createContext<WikiSearchContextValue | null>(null);

/** 供 WikiSearchBox 等触发器消费的 hook；缺失 Provider 时退化为空操作 */
export function useWikiSearch(): WikiSearchContextValue {
  const ctx = useContext(WikiSearchContext);
  if (!ctx) {
    return { openSearch: () => {}, closeSearch: () => {} };
  }
  return ctx;
}

interface WikiSearchProviderProps {
  /** 当前 publication slug，用于检索范围限定 */
  pubSlug: string;
  children: ReactNode;
}

export function WikiSearchProvider({ pubSlug, children }: WikiSearchProviderProps) {
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");

  const openSearch = useCallback((q = "") => {
    setInitialQuery(q);
    setOpen(true);
  }, []);

  const closeSearch = useCallback(() => setOpen(false), []);

  // ⌘K / Ctrl+K 全局快捷键（单例，仅注册一次）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openSearch]);

  return (
    <WikiSearchContext.Provider value={{ openSearch, closeSearch }}>
      {children}
      {open && (
        <WikiSearchModal
          onClose={closeSearch}
          pubSlug={pubSlug}
          initialQuery={initialQuery}
        />
      )}
    </WikiSearchContext.Provider>
  );
}
