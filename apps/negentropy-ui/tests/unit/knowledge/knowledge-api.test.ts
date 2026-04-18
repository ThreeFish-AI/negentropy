import {
  buildExtractorRoutesFromDraft,
  buildCorpusConfig,
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
