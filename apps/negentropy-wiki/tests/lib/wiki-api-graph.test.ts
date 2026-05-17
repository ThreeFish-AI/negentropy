import { beforeEach, describe, expect, it, vi } from "vitest";

// 与 wiki-api.test.ts 保持相同的 mock 模式：动态 import 确保 fetch stub 已就位
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { wikiApi } = await import("@/lib/wiki-api");

// ---------------------------------------------------------------------------
// 辅助
// ---------------------------------------------------------------------------

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

const sampleGraph = {
  publication_id: "pub-001",
  version: 3,
  status: "ok" as const,
  nodes: [
    {
      id: "ent-1",
      label: "Negentropy",
      type: "concept",
      importance: 0.8,
      community_id: 1,
      entry_slugs: ["intro", "design"],
      mention_count_in_pub: 12,
      metadata: { corpus_id: "corpus-001", entity_type: "concept" },
    },
  ],
  edges: [
    {
      source: "ent-1",
      target: "ent-2",
      label: "RELATED_TO",
      type: "RELATED_TO",
      weight: 1.0,
      metadata: { confidence: 0.95 },
    },
  ],
  truncated: false,
  total_entities: 1,
  corpus_ids: ["corpus-001"],
};

const sampleEntities = {
  publication_id: "pub-001",
  version: 3,
  total: 2,
  offset: 0,
  limit: 50,
  items: [
    {
      id: "ent-1",
      name: "Negentropy",
      entity_type: "concept",
      importance: 0.8,
      community_id: 1,
      mention_count_in_pub: 12,
      entry_slugs: ["intro"],
      corpus_id: "corpus-001",
    },
  ],
};

const sampleEntityDetail = {
  publication_id: "pub-001",
  version: 3,
  entity: sampleEntities.items[0],
  neighbors: [
    {
      id: "ent-2",
      name: "Entropy",
      entity_type: "concept",
      relation_type: "OPPOSITE_OF",
      direction: "outgoing" as const,
      weight: 1.0,
      entry_slugs: ["thermodynamics"],
    },
  ],
  mentioning_entries: [
    {
      entry_id: "entry-1",
      entry_slug: "intro",
      entry_title: "Intro",
      document_id: "doc-1",
      mention_count: 3,
    },
  ],
};

const sampleEntryGraph = {
  entry_id: "entry-1",
  publication_id: "pub-001",
  version: 3,
  status: "ok" as const,
  nodes: sampleGraph.nodes,
  edges: sampleGraph.edges,
  center_entity_ids: ["ent-1"],
};

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe("wikiApi knowledge graph endpoints", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("getPublicationGraph dispatches with default revalidate + correct path", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(sampleGraph));

    const result = await wikiApi.getPublicationGraph("pub-001");

    expect(result).toEqual(sampleGraph);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/knowledge\/wiki\/publications\/pub-001\/graph$/);
    expect(init?.next?.revalidate).toBe(300);
  });

  it("getPublicationGraph passes max_nodes / min_importance / include_isolated query params", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(sampleGraph));

    await wikiApi.getPublicationGraph("pub-001", {
      maxNodes: 500,
      minImportance: 0.2,
      includeIsolated: true,
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("max_nodes=500");
    expect(url).toContain("min_importance=0.2");
    expect(url).toContain("include_isolated=true");
  });

  it("getPublicationGraph propagates revalidate tag when provided", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(sampleGraph));

    await wikiApi.getPublicationGraph("pub-001", { tag: "wiki-graph:my-pub" });

    const [, init] = mockFetch.mock.calls[0];
    expect(init?.next?.tags).toEqual(["wiki-graph:my-pub"]);
    expect(init?.next?.revalidate).toBe(300);
  });

  it("getPublicationGraph throws with informative message on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('{"code":"WIKI_PUB_NOT_PUBLISHED"}'),
      json: () => Promise.resolve({}),
    });

    // 单次调用即可同时验证 status 与 body 透传到错误消息中
    await expect(wikiApi.getPublicationGraph("pub-001")).rejects.toThrow(
      /403.*WIKI_PUB_NOT_PUBLISHED/,
    );
  });

  it("getPublicationEntities passes offset/limit/sort_by", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(sampleEntities));

    const result = await wikiApi.getPublicationEntities("pub-001", {
      offset: 10,
      limit: 25,
      sortBy: "mention",
    });

    expect(result.total).toBe(2);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/publications/pub-001/graph/entities");
    expect(url).toContain("offset=10");
    expect(url).toContain("limit=25");
    expect(url).toContain("sort_by=mention");
  });

  it("getPublicationEntityDetail uses entityId in path", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(sampleEntityDetail));

    const result = await wikiApi.getPublicationEntityDetail("pub-001", "ent-1");

    expect(result.entity.id).toBe("ent-1");
    expect(result.neighbors).toHaveLength(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(
      /\/knowledge\/wiki\/publications\/pub-001\/graph\/entities\/ent-1$/,
    );
  });

  it("getEntryGraph uses entry_id in path and passes max_nodes", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(sampleEntryGraph));

    const result = await wikiApi.getEntryGraph("entry-1", { maxNodes: 80 });

    expect(result.center_entity_ids).toEqual(["ent-1"]);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/knowledge\/wiki\/entries\/entry-1\/graph/);
    expect(url).toContain("max_nodes=80");
  });
});
