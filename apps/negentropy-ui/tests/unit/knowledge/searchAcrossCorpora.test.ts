import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KnowledgeError,
  searchAcrossCorpora,
} from "@/features/knowledge/utils/knowledge-api";

const buildOkResponse = (items: unknown[]) =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ count: items.length, items }),
    text: async () => JSON.stringify({ count: items.length, items }),
    clone() {
      return this;
    },
  }) as unknown as Response;

const buildErrorResponse = (status: number, code: string, message: string) =>
  ({
    ok: false,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ code, message }),
    text: async () => JSON.stringify({ code, message }),
    clone() {
      return this;
    },
  }) as unknown as Response;

describe("searchAcrossCorpora — 聚合三态", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("全部 fulfilled → 合并结果且不附 errors", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        buildOkResponse([
          {
            id: "k1",
            content: "a",
            source_uri: "u1",
            metadata: {},
            combined_score: 0.9,
          },
        ]),
      )
      .mockResolvedValueOnce(
        buildOkResponse([
          {
            id: "k2",
            content: "b",
            source_uri: "u2",
            metadata: {},
            combined_score: 0.7,
          },
        ]),
      );

    const res = await searchAcrossCorpora(["c-1111", "c-2222"], {
      query: "harness",
      mode: "hybrid",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.count).toBe(2);
    expect(res.items.map((i) => i.id)).toEqual(["k1", "k2"]);
    expect(res.errors).toBeUndefined();
  });

  it("部分 rejected → 返回成功项 + errors[] 暴露失败原因", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        buildOkResponse([
          {
            id: "k1",
            content: "a",
            source_uri: "u1",
            metadata: {},
            combined_score: 0.9,
          },
        ]),
      )
      .mockResolvedValueOnce(
        buildErrorResponse(502, "EMBEDDING_FAILED", "upstream gemini 400"),
      );

    const res = await searchAcrossCorpora(["c-1111", "c-2222"], {
      query: "harness",
      mode: "hybrid",
    });

    expect(res.count).toBe(1);
    expect(res.items[0].id).toBe("k1");
    expect(res.errors).toBeDefined();
    expect(res.errors).toHaveLength(1);
    expect(res.errors?.[0].corpusId).toBe("c-2222");
    expect(res.errors?.[0].message).toContain("upstream gemini 400");
    // 保留后端结构化 code，便于调用方按上游 vs 自身错误分流
    expect(res.errors?.[0].code).toBe("EMBEDDING_FAILED");
  });

  it("全部 rejected 且 code 一致 → 抛 KnowledgeError 并保留原 code", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        buildErrorResponse(502, "EMBEDDING_FAILED", "upstream gemini 400"),
      )
      .mockResolvedValueOnce(
        buildErrorResponse(503, "EMBEDDING_FAILED", "upstream gemini 503"),
      );

    const promise = searchAcrossCorpora(["c-1111", "c-2222"], {
      query: "harness",
      mode: "hybrid",
    });

    await expect(promise).rejects.toBeInstanceOf(KnowledgeError);
    await expect(promise).rejects.toMatchObject({
      code: "EMBEDDING_FAILED",
      message: expect.stringMatching(/upstream gemini/),
    });
  });

  it("全部 rejected 但 code 混合 → 聚合 code 退化为 AGGREGATED_SEARCH_ERRORS", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        buildErrorResponse(502, "EMBEDDING_FAILED", "upstream gemini 400"),
      )
      .mockResolvedValueOnce(
        buildErrorResponse(500, "SEARCH_ERROR", "internal failure"),
      );

    const promise = searchAcrossCorpora(["c-1111", "c-2222"], {
      query: "harness",
      mode: "hybrid",
    });

    await expect(promise).rejects.toMatchObject({
      code: "AGGREGATED_SEARCH_ERRORS",
    });
  });
});
