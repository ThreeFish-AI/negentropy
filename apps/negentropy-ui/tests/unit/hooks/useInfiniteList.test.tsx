import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useInfiniteList,
  type CursorFetcher,
  type OffsetFetcher,
} from "@/hooks/useInfiniteList";

/**
 * useInfiniteList hook 单测。
 *
 * 覆盖三态取数（client/cursor/offset）+ totalPages 退化 + safePage 钳制 +
 * 连续前缀缓冲 + goToPage 顺序补齐/单请求补缺 + filters 变化 reset。
 */

interface Row {
  id: string;
}

function makeRows(from: number, count: number, cap?: number): Row[] {
  const n = cap != null ? Math.min(count, Math.max(0, cap - from)) : count;
  return Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useInfiniteList — client 模式", () => {
  it("渐进切片：初始一页、loadMore 揭示更多、total 精确、hasMore 收敛", async () => {
    const items = makeRows(0, 25);
    const { result } = renderHook(() => useInfiniteList<Row>({ fetcher: { kind: "client", items }, pageSize: 10 }));

    await waitFor(() => expect(result.current.items.length).toBe(10));
    expect(result.current.total).toBe(25);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.currentPage).toBe(1);

    act(() => result.current.loadMore());
    expect(result.current.items.length).toBe(20);
    act(() => result.current.loadMore());
    expect(result.current.items.length).toBe(25);
    expect(result.current.hasMore).toBe(false);
  });

  it("goToPage 揭示到目标页且 currentPage 钳制在 totalPages 内", async () => {
    const items = makeRows(0, 25);
    const { result } = renderHook(() => useInfiniteList<Row>({ fetcher: { kind: "client", items }, pageSize: 10 }));
    await waitFor(() => expect(result.current.items.length).toBe(10));

    act(() => result.current.goToPage(99));
    expect(result.current.items.length).toBe(25);
    expect(result.current.currentPage).toBe(3); // min(99, totalPages=3)
  });
});

