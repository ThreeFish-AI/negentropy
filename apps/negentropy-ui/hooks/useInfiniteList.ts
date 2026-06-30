/* eslint-disable react-hooks/set-state-in-effect --
 * 同 useRoutineData / useHeartbeatPoll：本 hook 在 useEffect 内调用取数器间接 setState，
 * 系 React 19 + eslint-plugin-react-hooks v7 严格度提升命中的既有数据加载范式，功能正确。
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * useInfiniteList —— 全站统一的「游标/偏移/客户端」三态分页取数 hook。
 *
 * 设计目标（Single Source of Truth）：收敛此前 13 处各自为政的翻页实现，
 * 用单一 API 同时支撑三种取数语义，并满足「页码跳页 + 无限滚动 + 精确总数」并存：
 *
 * - ``cursor``：游标前向只读（Routine / Scheduler）。跳页靠前向顺序补齐（受 maxSequentialFetch 封顶）。
 * - ``offset``：偏移随机访问（Knowledge）。跳页可单次大 limit 一并补齐缺口（gap-free）。
 * - ``client``：全量已在内存（如带本地筛选的列表）。仅做渐进式切片，零网络、total 精确。
 *
 * 缓冲采用**连续前缀**（永不留空洞）：无论哪种模式，buffer 恒为有序前缀 ``items[0..k)``，
 * ``goToPage(n)`` 保证前缀覆盖第 n 页后再定位，``loadMore()`` 仅向后追加一页。
 * 这消除了「随机跳页产生空洞→渲染跳号」一类风险，渲染层只需平铺 ``items`` 即可。
 *
 * 沿用既有范式：``reqIdRef`` 过期请求丢弃、``filterKey=JSON.stringify`` 稳定 effect 依赖、
 * ``enabled`` gate（对齐 [[useHeartbeatPoll]]）、``AbortController`` 取消在途请求。
 * 对外**只暴露 1-indexed** 页码，统一此前 0/1 混用。
 */

// ---------------------------------------------------------------------------
// Fetcher 适配器契约（薄包各 feature 的 api.ts，不改其原始契约）
// ---------------------------------------------------------------------------

/** 游标型一页响应（next_cursor / next_before_seq / next_after_seq 归一为 nextCursor）。 */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | number | null;
  hasMore: boolean;
  /** 后端补 COUNT 后填精确总数；暂缺则 null（totalPages 退化为已加载页数）。 */
  total: number | null;
}

export interface CursorFetcher<T, F = unknown> {
  kind: "cursor";
  /** cursor=null 表示拉第一页。 */
  fetchPage: (args: {
    cursor: string | number | null;
    limit: number;
    filters?: F;
    signal?: AbortSignal;
  }) => Promise<CursorPage<T>>;
}

/** 偏移型一段响应（count / total 归一为 total，必填）。 */
export interface OffsetRange<T> {
  items: T[];
  total: number;
}

export interface OffsetFetcher<T, F = unknown> {
  kind: "offset";
  fetchRange: (args: {
    offset: number;
    limit: number;
    filters?: F;
    signal?: AbortSignal;
  }) => Promise<OffsetRange<T>>;
  /** 端点单次 limit 上限（用于跳页时单请求补齐缺口）。默认 200。 */
  maxLimit?: number;
}

/** 客户端型：全量数组已在内存，仅做渐进切片（无网络）。 */
export interface ClientFetcher<T> {
  kind: "client";
  items: T[];
}

export type ListFetcher<T, F = unknown> = CursorFetcher<T, F> | OffsetFetcher<T, F> | ClientFetcher<T>;

// ---------------------------------------------------------------------------
// Hook 入参 / 返回
// ---------------------------------------------------------------------------

export interface UseInfiniteListOptions<T, F = unknown> {
  fetcher: ListFetcher<T, F>;
  /** 每页条数（1-indexed 语义下，第 n 页 = items[(n-1)*pageSize, n*pageSize)）。 */
  pageSize: number;
  /** 业务筛选/排序键；序列化后进 effect 依赖，变化即 reset（对齐既有 filterKey）。 */
  filters?: F;
  /** 额外依赖（如 routineId / corpusId）；任一变化即 reset。 */
  deps?: ReadonlyArray<unknown>;
  /** false 时挂起取数（抽屉未打开等），hook 不发请求（对齐 useHeartbeatPoll.enabled）。 */
  enabled?: boolean;
  /** 游标型 goToPage 远端跳页的前向补齐页数上限，防打爆后端。默认 20。 */
  maxSequentialFetch?: number;
}

