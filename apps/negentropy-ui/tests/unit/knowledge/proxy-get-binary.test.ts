/**
 * BFF proxyGetBinary：HTTP Range + 条件缓存透传测试。
 *
 * 锁定 PDF 预览渐进式渲染与缓存复用的代理层契约：
 *   - 向上游转发 Range / If-None-Match 等条件请求头；
 *   - 透传 206 + Content-Range / Accept-Ranges / Content-Length / ETag；
 *   - 304 在 `!ok` 分支前拦截，返回空 body + ETag（不被误包装成 JSON 错误）；
 *   - 416 带 Content-Range 原样透传；
 *   - 预览 inline 改写仍生效；下载（attachment）不变。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxyGetBinary } from "@/app/api/knowledge/_proxy";

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

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request(
    "http://localhost:3192/api/knowledge/base/c1/documents/d1/preview?app_name=negentropy",
    { method: "GET", headers: new Headers(headers) },
  );
}

const PATH = "/knowledge/base/c1/documents/d1/download";

describe("proxyGetBinary Range + 缓存透传", () => {
  it("向上游转发 Range / 条件请求头", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 206,
        headers: { "content-range": "bytes 0-2/100", "accept-ranges": "bytes" },
      }),
    );

    await proxyGetBinary(
      makeRequest({ Range: "bytes=0-2", "If-None-Match": '"abc"' }),
      PATH,
      { responseDisposition: "inline" },
    );

    const [, init] = fetchMock.mock.calls[0];
    const sent = init.headers as Headers;
    expect(sent.get("range")).toBe("bytes=0-2");
    expect(sent.get("if-none-match")).toBe('"abc"');
  });

  it("透传 206 + Content-Range / Accept-Ranges / Content-Length", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([9, 9, 9, 9]), {
        status: 206,
        headers: {
          "content-range": "bytes 0-3/5000",
          "accept-ranges": "bytes",
          "content-length": "4",
          "content-type": "application/pdf",
          etag: '"deadbeef"',
        },
      }),
    );

    const res = await proxyGetBinary(makeRequest({ Range: "bytes=0-3" }), PATH, {
      responseDisposition: "inline",
    });

    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-3/5000");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-length")).toBe("4");
    expect(res.headers.get("etag")).toBe('"deadbeef"');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([9, 9, 9, 9]));
  });

  it("304 拦截于 !ok 之前：返回空 body + 保留 ETag/Cache-Control", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 304,
        headers: { etag: '"abc"', "cache-control": "private, max-age=300, must-revalidate" },
      }),
    );

    const res = await proxyGetBinary(makeRequest({ "If-None-Match": '"abc"' }), PATH, {
      responseDisposition: "inline",
    });

    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe('"abc"');
    expect(res.headers.get("cache-control")).toBe("private, max-age=300, must-revalidate");
    expect(await res.text()).toBe("");
  });

  it("416 带 Content-Range 原样透传（不被包装成 JSON 错误）", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 416,
        headers: { "content-range": "bytes */5000" },
      }),
    );

    const res = await proxyGetBinary(makeRequest({ Range: "bytes=99999-" }), PATH, {
      responseDisposition: "inline",
    });

    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */5000");
  });

  it("预览 inline 改写：attachment → inline，并透传校验器头", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: {
          "content-disposition": "attachment; filename*=UTF-8''r.pdf",
          "content-type": "application/pdf",
          "accept-ranges": "bytes",
          "content-length": "1",
          etag: '"e1"',
        },
      }),
    );

    const res = await proxyGetBinary(makeRequest(), PATH, { responseDisposition: "inline" });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^inline/);
    expect(res.headers.get("content-disposition")).toContain("r.pdf");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("etag")).toBe('"e1"');
  });

  it("inline 兜底：octet-stream MIME 回退为 application/pdf", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    );

    const res = await proxyGetBinary(makeRequest(), PATH, { responseDisposition: "inline" });
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("下载（无 inline）：attachment 保持不变，并透传范围/缓存头", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2]), {
        status: 200,
        headers: {
          "content-disposition": "attachment; filename*=UTF-8''r.pdf",
          "content-type": "application/pdf",
          "accept-ranges": "bytes",
          etag: '"e2"',
        },
      }),
    );

    const res = await proxyGetBinary(makeRequest(), PATH);

    expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("etag")).toBe('"e2"');
  });
});
