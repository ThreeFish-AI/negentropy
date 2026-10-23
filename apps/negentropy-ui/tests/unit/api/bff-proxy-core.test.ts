/**
 * BFF 代理统一核心（app/api/_lib/proxy.ts）三域绑定行为契约测试
 *
 * 三域 `_proxy.ts` 收敛为薄绑定层后，本文件锁定域配置差异与能力并集的关键行为：
 *   - Interface 域保守无默认超时（MCP tools:execute 后端操作超时上限 120s）；
 *     Memory / Knowledge 域默认 30s；调用方可显式传 timeoutMs 覆盖。
 *   - Interface proxyPost 保留上游成功状态码（如 201）——域内既有契约。
 *   - 上游错误 body 为 JSON object 时原样透传（Memory 域为收敛新增能力）。
 *   - 非 JSON 成功 body 安全降级为 {data}（Memory 域既有契约，族内统一）。
 *   - 204 短路返回空 body（DELETE 既有契约，族内统一）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxyGet as interfaceGet, proxyPost as interfacePost } from "@/app/api/interface/_proxy";
import { proxyDelete as memoryDelete, proxyGet as memoryGet } from "@/app/api/memory/_proxy";
import { proxyGet as knowledgeGet } from "@/app/api/knowledge/_proxy";

vi.mock("@/lib/sso", () => ({
  buildAuthHeaders: () => new Headers(),
}));

vi.mock("@/lib/server/backend-url", () => ({
  getKnowledgeBaseUrl: () => "http://knowledge.test",
  getAguiBaseUrl: () => "http://agui.test",
  getMemoryBaseUrl: () => "http://memory.test",
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRequest(url = "http://localhost/api/x"): Request {
  return new Request(url, { method: "GET" });
}

describe("BFF proxy 统一核心：域超时配置", () => {
  it("interface 域默认不设超时（fetch init.signal 为 undefined）", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await interfaceGet(makeRequest("http://localhost/api/interface/tools"), "/interface/tools");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeUndefined();
  });

  it("interface 域显式传 timeoutMs 时生效", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await interfacePost(
      new Request("http://localhost/api/interface/tools", { method: "POST" }),
      "/interface/tools",
      { timeoutMs: 5_000 },
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("memory 域默认 30s 超时（行为增强：原无超时）", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    await memoryGet(makeRequest("http://localhost/api/memory/facts"), "/memory/facts");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("knowledge 域默认 30s 超时（域内既有契约）", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    await knowledgeGet(makeRequest("http://localhost/api/knowledge/base"), "/knowledge/base");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("BFF proxy 统一核心：成功/错误收尾契约", () => {
  it("interface proxyPost 保留上游成功状态码（201）", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "t1" }), { status: 201 }),
    );
    const res = await interfacePost(
      new Request("http://localhost/api/interface/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "t" }),
      }),
      "/interface/tools",
    );
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: "t1" });
  });

  it("上游错误 body 为 JSON object 时原样透传（memory 域新增能力）", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "fact not found" }), { status: 404 }),
    );
    const res = await memoryGet(makeRequest("http://localhost/api/memory/facts/f1"), "/memory/facts/f1");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ detail: "fact not found" });
  });

  it("上游错误 body 非 JSON 时包装为域前缀错误信封", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 502 }));
    const res = await memoryGet(makeRequest("http://localhost/api/memory/facts"), "/memory/facts");
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("MEMORY_UPSTREAM_ERROR");
    expect(json.error.message).toBe("oops");
  });

  it("非 JSON 成功 body 安全降级为 {data}（memory 域既有契约）", async () => {
    fetchMock.mockResolvedValueOnce(new Response("plain-text", { status: 200 }));
    const res = await memoryGet(makeRequest("http://localhost/api/memory/health"), "/memory/health");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: "plain-text" });
  });

  it("204 短路返回空 body（族内统一）", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await memoryDelete(
      makeRequest("http://localhost/api/memory/core-blocks?id=x"),
      "/memory/core-blocks",
    );
    expect(res.status).toBe(204);
    await expect(res.text()).resolves.toBe("");
  });
});
