import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch 用于测试 API 客户端
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// 动态导入，确保 fetch mock 在模块加载前就位
const { wikiApi } = await import("@/lib/wiki-api");

// ---------------------------------------------------------------------------
// 辅助工厂
// ---------------------------------------------------------------------------

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

const samplePublication = {
  id: "pub-001",
  corpus_id: "corpus-001",
  name: "Test Wiki",
  slug: "test-wiki",
  description: "A test publication",
  status: "published" as const,
  theme: "default" as const,
  version: 1,
  published_at: "2025-01-01T00:00:00Z",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  entries_count: 3,
};

const sampleEntry = {
  id: "entry-001",
  document_id: "doc-001",
  entry_slug: "getting-started",
  entry_title: "Getting Started",
  is_index_page: false,
};

const sampleEntryContent = {
  entry_id: "entry-001",
  document_id: "doc-001",
  entry_slug: "getting-started",
  entry_title: "Getting Started",
  markdown_content: "# Hello\n\nWorld",
  document_filename: "getting-started.md",
};

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset();
});

describe("WikiApiClient", () => {
  // -------------------------------------------------------------------------
  // 基础 API 方法
  // -------------------------------------------------------------------------

  describe("listPublications", () => {
    it("返回已发布的 Publication 列表", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ items: [samplePublication], total: 1 }),
      );

      const result = await wikiApi.listPublications();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].slug).toBe("test-wiki");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/publications?status=published"),
        expect.any(Object),
      );
    });

    it("API 异常时抛出错误", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ detail: "Server Error" }, 500),
      );

      await expect(wikiApi.listPublications()).rejects.toThrow("Wiki API error [500]");
    });
  });

  describe("getEntries", () => {
    it("返回 Publication 的所有条目", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ items: [sampleEntry], total: 1 }),
      );

      const result = await wikiApi.getEntries("pub-001");

      expect(result.items).toHaveLength(1);
      expect(result.items[0].entry_slug).toBe("getting-started");
    });
  });

  describe("getNavTree", () => {
    it("返回导航树", async () => {
      const navTree = {
        publication_id: "pub-001",
        nav_tree: {
          items: [
            {
              entry_id: "entry-001",
              entry_slug: "getting-started",
              entry_title: "Getting Started",
              is_index_page: false,
              document_id: "doc-001",
            },
          ],
        },
      };
      mockFetch.mockResolvedValueOnce(mockJsonResponse(navTree));

      const result = await wikiApi.getNavTree("pub-001");

      expect(result.nav_tree.items).toHaveLength(1);
      expect(result.publication_id).toBe("pub-001");
    });
  });

  describe("getEntryContent", () => {
    it("返回条目的 Markdown 内容", async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(sampleEntryContent));

      const result = await wikiApi.getEntryContent("entry-001");

      expect(result.markdown_content).toBe("# Hello\n\nWorld");
      expect(result.document_filename).toBe("getting-started.md");
    });
  });

  // -------------------------------------------------------------------------
  // 辅助查询方法
  // -------------------------------------------------------------------------

  describe("findPublicationBySlug", () => {
    it("通过 slug 找到匹配的 Publication", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ items: [samplePublication], total: 1 }),
      );

      const result = await wikiApi.findPublicationBySlug("test-wiki");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("pub-001");
      expect(result!.slug).toBe("test-wiki");
    });

    it("slug 不匹配时返回 null", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ items: [samplePublication], total: 1 }),
      );

      const result = await wikiApi.findPublicationBySlug("nonexistent");

      expect(result).toBeNull();
    });

    it("空列表时返回 null", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ items: [], total: 0 }),
      );

      const result = await wikiApi.findPublicationBySlug("test-wiki");

      expect(result).toBeNull();
    });

    it("API 异常时向上抛出错误", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ detail: "Internal Server Error" }, 500),
      );

      await expect(wikiApi.findPublicationBySlug("test-wiki")).rejects.toThrow();
    });
  });

  describe("findEntryId", () => {
    it("通过 entry_slug 找到匹配的 entry_id", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ items: [sampleEntry], total: 1 }),
      );

      const result = await wikiApi.findEntryId("pub-001", "getting-started");

      expect(result).toBe("entry-001");
    });

    it("slug 不匹配时返回 null", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ items: [sampleEntry], total: 1 }),
      );

      const result = await wikiApi.findEntryId("pub-001", "nonexistent");

      expect(result).toBeNull();
    });

    it("空条目列表时返回 null", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ items: [], total: 0 }),
      );

      const result = await wikiApi.findEntryId("pub-001", "getting-started");

      expect(result).toBeNull();
    });

    it("API 异常时向上抛出错误", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ detail: "Not Found" }, 404),
      );

      await expect(wikiApi.findEntryId("pub-001", "test")).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // HTTP 错误处理
  // -------------------------------------------------------------------------

  describe("HTTP 错误处理", () => {
    it("404 错误包含 URL 和状态码信息", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ detail: "Not Found" }, 404),
      );

      await expect(wikiApi.getEntryContent("bad-id")).rejects.toThrow(
        /Wiki API error \[404\]/,
      );
    });

    it("网络异常时抛出原生错误", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      await expect(wikiApi.listPublications()).rejects.toThrow("Network failure");
    });
  });
});
