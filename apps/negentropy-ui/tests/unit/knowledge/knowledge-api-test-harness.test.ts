import {
  createKnowledgeApiMockSet,
  importKnowledgeApiActual,
  createKnowledgeApiTestHarness,
  primeKnowledgeApiMocks,
  resetKnowledgeApiMocks,
} from "@/tests/helpers/knowledge-api";

describe("knowledge api test harness", () => {
  it("冷启动时也能完成异步装配，不会因循环依赖卡住", async () => {
    const mocks = createKnowledgeApiMockSet();
    const harness = await createKnowledgeApiTestHarness(mocks);

    expect(harness.exports.createDefaultChunkingConfig).toBeDefined();
    expect(harness.exports.normalizeChunkingConfig).toBeDefined();
    expect(harness.exports.buildCorpusConfig).toBeDefined();

    const fetchCorpus = harness.exports.fetchCorpus as (...args: unknown[]) => unknown;
    fetchCorpus("cold-start-corpus", "negentropy");

    expect(mocks.fetchCorpusMock).toHaveBeenCalledWith(
      "cold-start-corpus",
      "negentropy",
    );
  });

  it("默认复用真实配置 helper，并把 exports 与 mocks 绑定到同一组函数", async () => {
    const mocks = createKnowledgeApiMockSet();
    const actual = await importKnowledgeApiActual();
    const harness = await createKnowledgeApiTestHarness(mocks);

    expect(harness.exports.createDefaultChunkingConfig).toBe(
      actual.createDefaultChunkingConfig,
    );
    expect(harness.exports.buildCorpusConfig).toBe(actual.buildCorpusConfig);

    const fetchCorpus = harness.exports.fetchCorpus as (...args: unknown[]) => unknown;
    fetchCorpus("corpus-1", "negentropy");

    expect(mocks.fetchCorpusMock).toHaveBeenCalledWith("corpus-1", "negentropy");
  });

  it("允许局部 override，而不会污染真实 helper 导出", async () => {
    const mocks = createKnowledgeApiMockSet();
    const overrideSearchKnowledge = vi.fn();
    const actual = await importKnowledgeApiActual();
    const harness = await createKnowledgeApiTestHarness(mocks, {
      searchKnowledge: overrideSearchKnowledge,
    });

    expect(harness.exports.searchKnowledge).toBe(overrideSearchKnowledge);
    expect(harness.exports.normalizeChunkingConfig).toBeDefined();
    expect(harness.exports.createDefaultChunkingConfig).toBe(
      actual.createDefaultChunkingConfig,
    );
  });

  it("支持统一 reset 与稳定默认装配", async () => {
    const mocks = createKnowledgeApiMockSet();
    primeKnowledgeApiMocks(mocks);

    await expect(mocks.fetchCorporaMock()).resolves.toEqual([]);

    resetKnowledgeApiMocks(mocks);

    expect(mocks.fetchCorporaMock).not.toHaveBeenCalled();
  });
});