export interface UseInfiniteListResult<T> {
  /** 连续前缀缓冲（平铺渲染用）。 */
  items: T[];
  /** 当前页（1-indexed），由 goToPage 或滚动联动设置。 */
  currentPage: number;
  /** 后端精确总数；未知时 null。 */
  total: number | null;
  /** total 已知 → ceil(total/pageSize)；未知 → 已加载页数(+hasMore 兜底 1)。 */
  totalPages: number;
  /** 已进缓冲的页数（连续滚动进度）。 */
  loadedPages: number;
  goToPage: (page: number) => void;
  loadMore: () => void;
  reset: () => void;
  refresh: () => void;
  /** 首屏 / 跳页在途（用于骨架屏）。 */
  loading: boolean;
  /** 仅向后追加在途（用于底部小 spinner，避免追加时整列表闪骨架）。 */
  loadingMore: boolean;
  /** 还有未加载的后续页。 */
  hasMore: boolean;
  error: string | null;
}

interface ServerBuffer<T> {
  items: T[];
  cursor: string | number | null;
  hasMore: boolean;
  total: number | null;
}

function freshBuffer<T>(): ServerBuffer<T> {
  return { items: [], cursor: null, hasMore: true, total: null };
}

export function useInfiniteList<T, F = unknown>(
  opts: UseInfiniteListOptions<T, F>,
): UseInfiniteListResult<T> {
  const { fetcher, pageSize, filters, deps, enabled = true, maxSequentialFetch = 20 } = opts;
  const isClient = fetcher.kind === "client";

  // 服务端缓冲：state 驱动渲染（render 只读 state，满足 react-hooks/refs），
  // bufRef 为同步镜像，供异步 ensureLoaded 在回调里读取最新缓冲（规避 stale 闭包）。
  const [serverBuf, setServerBuf] = useState<ServerBuffer<T>>(freshBuffer<T>);
  const bufRef = useRef(serverBuf);

  // 客户端模式：仅记已揭示条数（纯派生，无网络）。
  const clientItems = isClient ? (fetcher as ClientFetcher<T>).items : EMPTY;
  const [loadedCount, setLoadedCount] = useState(pageSize);

  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // 最新值 ref，供异步循环/回调读取，规避闭包陈旧（在 effect 内同步，对齐 useHeartbeatPoll）。
  const fetcherRef = useRef(fetcher);
  const filtersRef = useRef(filters);
  useEffect(() => {
    fetcherRef.current = fetcher;
    filtersRef.current = filters;
  });

  const filterKey = useMemo(
    () => JSON.stringify({ f: filters ?? null, d: deps ?? null }),
    [filters, deps],
  );

  // ── 服务端：确保连续前缀覆盖 targetCount 条 ────────────────────────────
  // fromScratch：从头重载（cursor=null）至 targetCount，期间不清空旧 buffer，
  // 最终一次性原子替换——供 refresh() 实时刷新而不闪空。
  const ensureLoaded = useCallback(
    async (targetCount: number, isAppend: boolean, fromScratch = false) => {
      if (loadingRef.current) return;
      const buf = bufRef.current;
      if (!fromScratch && (buf.items.length >= targetCount || !buf.hasMore)) return;

      loadingRef.current = true;
      const reqId = ++reqIdRef.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      if (isAppend) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      let acc: T[] = fromScratch ? [] : buf.items;
      let cursor: string | number | null = fromScratch ? null : buf.cursor;
      let hasMore: boolean = fromScratch ? true : buf.hasMore;
      let total: number | null = fromScratch ? null : buf.total;
      let rounds = 0;
      try {
        const f = fetcherRef.current;
        while (acc.length < targetCount && hasMore && rounds < maxSequentialFetch) {
          if (reqId !== reqIdRef.current) return; // 过期
          if (f.kind === "offset") {
            const need = targetCount - acc.length;
            const limit = Math.min(need, f.maxLimit ?? 200);
            const r = await f.fetchRange({
              offset: acc.length,
              limit,
              filters: filtersRef.current as F,
              signal: ac.signal,
            });
            acc = acc.concat(r.items);
            total = r.total;
            hasMore = acc.length < r.total && r.items.length > 0;
          } else if (f.kind === "cursor") {
            const r = await f.fetchPage({
              cursor,
              limit: pageSize,
              filters: filtersRef.current as F,
              signal: ac.signal,
            });
            acc = acc.concat(r.items);
            cursor = r.nextCursor;
            hasMore = r.hasMore;
            if (r.total != null) total = r.total;
          } else {
            break; // client 模式不走此路径
          }
          rounds += 1;
        }
        if (reqId !== reqIdRef.current) return;
        const next: ServerBuffer<T> = { items: acc, cursor, hasMore, total };
        bufRef.current = next;
        setServerBuf(next);
      } catch (e) {
        if (reqId !== reqIdRef.current) return;
        if ((e as { name?: string })?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (reqId === reqIdRef.current) {
          loadingRef.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [pageSize, maxSequentialFetch],
  );

  // ── reset：清缓冲、回第 1 页、并触发首页加载 ─────────────────────────────
  const reset = useCallback(() => {
    reqIdRef.current += 1; // 作废在途
    abortRef.current?.abort();
    loadingRef.current = false;
    const fresh = freshBuffer<T>();
    bufRef.current = fresh;
    setServerBuf(fresh);
    setLoadedCount(pageSize);
    setCurrentPage(1);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
  }, [pageSize]);

  // filters/deps/enabled 变化 → reset + 拉首页（服务端模式）。
  useEffect(() => {
    if (!enabled) return;
    reset();
    if (!isClient) void ensureLoaded(pageSize, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, enabled, isClient, pageSize]);

  // ── 对外动作 ───────────────────────────────────────────────────────────
  const goToPage = useCallback(
    (page: number) => {
      const target = Math.max(1, page);
      setCurrentPage(target);
      if (isClient) {
        setLoadedCount((c) => Math.max(c, target * pageSize));
      } else {
        void ensureLoaded(target * pageSize, false);
      }
    },
    [isClient, pageSize, ensureLoaded],
  );

  const loadMore = useCallback(() => {
    if (isClient) {
      setLoadedCount((c) => c + pageSize);
    } else {
      void ensureLoaded(bufRef.current.items.length + pageSize, true);
    }
  }, [isClient, pageSize, ensureLoaded]);

  const refresh = useCallback(() => {
    if (isClient) return; // 客户端数据由调用方持有，无需重拉
    // 从头重载当前已加载范围，不清空旧 buffer（避免实时刷新闪空），最终原子替换。
    const keep = Math.max(pageSize, bufRef.current.items.length);
    void ensureLoaded(keep, false, true);
  }, [isClient, pageSize, ensureLoaded]);

  // ── 派生返回值 ─────────────────────────────────────────────────────────
  const clientLen = clientItems.length;
  return useMemo<UseInfiniteListResult<T>>(() => {
    if (isClient) {
      const safeCount = Math.min(loadedCount, clientLen);
      const items = clientItems.slice(0, safeCount);
      const totalPages = Math.max(1, Math.ceil(clientLen / pageSize));
      return {
        items,
        currentPage: Math.min(currentPage, totalPages),
        total: clientLen,
        totalPages,
        loadedPages: Math.ceil(safeCount / pageSize) || 1,
        goToPage,
        loadMore,
        reset,
        refresh,
        loading: false,
        loadingMore: false,
        hasMore: safeCount < clientLen,
        error: null,
      };
    }
    const buf = serverBuf;
    const total = buf.total;
    const loadedPages = Math.ceil(buf.items.length / pageSize);
    const totalPages =
      total != null
        ? Math.max(1, Math.ceil(total / pageSize))
        : Math.max(1, loadedPages + (buf.hasMore ? 1 : 0));
    const hasMore = total != null ? buf.items.length < total : buf.hasMore;
    return {
      items: buf.items,
      currentPage: Math.min(currentPage, totalPages),
      total,
      totalPages,
      loadedPages,
      goToPage,
      loadMore,
      reset,
      refresh,
      loading,
      loadingMore,
      hasMore,
      error,
    };
  }, [
    isClient,
    clientItems,
    clientLen,
    loadedCount,
    serverBuf,
    currentPage,
    loading,
    loadingMore,
    error,
    pageSize,
    goToPage,
    loadMore,
    reset,
    refresh,
  ]);
}

const EMPTY: never[] = [];
