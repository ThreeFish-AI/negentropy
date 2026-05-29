"use client";

import { useState } from "react";
import {
  CorpusRecord,
  ChunkingConfig,
  ChunkingStrategy,
  createDefaultChunkingConfig,
  normalizeChunkingConfig,
  SeparatorsTextarea,
} from "@/features/knowledge";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

interface CorpusFormDialogProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initialData?: CorpusRecord;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (params: {
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }) => Promise<void>;
}

function buildInitialState(
  mode: "create" | "edit",
  initialData?: CorpusRecord,
) {
  const conf =
    mode === "edit" && initialData
      ? normalizeChunkingConfig((initialData.config || {}) as Record<string, unknown>)
      : createDefaultChunkingConfig("recursive");
  return {
    name: mode === "edit" && initialData ? initialData.name : "",
    description:
      mode === "edit" && initialData ? initialData.description || "" : "",
    showAdvanced: false,
    config: conf,
  };
}

export function CorpusFormDialog({
  isOpen,
  mode,
  initialData,
  isLoading,
  onClose,
  onSubmit,
}: CorpusFormDialogProps) {
  const initialState = buildInitialState(mode, initialData);
  const [name, setName] = useState(initialState.name);
  const [description, setDescription] = useState(initialState.description);
  const [showAdvanced, setShowAdvanced] = useState(initialState.showAdvanced);
  const [config, setConfig] = useState<ChunkingConfig>(initialState.config);

  const handleSubmit = async () => {
    if (!name.trim() || isLoading) return;

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      config: config as unknown as Record<string, unknown>,
    });
  };

  if (!isOpen) return null;

  return (
    <OverlayDismissLayer
      open={isOpen}
      onClose={onClose}
      busy={isLoading}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"
    >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {mode === "create" ? "新建数据源" : "编辑数据源"}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              名称 <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
              placeholder="例如：产品文档"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              描述
            </label>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
              rows={3}
              placeholder="简要描述该数据源的内容用途..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-xs font-medium text-text-muted hover:text-foreground"
            >
              <span>高级配置 (Chunking Strategy)</span>
              <svg
                className={`ml-1 h-3 w-3 transform transition-transform ${
                  showAdvanced ? "rotate-90" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-lg bg-muted p-3">
                {/* Strategy Selection */}
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-text-muted">
                    Strategy
                  </label>
                  <select
                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                    value={config.strategy}
                    onChange={(e) =>
                      setConfig(
                        createDefaultChunkingConfig(e.target.value as ChunkingStrategy),
                      )
                    }
                  >
                    <option value="fixed">Fixed (Fixed Character Size)</option>
                    <option value="recursive">
                      Recursive (Structure Aware)
                    </option>
                    <option value="semantic">
                      Semantic (Embedding Similarity)
                    </option>
                    <option value="hierarchical">
                      Hierarchical (Parent + Child)
                    </option>
                  </select>
                </div>

                {config.strategy === "fixed" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-text-muted">
                        Chunk Size (Target)
                      </label>
                      <input
                        type="number"
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        value={String(config.chunk_size)}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            chunk_size: Number(e.target.value) || 800,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-text-muted">
                        Overlap (Chars)
                      </label>
                      <input
                        type="number"
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        value={String(config.overlap)}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            overlap: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {config.strategy === "recursive" && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-text-muted">
                          Chunk Size (Target)
                        </label>
                        <input
                          type="number"
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                          value={String(config.chunk_size)}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              chunk_size: Number(e.target.value) || 800,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-text-muted">
                          Overlap (Chars)
                        </label>
                        <input
                          type="number"
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                          value={String(config.overlap)}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              overlap: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-text-muted">
                        Separators (one per line)
                      </label>
                      <SeparatorsTextarea
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        rows={4}
                        placeholder={"\\n"}
                        value={config.separators}
                        onChange={(separators) =>
                          setConfig({ ...config, separators })
                        }
                      />
                    </div>
                  </div>
                )}

                {config.strategy === "semantic" && (
                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-[10px] font-medium text-blue-600 dark:text-blue-400">
                        Semantic Chunking Options
                      </label>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-text-muted">
                        Similarity Threshold (0-1)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        max="1.0"
                        min="0.0"
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        value={String(config.semantic_threshold)}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            semantic_threshold: Number(e.target.value) || 0.85,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-text-muted">
                        Buffer Size
                      </label>
                      <input
                        type="number"
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        value={String(config.semantic_buffer_size)}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            semantic_buffer_size: Number(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-text-muted">
                          Max Size
                        </label>
                        <input
                          type="number"
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                          value={String(config.max_chunk_size)}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              max_chunk_size: Number(e.target.value) || 2000,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-text-muted">
                          Min Size
                        </label>
                        <input
                          type="number"
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                          value={String(config.min_chunk_size)}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              min_chunk_size: Number(e.target.value) || 50,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {config.strategy === "hierarchical" && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-text-muted">
                          Parent Size
                        </label>
                        <input
                          type="number"
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                          value={String(config.hierarchical_parent_chunk_size)}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              hierarchical_parent_chunk_size:
                                Number(e.target.value) || 1024,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-text-muted">
                          Child Size
                        </label>
                        <input
                          type="number"
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                          value={String(config.hierarchical_child_chunk_size)}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              hierarchical_child_chunk_size:
                                Number(e.target.value) || 256,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-text-muted">
                          Child Overlap
                        </label>
                        <input
                          type="number"
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                          value={String(config.hierarchical_child_overlap)}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              hierarchical_child_overlap:
                                Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-text-muted">
                        Separators (one per line)
                      </label>
                      <SeparatorsTextarea
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        rows={4}
                        placeholder={"\\n"}
                        value={config.separators}
                        onChange={(separators) =>
                          setConfig({ ...config, separators })
                        }
                      />
                    </div>
                  </div>
                )}

                {(config.strategy === "fixed" ||
                  config.strategy === "recursive" ||
                  config.strategy === "hierarchical") && (
                  <div className="flex items-center pt-1">
                    <input
                      type="checkbox"
                      id="preserve-newlines"
                      className="h-3 w-3 rounded border-input"
                      checked={config.preserve_newlines}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          preserve_newlines: e.target.checked,
                        })
                      }
                    />
                    <label
                      htmlFor="preserve-newlines"
                      className="ml-2 text-xs text-text-secondary"
                    >
                      Preserve Newlines
                    </label>
                  </div>
                )}

                <div className="text-[10px] text-text-muted">
                  {config.strategy === "fixed" &&
                    "按固定字符数切分，简单高效但不感知语义。"}
                  {config.strategy === "recursive" &&
                    "递归切分 (段落 > 句子 > 词)，保持文段结构完整。"}
                  {config.strategy === "semantic" &&
                    "基于 Embedding 相似度切分，确保 Chunk 语义连贯，需消耗 Token。"}
                  {config.strategy === "hierarchical" &&
                    "先构建父块再切子块，检索命中子块但返回父块，适合长文档与手册。"}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-muted"
            disabled={isLoading}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm hover:opacity-90 disabled:opacity-50"
            disabled={isLoading || !name.trim()}
          >
            {isLoading
              ? "提交中..."
              : mode === "create"
                ? "立即创建"
                : "保存修改"}
          </button>
        </div>
    </OverlayDismissLayer>
  );
}
