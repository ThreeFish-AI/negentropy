import {
  buildExtractorRoutesFromDraft,
  buildCorpusConfig,
  createCatalogNode,
  deleteDocument,
  documentPreviewUrl,
  fetchDocumentDetail,
  importDocumentFile,
  isPdfDocument,
  importDocumentUrl,
  ingestDocument,
  refreshDocumentMarkdown,
  createEmptyExtractorDraftTarget,
  createDefaultChunkingConfig,
  encodeSeparatorsForDisplay,
  decodeSeparatorsFromInput,
  decodeLiteralEscapesIfNeeded,
  normalizeChunkingConfig,
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
      createKnowledgeApiExtractorRoutes(
        [knowledgeApiExtractorRouteFixtures.defaultUrlTarget],
        [],
        [knowledgeApiExtractorRouteFixtures.defaultMdTarget],
      ),
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
    expect(normalized.file_md.targets).toEqual([
      expect.objectContaining({
        server_id: "server-md",
        tool_name: "parse_markdown",
        priority: 0,
        enabled: true,
      }),
    ]);

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
        file_md: {
          targets: [
            expect.objectContaining({
              server_id: "server-md",
              tool_name: "parse_markdown",
            }),
          ],
        },
      },
    });
  });

  it("normalizeExtractorDraftRoutes 会为每个 route 生成固定双槽位 draft", () => {
    const draft = normalizeExtractorDraftRoutes(
      createKnowledgeApiExtractorRoutes(
        [knowledgeApiExtractorRouteFixtures.defaultUrlTarget],
        [],
        [knowledgeApiExtractorRouteFixtures.defaultMdTarget],
      ),
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
    expect(draft.file_md).toEqual([
      expect.objectContaining({
        server_id: "server-md",
        tool_name: "parse_markdown",
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
      file_md: [
        createKnowledgeApiExtractorRouteTarget({
          server_id: "server-md-1",
          tool_name: "parse_markdown",
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
      file_md: {
        targets: [
          expect.objectContaining({
            server_id: "server-md-1",
            tool_name: "parse_markdown",
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
      file_md: [createEmptyExtractorDraftTarget(0), createEmptyExtractorDraftTarget(1)],
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
      file_md: { targets: [] },
    });
  });
});

// ============================================================================
// createCatalogNode — 空 catalog_id 防御式校验
// ============================================================================

describe("createCatalogNode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("catalog_id 为空字符串时应抛错且不发起网络请求", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    await expect(
      createCatalogNode({
        catalog_id: "",
        name: "Root",
        slug: "root",
        node_type: "category",
      }),
    ).rejects.toThrow(/catalog_id is required/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("catalog_id 合法时应命中 /api/knowledge/catalogs/<id>/entries 且 body 不含 catalog_id", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "11111111-1111-1111-1111-111111111111",
          catalog_id: "22222222-2222-2222-2222-222222222222",
          name: "Root",
          slug: "root",
          node_type: "category",
          parent_id: null,
          sort_order: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await createCatalogNode({
      catalog_id: "22222222-2222-2222-2222-222222222222",
      name: "Root",
      slug: "root",
      node_type: "category",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe(
      "/api/knowledge/catalogs/22222222-2222-2222-2222-222222222222/entries",
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const parsedBody = JSON.parse((init?.body as string) ?? "{}");
    expect(parsedBody).toEqual({
      name: "Root",
      slug: "root",
      node_type: "category",
    });
    expect(parsedBody).not.toHaveProperty("catalog_id");
  });
});

// ============================================================================
// Separator Textarea 编解码
// ============================================================================

describe("encodeSeparatorsForDisplay", () => {
  it("将换行符编码为 \\n 文本", () => {
    expect(encodeSeparatorsForDisplay(["\n"])).toBe("\\n");
  });

  it("将双换行编码为 \\n\\n 文本", () => {
    expect(encodeSeparatorsForDisplay(["\n\n"])).toBe("\\n\\n");
  });

  it("将普通字符原样保留", () => {
    expect(encodeSeparatorsForDisplay(["。", ". "])).toBe("。\n. ");
  });

  it("将空字符串编码为 <empty> 标记", () => {
    expect(encodeSeparatorsForDisplay([""])).toBe("<empty>");
  });

  it("将反斜杠编码为双反斜杠", () => {
    expect(encodeSeparatorsForDisplay(["\\"])).toBe("\\\\");
  });

  it("正确编码含反斜杠+n 的字面量", () => {
    expect(encodeSeparatorsForDisplay(["\\n"])).toBe("\\\\n");
  });

  it("编码新默认值 [\\n] 为单行 \\n", () => {
    const defaults = createDefaultChunkingConfig("recursive");
    if (defaults.strategy === "recursive") {
      expect(encodeSeparatorsForDisplay(defaults.separators)).toBe("\\n");
    }
  });
});

describe("decodeSeparatorsFromInput", () => {
  it("将 \\n 文本解码为换行符", () => {
    expect(decodeSeparatorsFromInput("\\n")).toEqual(["\n"]);
  });

  it("将 \\n\\n 文本解码为双换行", () => {
    expect(decodeSeparatorsFromInput("\\n\\n")).toEqual(["\n\n"]);
  });

  it("将普通字符原样保留", () => {
    expect(decodeSeparatorsFromInput("。\n. ")).toEqual(["。", ". "]);
  });

  it("将 <empty> 标记解码为空字符串", () => {
    expect(decodeSeparatorsFromInput("<empty>")).toEqual([""]);
  });

  it("将双反斜杠解码为单反斜杠", () => {
    expect(decodeSeparatorsFromInput("\\\\")).toEqual(["\\"]);
  });

  it("过滤意外空行", () => {
    expect(decodeSeparatorsFromInput("\\n\n\n。")).toEqual(["\n", "。"]);
  });

  it("保留尾部空格（如 '. '）", () => {
    expect(decodeSeparatorsFromInput(". ")).toEqual([". "]);
  });
});

describe("separator encode/decode 往返一致性", () => {
  it("新默认值 [\\n] 往返一致", () => {
    const seps = ["\n"];
    expect(decodeSeparatorsFromInput(encodeSeparatorsForDisplay(seps))).toEqual(seps);
  });

  it("旧 12 元素默认值往返一致", () => {
    const oldDefaults = ["\n\n", "\n", "。", "！", "？", ". ", "! ", "? ", "；", ";", " ", ""];
    expect(decodeSeparatorsFromInput(encodeSeparatorsForDisplay(oldDefaults))).toEqual(oldDefaults);
  });

  it("含字面量反斜杠的 separator 往返一致", () => {
    const seps = ["\\n", "\\"];
    expect(decodeSeparatorsFromInput(encodeSeparatorsForDisplay(seps))).toEqual(seps);
  });

  it("混合特殊字符往返一致", () => {
    const seps = ["\n\n", "\t", "\r\n", "。", ""];
    expect(decodeSeparatorsFromInput(encodeSeparatorsForDisplay(seps))).toEqual(seps);
  });
});

describe("decodeLiteralEscapesIfNeeded", () => {
  it("将字面量 `\\n\\n`（4 字符）解码为真换行 `\\n\\n`（2 字符）", () => {
    expect(decodeLiteralEscapesIfNeeded("\\n\\n")).toBe("\n\n");
  });

  it("将字面量 `\\n` 解码为真换行 `\\n`", () => {
    expect(decodeLiteralEscapesIfNeeded("\\n")).toBe("\n");
  });

  it("已为真换行的输入原样返回（idempotent）", () => {
    expect(decodeLiteralEscapesIfNeeded("\n\n")).toBe("\n\n");
    expect(decodeLiteralEscapesIfNeeded("\n")).toBe("\n");
  });

  it("对纯文本不做任何处理", () => {
    expect(decodeLiteralEscapesIfNeeded("。")).toBe("。");
    expect(decodeLiteralEscapesIfNeeded(". ")).toBe(". ");
  });

  it("混合真换行与字面量时保守不解码", () => {
    expect(decodeLiteralEscapesIfNeeded("abc\n\\n")).toBe("abc\n\\n");
  });

  it("空字符串原样返回", () => {
    expect(decodeLiteralEscapesIfNeeded("")).toBe("");
  });
});

describe("normalizeChunkingConfig 防御式解码", () => {
  it("hierarchical 策略：DB 中字面量转义自动解码为真换行（修复 Bug）", () => {
    const result = normalizeChunkingConfig({
      strategy: "hierarchical",
      separators: ["\\n\\n", "\\n", "。"],
      hierarchical_parent_chunk_size: 1024,
      hierarchical_child_chunk_size: 256,
      hierarchical_child_overlap: 51,
    });
    expect(result.strategy).toBe("hierarchical");
    if (result.strategy === "hierarchical") {
      expect(result.separators).toEqual(["\n\n", "\n", "。"]);
    }
  });

  it("recursive 策略：真换行原样保留", () => {
    const result = normalizeChunkingConfig({
      strategy: "recursive",
      chunk_size: 800,
      overlap: 100,
      separators: ["\n\n", "\n", "。"],
    });
    expect(result.strategy).toBe("recursive");
    if (result.strategy === "recursive") {
      expect(result.separators).toEqual(["\n\n", "\n", "。"]);
    }
  });

  it("hierarchical 策略：真换行原样保留（不被误解码）", () => {
    const result = normalizeChunkingConfig({
      strategy: "hierarchical",
      separators: ["\n\n", "\n"],
    });
    expect(result.strategy).toBe("hierarchical");
    if (result.strategy === "hierarchical") {
      expect(result.separators).toEqual(["\n\n", "\n"]);
    }
  });

  it("recursive 策略：字面量转义自动解码", () => {
    const result = normalizeChunkingConfig({
      strategy: "recursive",
      separators: ["\\n", "。"],
    });
    expect(result.strategy).toBe("recursive");
    if (result.strategy === "recursive") {
      expect(result.separators).toEqual(["\n", "。"]);
    }
  });

  it("separators 缺失时回退到默认值", () => {
    const result = normalizeChunkingConfig({ strategy: "hierarchical" });
    expect(result.strategy).toBe("hierarchical");
    if (result.strategy === "hierarchical") {
      expect(result.separators).toEqual(["\n"]);
    }
  });
});

// ---------------------------------------------------------------------------
// Document Library：Import / Ingest Document 与库文档路径分支
// ---------------------------------------------------------------------------

describe("importDocumentUrl / importDocumentFile / ingestDocument", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const okResponse = () =>
    new Response(JSON.stringify({ run_id: "run-1", status: "running", message: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  it("importDocumentUrl POST 到 /api/knowledge/documents/import_url", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(okResponse());

    const result = await importDocumentUrl({
      app_name: "negentropy",
      url: "https://example.com/post",
    });

    expect(result.run_id).toBe("run-1");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/knowledge/documents/import_url");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      app_name: "negentropy",
      url: "https://example.com/post",
    });
  });

  it("importDocumentFile 以 FormData POST 到 /api/knowledge/documents/import_file", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(okResponse());

    const file = new File(["# hi"], "notes.md", { type: "text/markdown" });
    await importDocumentFile({ app_name: "negentropy", file });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/knowledge/documents/import_file");
    const body = init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("app_name")).toBe("negentropy");
    expect(body.get("file")).toBe(file);
  });

  it("ingestDocument POST 到 /api/knowledge/base/{corpusId}/ingest_document", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(okResponse());

    await ingestDocument("corpus-1", {
      app_name: "negentropy",
      document_id: "doc-1",
      chunking_config: { strategy: "fixed", chunk_size: 512, overlap: 64, preserve_newlines: false },
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/knowledge/base/corpus-1/ingest_document");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      app_name: "negentropy",
      document_id: "doc-1",
      chunking_config: { strategy: "fixed" },
    });
  });
});

describe("库文档（corpusId=null）API 路径分支", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchDocumentDetail(null, ...) 走 /api/knowledge/documents/{id}", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "doc-1", corpus_id: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchDocumentDetail(null, "doc-1", { appName: "negentropy" });

    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      "/api/knowledge/documents/doc-1?app_name=negentropy",
    );
  });

  it("fetchDocumentDetail(corpusId, ...) 仍走 corpus 作用域路径", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "doc-1", corpus_id: "corpus-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchDocumentDetail("corpus-1", "doc-1", { appName: "negentropy" });

    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      "/api/knowledge/base/corpus-1/documents/doc-1?app_name=negentropy",
    );
  });

  it("deleteDocument(null, ...) 走库文档 DELETE 路径", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await deleteDocument(null, "doc-1", { appName: "negentropy", hardDelete: true });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      "/api/knowledge/documents/doc-1?app_name=negentropy&hard_delete=true",
    );
    expect(init?.method).toBe("DELETE");
  });

  it("refreshDocumentMarkdown(null, ...) 走库文档 refresh 路径且不做 kebab 回退", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ document_id: "doc-1", status: "running", message: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await refreshDocumentMarkdown(null, "doc-1", { appName: "negentropy" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      "/api/knowledge/documents/doc-1/refresh_markdown",
    );
  });
});

