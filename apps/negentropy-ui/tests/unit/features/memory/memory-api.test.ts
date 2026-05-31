/**
 * Memory API 客户端单元测试（新增可观测性 / Core Blocks / Associations 端点）
 *
 * 验证 ``features/memory/utils/memory-api.ts`` 对 BFF ``/api/memory/*`` 的请求构造契约：
 * 路径拼接、查询参数、HTTP method、DELETE 走 query 且无 body、ID 编码。
 *
 * 遵循 AGENTS.md 原则：循证工程、反馈闭环。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteCoreBlock,
  fetchCoreBlocks,
  fetchMemoryAssociations,
  fetchMemoryHealth,
  fetchMemoryMetrics,
  upsertCoreBlock,
} from "@/features/memory";

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

describe("memory api · 可观测性端点", () => {
  it("fetchMemoryHealth 命中 /api/memory/health 且无 query", async () => {
    const spy = mockFetch(() => jsonResponse({ status: "healthy", checks: {} }));
    await fetchMemoryHealth();
    expect(lastCall(spy).url).toBe("/api/memory/health");
    expect(lastCall(spy).init.cache).toBe("no-store");
  });

  it("fetchMemoryMetrics 无参时不带 query", async () => {
    const spy = mockFetch(() => jsonResponse({ memory_total: 0 }));
    await fetchMemoryMetrics();
    expect(lastCall(spy).url).toBe("/api/memory/metrics");
  });

  it("fetchMemoryMetrics 透传 app_name / user_id", async () => {
    const spy = mockFetch(() => jsonResponse({ memory_total: 0 }));
    await fetchMemoryMetrics({ app_name: "negentropy", user_id: "u1" });
    const sp = new URL(lastCall(spy).url, "http://x").searchParams;
    expect(sp.get("app_name")).toBe("negentropy");
    expect(sp.get("user_id")).toBe("u1");
  });

  it("非 OK 响应抛错", async () => {
    mockFetch(() => jsonResponse({ detail: "forbidden" }, 403));
    await expect(fetchMemoryMetrics()).rejects.toThrow(/Failed to fetch memory metrics/);
  });
});

describe("memory api · Core Blocks", () => {
  it("fetchCoreBlocks 携带必填 user_id", async () => {
    const spy = mockFetch(() => jsonResponse({ count: 0, items: [] }));
    await fetchCoreBlocks({ user_id: "u1", app_name: "negentropy" });
    const { url } = lastCall(spy);
    const sp = new URL(url, "http://x").searchParams;
    expect(url.startsWith("/api/memory/core-blocks?")).toBe(true);
    expect(sp.get("user_id")).toBe("u1");
    expect(sp.get("app_name")).toBe("negentropy");
  });

  it("upsertCoreBlock 使用 POST + JSON body + Content-Type", async () => {
    const spy = mockFetch(() => jsonResponse({ id: "x", version: 1, truncated: false }));
    await upsertCoreBlock({
      user_id: "u1",
      label: "persona",
      content: "hello",
      scope: "user",
    });
    const { url, init } = lastCall(spy);
    expect(url).toBe("/api/memory/core-blocks");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      user_id: "u1",
      label: "persona",
      content: "hello",
    });
  });

  it("deleteCoreBlock 使用 DELETE，参数走 query 且无 body", async () => {
    const spy = mockFetch(() => jsonResponse({ status: "deleted" }));
    await deleteCoreBlock({
      user_id: "u1",
      scope: "user",
      label: "persona",
    });
    const { url, init } = lastCall(spy);
    const sp = new URL(url, "http://x").searchParams;
    expect(url.startsWith("/api/memory/core-blocks?")).toBe(true);
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(sp.get("user_id")).toBe("u1");
    expect(sp.get("scope")).toBe("user");
    expect(sp.get("label")).toBe("persona");
  });
});

describe("memory api · Associations", () => {
  it("fetchMemoryAssociations 编码 memoryId 并拼接 direction/limit", async () => {
    const spy = mockFetch(() => jsonResponse({ count: 0, items: [] }));
    await fetchMemoryAssociations("a/b", { direction: "both", limit: 50 });
    const { url } = lastCall(spy);
    expect(url.startsWith("/api/memory/a%2Fb/associations?")).toBe(true);
    const sp = new URL(url, "http://x").searchParams;
    expect(sp.get("direction")).toBe("both");
    expect(sp.get("limit")).toBe("50");
  });

  it("fetchMemoryAssociations 无参时不带 query", async () => {
    const spy = mockFetch(() => jsonResponse({ count: 0, items: [] }));
    await fetchMemoryAssociations("mem-1");
    expect(lastCall(spy).url).toBe("/api/memory/mem-1/associations");
  });
});
