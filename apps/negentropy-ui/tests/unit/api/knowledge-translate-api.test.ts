/**
 * translateDocuments API 客户端单测 — 请求 payload 契约与错误处理。
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { translateDocuments } from "@/features/knowledge";

const OK_RESPONSE = {
  accepted: ["doc-1"],
  skipped: [{ document_id: "doc-2", reason: "markdown_not_ready" }],
  status: "running",
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("translateDocuments", () => {
  it("POST /api/knowledge/documents/translate 携带完整 payload", async () => {
    const fetchMock = mockFetchOnce(OK_RESPONSE);

    const result = await translateDocuments(["doc-1", "doc-2"], {
      appName: "negentropy",
      targetLanguage: "zh",
      force: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/knowledge/documents/translate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      document_ids: ["doc-1", "doc-2"],
      app_name: "negentropy",
      target_language: "zh",
      force: true,
    });
    expect(result).toEqual(OK_RESPONSE);
  });

  it("缺省参数：target_language=zh、force=false", async () => {
    const fetchMock = mockFetchOnce(OK_RESPONSE);

    await translateDocuments(["doc-1"]);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      document_ids: ["doc-1"],
      target_language: "zh",
      force: false,
    });
  });

  it("非 2xx 响应抛出错误", async () => {
    mockFetchOnce({ detail: { message: "boom" } }, false, 500);

    await expect(translateDocuments(["doc-1"])).rejects.toThrow();
  });
});
