import {
  buildCorpusConfig,
  createDefaultChunkingConfig,
} from "@/features/knowledge/utils/knowledge-api";
import {
  createKnowledgeApiMockSet,
  createKnowledgeApiTestHarness,
} from "@/tests/helpers/knowledge-api";

describe("knowledge api test harness", () => {
  it("默认复用真实配置 helper，并把 exports 与 mocks 绑定到同一组函数", async () => {
    const mocks = createKnowledgeApiMockSet();
    const harness = await createKnowledgeApiTestHarness(mocks);

    expect(harness.exports.createDefaultChunkingConfig).toBe(
      createDefaultChunkingConfig,
    );
    expect(harness.exports.buildCorpusConfig).toBe(buildCorpusConfig);

    const fetchCorpus = harness.exports.fetchCorpus as (...args: unknown[]) => unknown;
    fetchCorpus("corpus-1", "negentropy");

    expect(mocks.fetchCorpusMock).toHaveBeenCalledWith("corpus-1", "negentropy");
  });

  it("允许局部 override，而不会污染真实 helper 导出", async () => {
    const mocks = createKnowledgeApiMockSet();
    const overrideSearchKnowledge = vi.fn();
    const harness = await createKnowledgeApiTestHarness(mocks, {
      searchKnowledge: overrideSearchKnowledge,
    });

    expect(harness.exports.searchKnowledge).toBe(overrideSearchKnowledge);
    expect(harness.exports.normalizeChunkingConfig).toBeDefined();
    expect(harness.exports.createDefaultChunkingConfig).toBe(
      createDefaultChunkingConfig,
    );
  });
});
