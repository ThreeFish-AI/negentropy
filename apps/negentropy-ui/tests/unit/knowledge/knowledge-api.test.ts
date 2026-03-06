import {
  createDefaultChunkingConfig,
  fetchCorpus,
  fetchDocumentChunks,
  fetchDocuments,
  ingestFile,
  ingestText,
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

  it("ingestText 会透传 semantic 与 hierarchical 配置", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ run_id: "run-1", status: "running", message: "ok" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await ingestText("corpus-1", {
      text: "hello",
      chunking_config: {
        strategy: "hierarchical",
        preserve_newlines: true,
        separators: ["\n\n", "\n"],
        hierarchical_parent_chunk_size: 1024,
        hierarchical_child_chunk_size: 256,
        hierarchical_child_overlap: 51,
      },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/knowledge/base/corpus-1/ingest",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "hello",
          chunking_config: {
            strategy: "hierarchical",
            preserve_newlines: true,
            separators: ["\n\n", "\n"],
            hierarchical_parent_chunk_size: 1024,
            hierarchical_child_chunk_size: 256,
            hierarchical_child_overlap: 51,
          },
        }),
      }),
    );
  });

  it("ingestFile 会把层次分块字段写入 FormData", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 1, items: ["chunk-1"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await ingestFile("corpus-1", {
      file: new File(["hello"], "a.txt", { type: "text/plain" }),
      chunking_config: createDefaultChunkingConfig("hierarchical"),
    });

    const [, init] = fetchSpy.mock.calls[0];
    const formData = init?.body as FormData;

    expect(formData.get("strategy")).toBe("hierarchical");
    expect(formData.get("hierarchical_parent_chunk_size")).toBe("1024");
    expect(formData.get("hierarchical_child_chunk_size")).toBe("256");
    expect(formData.get("hierarchical_child_overlap")).toBe("51");
  });
});
