import {
  buildExtractorRoutesFromDraft,
  buildCorpusConfig,
  createEmptyExtractorDraftTarget,
  createDefaultChunkingConfig,
  fetchCorpus,
  fetchDocumentChunks,
  fetchDocuments,
  ingestFile,
  ingestText,
  KnowledgeError,
  normalizeExtractorDraftRoutes,
  normalizeCorpusExtractorRoutes,
} from "@/features/knowledge/utils/knowledge-api";
import {
  createKnowledgeApiExtractorRoutes,
  createKnowledgeApiExtractorRouteTarget,
  knowledgeApiExtractorRouteFixtures,
} from "@/tests/helpers/knowledge-api";

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
      new Response(JSON.stringify({ run_id: "run-file-1", status: "running", message: "queued" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      ingestFile("corpus-1", {
      file: new File(["hello"], "a.txt", { type: "text/plain" }),
      chunking_config: createDefaultChunkingConfig("hierarchical"),
      }),
    ).resolves.toEqual({
      run_id: "run-file-1",
      status: "running",
      message: "queued",
    });

    const [, init] = fetchSpy.mock.calls[0];
    const formData = init?.body as FormData;

    expect(formData.get("strategy")).toBe("hierarchical");
    expect(formData.get("hierarchical_parent_chunk_size")).toBe("1024");
    expect(formData.get("hierarchical_child_chunk_size")).toBe("256");
    expect(formData.get("hierarchical_child_overlap")).toBe("51");
  });

  it("normalizeCorpusExtractorRoutes 与 buildCorpusConfig 会稳定保留 extractor routes 结构", () => {
    const normalized = normalizeCorpusExtractorRoutes(
      createKnowledgeApiExtractorRoutes([knowledgeApiExtractorRouteFixtures.defaultUrlTarget]),
    );

    expect(normalized.url.targets).toEqual([
      expect.objectContaining({
        server_id: "server-1",
        tool_name: "fetch_markdown",
        priority: 0,
        enabled: true,
      }),
    ]);
    expect(normalized.file_pdf.targets).toEqual([]);

    expect(
      buildCorpusConfig(createDefaultChunkingConfig(), normalized),
    ).toMatchObject({
      extractor_routes: {
        url: {
          targets: [
            expect.objectContaining({
              server_id: "server-1",
              tool_name: "fetch_markdown",
            }),
          ],
        },
        file_pdf: { targets: [] },
      },
    });
  });

  it("normalizeExtractorDraftRoutes 会为每个 route 生成固定双槽位 draft", () => {
    const draft = normalizeExtractorDraftRoutes(
      createKnowledgeApiExtractorRoutes([knowledgeApiExtractorRouteFixtures.defaultUrlTarget]),
    );

    expect(draft.url).toEqual([
      expect.objectContaining({
        server_id: "server-1",
        tool_name: "fetch_markdown",
        priority: 0,
        enabled: true,
      }),
      expect.objectContaining({
        server_id: "",
        tool_name: "",
        priority: 1,
        enabled: true,
      }),
    ]);
    expect(draft.file_pdf).toEqual([
      expect.objectContaining({
        server_id: "",
        tool_name: "",
        priority: 0,
        enabled: true,
      }),
      expect.objectContaining({
        server_id: "",
        tool_name: "",
        priority: 1,
        enabled: true,
      }),
    ]);
  });

  it("buildExtractorRoutesFromDraft 会过滤不完整槽位并重排 priority", () => {
    const routes = buildExtractorRoutesFromDraft({
      url: [
        {
          server_id: "",
          tool_name: "",
          priority: 0,
          enabled: true,
        },
        {
          ...createKnowledgeApiExtractorRouteTarget({
            server_id: "server-2",
            tool_name: "parse_pdf",
            priority: 1,
          }),
        },
      ],
      file_pdf: [
        createKnowledgeApiExtractorRouteTarget({
          server_id: "server-3",
          tool_name: "extract_pdf",
        }),
        createEmptyExtractorDraftTarget(1),
      ],
    });

    expect(routes).toEqual({
      url: {
        targets: [
          expect.objectContaining({
            server_id: "server-2",
            tool_name: "parse_pdf",
            priority: 0,
            enabled: true,
          }),
        ],
      },
      file_pdf: {
        targets: [
          expect.objectContaining({
            server_id: "server-3",
            tool_name: "extract_pdf",
            priority: 0,
            enabled: true,
          }),
        ],
      },
    });
  });

  it("normalizeExtractorDraftRoutes 会保留 timeout_ms 与 tool_options 等扩展字段", () => {
    const draft = normalizeExtractorDraftRoutes(
      createKnowledgeApiExtractorRoutes([knowledgeApiExtractorRouteFixtures.advancedUrlTarget]),
    );

    expect(draft.url[0]).toEqual(
      expect.objectContaining({
        server_id: "server-advanced",
        tool_name: "fetch_structured",
        priority: 0,
        enabled: true,
        timeout_ms: 15000,
        tool_options: {
          mode: "markdown",
          include_images: true,
        },
      }),
    );
  });

  it("buildExtractorRoutesFromDraft 会稳定处理 url 与 file_pdf 双 route", () => {
    const routes = buildExtractorRoutesFromDraft({
      url: [
        knowledgeApiExtractorRouteFixtures.dualUrlPrimaryTarget,
        createEmptyExtractorDraftTarget(1),
      ],
      file_pdf: [
        knowledgeApiExtractorRouteFixtures.dualPdfPrimaryTarget,
        knowledgeApiExtractorRouteFixtures.dualPdfBackupTarget,
      ],
    });

    expect(routes).toEqual({
      url: {
        targets: [
          expect.objectContaining({
            server_id: "server-url-primary",
            tool_name: "fetch_markdown",
            priority: 0,
            enabled: true,
            timeout_ms: 12000,
            tool_options: { format: "md" },
          }),
        ],
      },
      file_pdf: {
        targets: [
          expect.objectContaining({
            server_id: "server-pdf-primary",
            tool_name: "parse_pdf",
            priority: 0,
            enabled: true,
            timeout_ms: 20000,
            tool_options: { ocr: false },
          }),
          expect.objectContaining({
            server_id: "server-pdf-backup",
            tool_name: "parse_pdf_backup",
            priority: 1,
            enabled: true,
            timeout_ms: 25000,
            tool_options: { ocr: true },
          }),
        ],
      },
    });
  });
});
