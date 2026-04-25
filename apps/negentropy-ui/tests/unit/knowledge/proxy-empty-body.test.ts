/**
 * BFF proxyPost 空 body 容忍能力测试（FIX-B 回归锁定）
 *
 * 历史问题：proxyPost 早期实现强制 ``await request.json()``，对空 body 抛
 * SyntaxError → 400，导致 publish / unpublish / job-action 等无 body POST
 * 在前端按下按钮"无效"。本测试模拟 fetch 上游，断言：
 *   - 空 body 转发到上游时 body=undefined（不再附 ``application/json``）
 *   - 非空合法 JSON 原样转发并附 content-type
 *   - 非法 JSON 仍返回 400
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxyPost } from "@/app/api/knowledge/_proxy";

vi.mock("@/lib/sso", () => ({
  buildAuthHeaders: () => new Headers(),
}));

vi.mock("@/lib/server/backend-url", () => ({
  getKnowledgeBaseUrl: () => "http://upstream.test",
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRequest(body: string | null, contentType?: string): Request {
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  return new Request("http://localhost:3192/api/knowledge/wiki/publications/X/publish", {
    method: "POST",
    headers,
    body,
  });
}

describe("proxyPost empty body tolerance", () => {
  it("forwards no body when request body is empty", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await proxyPost(makeRequest(null), "/knowledge/wiki/publications/X/publish");
    expect(res.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBeNull();
  });

  it("forwards JSON body unchanged when present", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const payload = JSON.stringify({ catalog_node_ids: ["abc"] });
    const res = await proxyPost(
      makeRequest(payload, "application/json"),
      "/knowledge/wiki/publications/X/sync-from-catalog",
    );
    expect(res.status).toBe(200);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(payload);
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await proxyPost(
      makeRequest("<<not json>>", "application/json"),
      "/knowledge/wiki/publications/X/sync-from-catalog",
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("KNOWLEDGE_BAD_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
