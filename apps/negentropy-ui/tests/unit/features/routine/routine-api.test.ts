/**
 * Routine API 客户端单元测试
 *
 * 验证 ``features/routine/api.ts`` 对 BFF ``/api/routine/*`` 的请求构造与
 * 错误处理契约：路径拼接、查询参数、HTTP method、错误体透传。
 *
 * 遵循 AGENTS.md 原则：循证工程、反馈闭环。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  approveIteration,
  controlRoutine,
  createRoutine,
  deleteRoutine,
  fetchIterations,
  fetchKpis,
  fetchRoutineDetail,
  fetchRoutines,
  rejectIteration,
  updateRoutine,
} from "@/features/routine/api";

/** 构造一个成功的 JSON Response。 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** spy global.fetch；每次调用构造新 Response（body 流仅可读一次）。 */
function mockFetch(factory: () => Response) {
  return vi.spyOn(global, "fetch").mockImplementation(() => Promise.resolve(factory()));
}

/** 读取最近一次 fetch 调用的 URL + init。 */
function lastCall(spy: ReturnType<typeof mockFetch>): { url: string; init: RequestInit } {
  const call = spy.mock.calls[spy.mock.calls.length - 1];
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("routine api · 读取端点", () => {
  it("fetchKpis 命中 /api/routine/kpis", async () => {
    const spy = mockFetch(() => jsonResponse({ total: 0 }));
    await fetchKpis();
    expect(lastCall(spy).url).toBe("/api/routine/kpis");
  });

  it("fetchRoutines 无筛选时不带 query", async () => {
    const spy = mockFetch(() => jsonResponse({ items: [], next_cursor: null }));
    await fetchRoutines();
    expect(lastCall(spy).url).toBe("/api/routine");
  });

  it("fetchRoutines 透传 status + q 为查询参数", async () => {
    const spy = mockFetch(() => jsonResponse({ items: [], next_cursor: null }));
    await fetchRoutines({ status: "running", q: "demo" });
    const sp = new URL(lastCall(spy).url, "http://x").searchParams;
    expect(sp.get("status")).toBe("running");
    expect(sp.get("q")).toBe("demo");
  });

  it("fetchRoutineDetail 编码 id 并带上 recent", async () => {
    const spy = mockFetch(() => jsonResponse({ id: "a/b" }));
    await fetchRoutineDetail("a/b", 5);
    expect(lastCall(spy).url).toBe("/api/routine/a%2Fb?recent=5");
  });

  it("fetchIterations 拼接 limit + before_seq", async () => {
    const spy = mockFetch(() => jsonResponse({ items: [] }));
    await fetchIterations("rid", { limit: 10, before_seq: 3 });
    const url = new URL(lastCall(spy).url, "http://x");
    expect(url.pathname).toBe("/api/routine/rid/iterations");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("before_seq")).toBe("3");
  });

  it("fetchIterations 无参数时不带 query", async () => {
    const spy = mockFetch(() => jsonResponse({ items: [] }));
    await fetchIterations("rid");
    expect(lastCall(spy).url).toBe("/api/routine/rid/iterations");
  });
});

describe("routine api · 写入端点", () => {
  it("createRoutine 以 POST 提交请求体", async () => {
    const spy = mockFetch(() => jsonResponse({ id: "r1" }, 201));
    await createRoutine({ key: "k", title: "t", goal: "g", acceptance_criteria: "a" });
    const { url, init } = lastCall(spy);
    expect(url).toBe("/api/routine");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).key).toBe("k");
  });

  it("updateRoutine 以 PUT 命中带 id 的路径", async () => {
    const spy = mockFetch(() => jsonResponse({ id: "r1" }));
    await updateRoutine("r1", { title: "new" });
    const { url, init } = lastCall(spy);
    expect(url).toBe("/api/routine/r1");
    expect(init.method).toBe("PUT");
  });

  it("deleteRoutine 以 DELETE 命中带 id 的路径", async () => {
    const spy = mockFetch(() => jsonResponse({ ok: true, deleted_routine_id: "r1" }));
    await deleteRoutine("r1");
    const { url, init } = lastCall(spy);
    expect(url).toBe("/api/routine/r1");
    expect(init.method).toBe("DELETE");
  });

  it("controlRoutine 拼接 action 段并用 POST", async () => {
    const spy = mockFetch(() => jsonResponse({ id: "r1" }));
    await controlRoutine("r1", "start");
    const { url, init } = lastCall(spy);
    expect(url).toBe("/api/routine/r1/start");
    expect(init.method).toBe("POST");
  });

  it("approveIteration / rejectIteration 命中迭代审批路径", async () => {
    const spy = mockFetch(() => jsonResponse({ id: "it1" }));
    await approveIteration("r1", "it1");
    expect(lastCall(spy).url).toBe("/api/routine/r1/iterations/it1/approve");
    await rejectIteration("r1", "it1");
    expect(lastCall(spy).url).toBe("/api/routine/r1/iterations/it1/reject");
  });
});

describe("routine api · 错误处理", () => {
  it("非 2xx 且响应体为结构化 JSON 时抛出含 detail 的错误", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ detail: "boom" }), {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json" },
        }),
    );
    await expect(fetchKpis()).rejects.toThrow(/404/);
    await expect(fetchKpis()).rejects.toThrow(/boom/);
  });

  it("非 2xx 且响应体非 JSON 时回落到 statusText", async () => {
    // 注：源码先 res.json() 消费 body 流，catch 中的 res.text() 因 body 已读取而回落到空串，
    // 故错误信息以 statusText 兜底。此用例锁定该真实行为。
    mockFetch(() => new Response("server exploded", { status: 500, statusText: "Internal Server Error" }));
    await expect(fetchKpis()).rejects.toThrow(/500/);
    await expect(fetchKpis()).rejects.toThrow(/Internal Server Error/);
  });
});
