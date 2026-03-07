import {
  buildCorpusConfig,
  createDefaultChunkingConfig,
} from "@/features/knowledge/utils/knowledge-api";
import {
  createKnowledgeFeatureMockSet,
  primeKnowledgeFeatureMocks,
  resetKnowledgeFeatureMocks,
  createKnowledgeFeatureTestHarness,
} from "@/tests/helpers/knowledge";

describe("knowledge test harness", () => {
  it("默认复用真实配置 helper，并把 exports 与 mocks 绑定到同一组函数", () => {
    const mocks = createKnowledgeFeatureMockSet();
    const harness = createKnowledgeFeatureTestHarness(mocks);

    expect(harness.exports.createDefaultChunkingConfig).toBe(
      createDefaultChunkingConfig,
    );
    expect(harness.exports.buildCorpusConfig).toBe(buildCorpusConfig);

    const fetchPipelines = harness.exports.fetchPipelines as (
      ...args: unknown[]
    ) => unknown;
    fetchPipelines("negentropy");

    expect(mocks.fetchPipelinesMock).toHaveBeenCalledWith("negentropy");
  });

  it("允许局部 override，而不会替换真实配置 helper", () => {
    const mocks = createKnowledgeFeatureMockSet();
    const overrideUseKnowledgeBase = vi.fn();
    const harness = createKnowledgeFeatureTestHarness(mocks, {
      useKnowledgeBase: overrideUseKnowledgeBase,
    });

    expect(harness.exports.useKnowledgeBase).toBe(overrideUseKnowledgeBase);
    expect(harness.exports.normalizeChunkingConfig).toBeDefined();
    expect(harness.exports.createDefaultChunkingConfig).toBe(
      createDefaultChunkingConfig,
    );
  });

  it("支持统一 reset 与稳定默认装配", async () => {
    const mocks = createKnowledgeFeatureMockSet();
    primeKnowledgeFeatureMocks(mocks);

    await expect(mocks.ingestTextMock()).resolves.toEqual({ ok: true });
    await expect(mocks.createCorpusMock()).resolves.toEqual({ ok: true });

    resetKnowledgeFeatureMocks(mocks);

    expect(mocks.ingestTextMock).not.toHaveBeenCalled();
    expect(mocks.createCorpusMock).not.toHaveBeenCalled();
  });
});
