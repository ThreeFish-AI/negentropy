"use client";

import { useEffect, useRef } from "react";

/**
 * useInfiniteScrollSentinel —— 无限滚动哨兵（IntersectionObserver 封装）。
 *
 * 职责单一：当「底部哨兵元素」进入滚动视口（含 rootMargin 预取边界）且 enabled 时，
 * 触发一次 onReach（通常 = useInfiniteList.loadMore）。数据/缓冲由 useInfiniteList 持有，
 * 本 hook 只回答「何时该再加载」。
 *
 * - ``root`` 可配置：页面级滚动传 undefined（viewport）；抽屉/面板内嵌滚动须传该容器 ref，
 *   否则哨兵相对错误的 root 计算可见性、永不触发或一直触发。
 * - ``enabled=false`` 时 disconnect（无更多 / 加载中 / 出错时关闭），杜绝重复触发与泄漏。
 * - onReach 经 ref 透传，回调 identity 变化不重建 observer。
 */
export interface UseInfiniteScrollSentinelOptions {
  onReach: () => void;
  /** 仅在 hasMore && !loadingMore 时为 true。 */
  enabled: boolean;
  /** 滚动容器 ref；undefined/无 .current 时相对 viewport。 */
  root?: React.RefObject<HTMLElement | null>;
  /** 预取边界，默认提前 200px 触发。 */
  rootMargin?: string;
}

/** 解析 rootMargin 的像素前缀（仅支持 px 形如 "200px"；% 归 0，保持简单）。 */
function parseMarginPx(margin: string): number {
  const m = /^(-?\d+(?:\.\d+)?)(px|%)?$/.exec(margin.trim());
  if (!m) return 0;
  return m[2] === "%" ? 0 : parseFloat(m[1]);
}

/**
 * 实时复核：哨兵顶端是否在 root 底沿 + margin 之内（即「该再加载」）。
 * IntersectionObserver 在 ``enabled`` 切换重建时可能给出陈旧的 isIntersecting，
 * 仅凭它会导致首屏一次性把全部页拉空；此复核用实时布局兜底，确保「视口填满即停」。
 */
function isWithinRoot(sentinel: HTMLElement, root: HTMLElement | null, margin: string): boolean {
  const s = sentinel.getBoundingClientRect();
  const limit = (root ? root.getBoundingClientRect().bottom : window.innerHeight) + parseMarginPx(margin);
  return s.top <= limit;
}

export function useInfiniteScrollSentinel({
  onReach,
  enabled,
  root,
  rootMargin = "200px",
}: UseInfiniteScrollSentinelOptions): { sentinelRef: React.RefObject<HTMLDivElement | null> } {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onReachRef = useRef(onReach);
  useEffect(() => {
    onReachRef.current = onReach;
  });

  const rootEl = root?.current ?? null;

  useEffect(() => {
    if (!enabled) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          // 实时布局复核：规避 observer 重建时的陈旧回调，防首屏拉空大列表。
          if (isWithinRoot(node, rootEl, rootMargin)) {
            onReachRef.current();
            break;
          }
        }
      },
      { root: rootEl, rootMargin, threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootEl, rootMargin]);

  return { sentinelRef };
}

/**
 * useScrollPageSync —— 滚动联动「当前页」高亮（可选增强）。
 *
 * 在每页首元素挂 ``data-infinite-page="{n}"`` 锚点，本 hook 用单个 IntersectionObserver
 * 监听这些锚点，取与视口中线相交的最大页号回写为 currentPage，使页码控件随滚动高亮。
 *
 * - ``programmaticRef``：程序化 scrollIntoView 期间置 true，抑制 observer 回写，防跳页与
 *   滚动联动互相递归抖动。
 * - ``rescanKey``：items 变化时改变它以重扫锚点（新页渲染后重新 observe）。
 */
export interface UseScrollPageSyncOptions {
  enabled: boolean;
  onPageChange: (page: number) => void;
  root?: React.RefObject<HTMLElement | null>;
  /** items 数量/内容变化的信号，用于重扫 [data-infinite-page] 锚点。 */
  rescanKey: unknown;
  /** 程序化滚动闸门：为 true 时暂不回写。 */
  programmaticRef?: React.RefObject<boolean>;
}

export function useScrollPageSync({
  enabled,
  onPageChange,
  root,
  rescanKey,
  programmaticRef,
}: UseScrollPageSyncOptions): void {
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  });
  const rootEl = root?.current ?? null;

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const scope: ParentNode = rootEl ?? document;
    const anchors = Array.from(scope.querySelectorAll<HTMLElement>("[data-infinite-page]"));
    if (anchors.length === 0) return;

    const visible = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        if (programmaticRef?.current) return;
        for (const entry of entries) {
          const raw = (entry.target as HTMLElement).dataset.infinitePage;
          const page = raw ? Number.parseInt(raw, 10) : NaN;
          if (Number.isNaN(page)) continue;
          if (entry.isIntersecting) visible.add(page);
          else visible.delete(page);
        }
        if (visible.size > 0) {
          // 取与视口中线相交的最小页（最靠上的可见页）作为"当前页"。
          onPageChangeRef.current(Math.min(...visible));
        }
      },
      { root: rootEl, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    anchors.forEach((a) => observer.observe(a));
    return () => observer.disconnect();
  }, [enabled, rootEl, rescanKey, programmaticRef]);
}