// ---------------------------------------------------------------------------
// PDF 源文档判定 + 内联预览 URL（文档详情页「Markdown | PDF」切换支撑）
// ---------------------------------------------------------------------------

describe("isPdfDocument", () => {
  it("content_type 为 application/pdf 时判为 PDF", () => {
    expect(
      isPdfDocument({ content_type: "application/pdf", original_filename: "a.bin" }),
    ).toBe(true);
  });

  it("content_type 大小写混合含 pdf 仍判为 PDF", () => {
    expect(
      isPdfDocument({ content_type: "Application/PDF", original_filename: "a" }),
    ).toBe(true);
  });

  it("content_type 缺失但文件名以 .pdf 结尾时判为 PDF（兜底历史数据）", () => {
    expect(
      isPdfDocument({ content_type: null, original_filename: "report.PDF" }),
    ).toBe(true);
  });

  it("URL / Markdown / 其他类型文档判为非 PDF", () => {
    expect(
      isPdfDocument({ content_type: "text/markdown", original_filename: "notes.md" }),
    ).toBe(false);
    expect(
      isPdfDocument({ content_type: "text/html", original_filename: "post" }),
    ).toBe(false);
    expect(
      isPdfDocument({ content_type: null, original_filename: "image.png" }),
    ).toBe(false);
  });
});

describe("documentPreviewUrl", () => {
  it("corpus 文档走 corpus 作用域 /preview 路径并带 app_name", () => {
    expect(
      documentPreviewUrl("corpus-1", "doc-1", { appName: "negentropy" }),
    ).toBe("/api/knowledge/base/corpus-1/documents/doc-1/preview?app_name=negentropy");
  });

  it("库文档（corpusId=null）走无 corpus 平行 /preview 路径", () => {
    expect(
      documentPreviewUrl(null, "doc-1", { appName: "negentropy" }),
    ).toBe("/api/knowledge/documents/doc-1/preview?app_name=negentropy");
  });

  it("未提供 appName 时不拼接查询串", () => {
    expect(documentPreviewUrl("corpus-1", "doc-1")).toBe(
      "/api/knowledge/base/corpus-1/documents/doc-1/preview",
    );
  });
});