describe("useInfiniteList — cursor 模式", () => {
  function cursorFetcher(): { fetcher: CursorFetcher<Row>; spy: ReturnType<typeof vi.fn> } {
    const spy = vi
      .fn()
      .mockResolvedValueOnce({ items: makeRows(0, 10), nextCursor: "c1", hasMore: true, total: 25 })
      .mockResolvedValueOnce({ items: makeRows(10, 10), nextCursor: "c2", hasMore: true, total: 25 })
      .mockResolvedValueOnce({ items: makeRows(20, 5), nextCursor: null, hasMore: false, total: 25 });
    return { fetcher: { kind: "cursor", fetchPage: spy }, spy };
  }

  it("首屏拉第一页、loadMore 前向追加、cursor 串接、hasMore 终止", async () => {
    const { fetcher, spy } = cursorFetcher();
    const { result } = renderHook(() => useInfiniteList<Row>({ fetcher, pageSize: 10 }));

    await waitFor(() => expect(result.current.items.length).toBe(10));
    expect(spy).toHaveBeenNthCalledWith(1, expect.objectContaining({ cursor: null, limit: 10 }));
    expect(result.current.total).toBe(25);
    expect(result.current.totalPages).toBe(3);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items.length).toBe(20));
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: "c1" }));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items.length).toBe(25));
    expect(result.current.hasMore).toBe(false);
  });

  it("goToPage 远端跳页前向顺序补齐至目标页", async () => {
    const { fetcher, spy } = cursorFetcher();
    const { result } = renderHook(() => useInfiniteList<Row>({ fetcher, pageSize: 10 }));
    await waitFor(() => expect(result.current.items.length).toBe(10));

    act(() => result.current.goToPage(3));
    await waitFor(() => expect(result.current.items.length).toBe(25));
    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.current.currentPage).toBe(3);
    expect(result.current.hasMore).toBe(false);
  });

  it("深跳页分批补齐：maxLimit 生效、单轮 limit=min(缺口,maxLimit)、目标页非空（回归越界空页 Bug）", async () => {
    // 模拟后端游标端点：cursor=起始 index（"c<n>" 或 null），每轮返回 min(缺口, limit) 条，
    // total=213（对齐 Bug 场景：22 页、每页 10）。maxLimit=100 → 跳第 22 页(220 条)应 ⌈220/100⌉=3 轮。
    const TOTAL = 213;
    const calls: { cursor: string | number | null; limit: number }[] = [];
    const spy = vi.fn(
      async ({ cursor, limit }: { cursor: string | number | null; limit: number }) => {
        calls.push({ cursor, limit });
        const start = cursor == null ? 0 : Number(cursor);
        const items = makeRows(start, limit, TOTAL);
        const nextStart = start + items.length;
        return {
          items,
          nextCursor: nextStart < TOTAL ? String(nextStart) : null,
          hasMore: nextStart < TOTAL,
          total: TOTAL,
        };
      },
    );
    const fetcher: CursorFetcher<Row> = { kind: "cursor", fetchPage: spy, maxLimit: 100 };
    const { result } = renderHook(() => useInfiniteList<Row>({ fetcher, pageSize: 10 }));

    await waitFor(() => expect(result.current.items.length).toBe(10));
    expect(result.current.totalPages).toBe(22);
    // 首屏单轮 limit 恒 = pageSize（缺口=10 < maxLimit）。
    expect(calls[0]).toEqual({ cursor: null, limit: 10 });

    act(() => result.current.goToPage(22));
    // 分批补齐至全量 213 条（旧实现受 20×10=200 封顶 → 第 22 页 slice(210,220) 空）。
    await waitFor(() => expect(result.current.items.length).toBe(TOTAL));

    // 第 22 页切片非空（Bug 修复核心断言）：213 条下末页 = slice(210,220) = 索引 210/211/212 共 3 条。
    const start = (result.current.currentPage - 1) * 10;
    expect(result.current.items.slice(start, start + 10).length).toBe(TOTAL - start);
    expect(result.current.items.slice(start, start + 10).length).toBeGreaterThan(0);
    expect(result.current.currentPage).toBe(22);

    // 补齐轮次远少于 22（分批）：首屏 1 轮(10) + 跳页 ⌈203/100⌉=3 轮 → 总计 ≤ 5 轮。
    expect(spy.mock.calls.length).toBeLessThanOrEqual(5);
    // 跳页阶段任一轮 limit 不超过 maxLimit。
    for (const c of calls) expect(c.limit).toBeLessThanOrEqual(100);
  });

  it("loadMore 分批下仍每轮恰好追加一页（缺口=pageSize < maxLimit）", async () => {
    const { fetcher, spy } = cursorFetcher();
    const { result } = renderHook(() => useInfiniteList<Row>({ fetcher, pageSize: 10 }));
    await waitFor(() => expect(result.current.items.length).toBe(10));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items.length).toBe(20));
    // loadMore 目标 = 当前长度 + pageSize，缺口恒 = 10，故 limit=min(10, 200)=10。
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: "c1", limit: 10 }));
  });

  it("游标耗尽而缓冲不足以填充当前页时，currentPage 同步收敛到实际已加载页（safePage 兜底）", async () => {
    // total 声称 50（5 页）但游标实际只产出 12 条后即 hasMore=false（COUNT 与取数间发生删除的极端）。
    const spy = vi
      .fn()
      .mockResolvedValueOnce({ items: makeRows(0, 10), nextCursor: "c1", hasMore: true, total: 50 })
      .mockResolvedValueOnce({ items: makeRows(10, 2), nextCursor: null, hasMore: false, total: 50 });
    const fetcher: CursorFetcher<Row> = { kind: "cursor", fetchPage: spy };
    const { result } = renderHook(() => useInfiniteList<Row>({ fetcher, pageSize: 10 }));
    await waitFor(() => expect(result.current.items.length).toBe(10));
    expect(result.current.totalPages).toBe(5); // 由 total=50 派生

    act(() => result.current.goToPage(5));
    await waitFor(() => expect(result.current.items.length).toBe(12));
    // 游标已耗尽（hasMore=false），仅 12 条 = 2 页；currentPage 收敛到 2，不停留在空的第 5 页。
    expect(result.current.currentPage).toBe(2);
  });

  it("total 缺失时 totalPages 退化为已加载页数 + hasMore 兜底", async () => {
    const spy = vi.fn().mockResolvedValue({ items: makeRows(0, 10), nextCursor: "c1", hasMore: true, total: null });
    const { result } = renderHook(() =>
      useInfiniteList<Row>({ fetcher: { kind: "cursor", fetchPage: spy }, pageSize: 10 }),
    );
    await waitFor(() => expect(result.current.items.length).toBe(10));
    expect(result.current.total).toBeNull();
    expect(result.current.totalPages).toBe(2); // loadedPages(1) + hasMore(1)
  });

  it("filters 变化触发 reset 并重拉第一页", async () => {
    const spy = vi.fn().mockResolvedValue({ items: makeRows(0, 10), nextCursor: "c1", hasMore: true, total: 25 });
    const fetcher: CursorFetcher<Row, { q: string }> = { kind: "cursor", fetchPage: spy };
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useInfiniteList<Row, { q: string }>({ fetcher, pageSize: 10, filters: { q } }),
      { initialProps: { q: "a" } },
    );
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    rerender({ q: "b" });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: null, filters: { q: "b" } }));
    expect(result.current.currentPage).toBe(1);
  });
});

describe("useInfiniteList — offset 模式", () => {
  it("跳页用单请求补齐缺口（offset+大 limit），total 精确、hasMore 收敛", async () => {
    const spy = vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => ({
      items: makeRows(offset, limit, 25),
      total: 25,
    }));
    const fetcher: OffsetFetcher<Row> = { kind: "offset", fetchRange: spy, maxLimit: 200 };
    const { result } = renderHook(() => useInfiniteList<Row>({ fetcher, pageSize: 10 }));

    await waitFor(() => expect(result.current.items.length).toBe(10));
    expect(spy).toHaveBeenNthCalledWith(1, expect.objectContaining({ offset: 0, limit: 10 }));

    act(() => result.current.goToPage(3));
    await waitFor(() => expect(result.current.items.length).toBe(25));
    // 第二次单请求补齐 offset=10、limit=20，一次落地至总数。
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ offset: 10, limit: 20 }));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.total).toBe(25);
  });
});
