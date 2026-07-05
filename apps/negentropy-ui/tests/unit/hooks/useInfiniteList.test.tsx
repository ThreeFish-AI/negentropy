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
