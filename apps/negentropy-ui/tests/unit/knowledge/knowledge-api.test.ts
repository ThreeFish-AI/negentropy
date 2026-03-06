import {
  fetchCorpus,
  fetchDocumentChunks,
  fetchDocuments,
  KnowledgeError,
} from "@/features/knowledge/utils/knowledge-api";

describe("fetchCorpus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("在 404 时返回 null", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" }),
    );

    await expect(fetchCorpus("missing-id", "negentropy")).resolves.toBeNull();
  });

  it("在 422 时透传结构化错误而不是仅使用 statusText", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            code: "INVALID_CORPUS_ID",
            message: "Corpus id is not a valid UUID",
          },
        }),
        {
          status: 422,
          statusText: "Unprocessable Entity",
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(fetchCorpus("bad-id", "negentropy")).rejects.toMatchObject({
      code: "INVALID_CORPUS_ID",
      message: "Corpus id is not a valid UUID",
    } satisfies Partial<KnowledgeError>);
  });

  it("fetchDocuments 会把超限 limit 截断到 100", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 0, items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchDocuments("corpus-1", {
      appName: "negentropy",
      limit: 200,
      offset: 0,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/knowledge/base/corpus-1/documents?app_name=negentropy&limit=100",
      { cache: "no-store" },
    );
  });

  it("fetchDocumentChunks 会把超限 limit 截断到 200", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 0, items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchDocumentChunks("corpus-1", "doc-1", {
      appName: "negentropy",
      limit: 500,
      offset: 0,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/knowledge/base/corpus-1/documents/doc-1/chunks?app_name=negentropy&limit=200&offset=0",
      { cache: "no-store" },
    );
  });
});
