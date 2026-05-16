"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  type ChunkingConfig,
  type ChunkingStrategy,
  createDefaultChunkingConfig,
  SeparatorsTextarea,
} from "@/features/knowledge";

function ChunkingStrategyPanel({
  config,
  onChange,
  title,
  description,
}: {
  config: ChunkingConfig;
  onChange: Dispatch<SetStateAction<ChunkingConfig>>;
  title: string;
  description?: string;
}) {
  const strategyDescriptions: Record<ChunkingStrategy, string> = {
    fixed: "固定长度切分，简单可预测，但可能割裂句子或段落。",
    recursive: "按段落、句子、词递归切分，适合大多数技术文档。",
    semantic: "基于语义相似度断点切分，完整性更高，但计算成本更高。",
    hierarchical: "构建父子块结构，检索子块并返回父块上下文，适合长文与手册。",
  };

  const setStrategy = (strategy: ChunkingStrategy) => {
    onChange(createDefaultChunkingConfig(strategy));
  };

  const updateConfig = (nextConfig: ChunkingConfig) => {
    onChange(nextConfig);
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="mt-1 text-xs text-muted">{description}</p>
          )}
        </div>
        <div className="text-[11px] text-muted">大小单位: 字符近似值</div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {(["fixed", "recursive", "semantic", "hierarchical"] as const).map(
          (strategy) => (
            <button
              key={strategy}
              type="button"
              onClick={() => setStrategy(strategy)}
              className={`rounded-xl border px-3 py-3 text-left ${
                config.strategy === strategy
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              }`}
            >
              <div className="text-xs font-semibold capitalize">{strategy}</div>
              <div
                className={`mt-1 text-[11px] ${
                  config.strategy === strategy ? "text-background/80" : "text-muted"
                }`}
              >
                {strategyDescriptions[strategy]}
              </div>
            </button>
          ),
        )}
      </div>

      {config.strategy === "fixed" && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs">
            <div className="mb-1 text-muted">Chunk Size</div>
            <input
              type="number"
              value={String(config.chunk_size)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  chunk_size: Number(e.target.value || 0) || 800,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted">Overlap</div>
            <input
              type="number"
              value={String(config.overlap)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  overlap: Number(e.target.value || 0) || 0,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.preserve_newlines}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  preserve_newlines: e.target.checked,
                })
              }
            />
            <span>保留换行</span>
          </label>
        </div>
      )}

      {config.strategy === "recursive" && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs">
              <div className="mb-1 text-muted">Chunk Size</div>
              <input
                type="number"
                value={String(config.chunk_size)}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    chunk_size: Number(e.target.value || 0) || 800,
                  })
                }
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
            <label className="text-xs">
              <div className="mb-1 text-muted">Overlap</div>
              <input
                type="number"
                value={String(config.overlap)}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    overlap: Number(e.target.value || 0) || 0,
                  })
                }
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
            <label className="text-xs md:col-span-2">
              <div className="mb-1 text-muted">Separators（每行一个）</div>
              <SeparatorsTextarea
                value={config.separators}
                onChange={(separators) =>
                  updateConfig({ ...config, separators })
                }
                rows={3}
                placeholder={"\\n"}
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.preserve_newlines}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  preserve_newlines: e.target.checked,
                })
              }
            />
            <span>保留换行</span>
          </label>
        </div>
      )}

      {config.strategy === "semantic" && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs">
            <div className="mb-1 text-muted">Similarity Threshold</div>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={String(config.semantic_threshold)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  semantic_threshold: Number(e.target.value) || 0.85,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted">Buffer Size</div>
            <input
              type="number"
              value={String(config.semantic_buffer_size)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  semantic_buffer_size: Number(e.target.value) || 1,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted">Min Chunk Size</div>
            <input
              type="number"
              value={String(config.min_chunk_size)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  min_chunk_size: Number(e.target.value) || 50,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted">Max Chunk Size</div>
            <input
              type="number"
              value={String(config.max_chunk_size)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  max_chunk_size: Number(e.target.value) || 2000,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
        </div>
      )}

      {config.strategy === "hierarchical" && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs">
              <div className="mb-1 text-muted">Parent Size</div>
              <input
                type="number"
                value={String(config.hierarchical_parent_chunk_size)}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    hierarchical_parent_chunk_size: Number(e.target.value) || 1024,
                  })
                }
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
            <label className="text-xs">
              <div className="mb-1 text-muted">Child Size</div>
              <input
                type="number"
                value={String(config.hierarchical_child_chunk_size)}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    hierarchical_child_chunk_size: Number(e.target.value) || 256,
                  })
                }
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
            <label className="text-xs">
              <div className="mb-1 text-muted">Child Overlap</div>
              <input
                type="number"
                value={String(config.hierarchical_child_overlap)}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    hierarchical_child_overlap: Number(e.target.value) || 0,
                  })
                }
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
          </div>
          <label className="text-xs">
            <div className="mb-1 text-muted">Separators（每行一个）</div>
            <SeparatorsTextarea
              value={config.separators}
              onChange={(separators) =>
                updateConfig({ ...config, separators })
              }
              rows={3}
              placeholder={"\\n"}
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.preserve_newlines}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  preserve_newlines: e.target.checked,
                })
              }
            />
            <span>保留换行</span>
          </label>
        </div>
      )}
    </div>
  );
}

export { ChunkingStrategyPanel };
