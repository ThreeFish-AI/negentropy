"use client";

import { useEffect, useState } from "react";
import { CorpusRecord, ChunkingStrategy } from "@/features/knowledge";

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

export function CorpusFormDialog({
  isOpen,
  mode,
  initialData,
  isLoading,
  onClose,
  onSubmit,
}: CorpusFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Chunking Config State
  const [strategy, setStrategy] = useState<ChunkingStrategy>("recursive");
  const [chunkSize, setChunkSize] = useState<string>("800");
  const [overlap, setOverlap] = useState<string>("100");
  const [preserveNewlines, setPreserveNewlines] = useState(true);

  // Semantic specific
  const [semanticThreshold, setSemanticThreshold] = useState<string>("0.85");
  const [minChunkSize, setMinChunkSize] = useState<string>("50");
  const [maxChunkSize, setMaxChunkSize] = useState<string>("2000");

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialData) {
        setName(initialData.name);
        setDescription(initialData.description || "");

        const conf = initialData.config || {};
        setStrategy((conf.strategy as ChunkingStrategy) || "recursive");
        setChunkSize(String(conf.chunk_size || "800"));
        setOverlap(String(conf.overlap || "100"));
        setPreserveNewlines(conf.preserve_newlines !== false);

        setSemanticThreshold(String(conf.semantic_threshold || "0.85"));
        setMinChunkSize(String(conf.min_chunk_size || "50"));
        setMaxChunkSize(String(conf.max_chunk_size || "2000"));

        setShowAdvanced(false);
      } else {
        setName("");
        setDescription("");
        setStrategy("recursive");
        setChunkSize("800");
        setOverlap("100");
        setPreserveNewlines(true);
        setSemanticThreshold("0.85");
        setMinChunkSize("50");
        setMaxChunkSize("2000");
        setShowAdvanced(false);
      }
    }
  }, [isOpen, mode, initialData]);

  const handleSubmit = async () => {
    if (!name.trim() || isLoading) return;

    const config: Record<string, unknown> = {
      strategy,
      preserve_newlines: preserveNewlines,
    };

    const size = parseInt(chunkSize, 10);
    const ov = parseInt(overlap, 10);
    if (!isNaN(size)) config.chunk_size = size;
    if (!isNaN(ov)) config.overlap = ov;

    if (strategy === "semantic") {
      const thresh = parseFloat(semanticThreshold);
      const minSize = parseInt(minChunkSize, 10);
      const maxSize = parseInt(maxChunkSize, 10);
      if (!isNaN(thresh)) config.semantic_threshold = thresh;
      if (!isNaN(minSize)) config.min_chunk_size = minSize;
      if (!isNaN(maxSize)) config.max_chunk_size = maxSize;
    }

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      config,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {mode === "create" ? "新建数据源" : "编辑数据源"}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
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
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              名称 <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
              placeholder="例如：产品文档"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              描述
            </label>
            <textarea
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
              rows={3}
              placeholder="简要描述该数据源的内容用途..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
              <div className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                {/* Strategy Selection */}
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    Strategy
                  </label>
                  <select
                    className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                    value={strategy}
                    onChange={(e) =>
                      setStrategy(e.target.value as ChunkingStrategy)
                    }
                  >
                    <option value="fixed">Fixed (Fixed Character Size)</option>
                    <option value="recursive">
                      Recursive (Structure Aware)
                    </option>
                    <option value="semantic">
                      Semantic (Embedding Similarity)
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                      Chunk Size (Target)
                    </label>
                    <input
                      type="number"
                      className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                      Overlap (Chars)
                    </label>
                    <input
                      type="number"
                      className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                      value={overlap}
                      onChange={(e) => setOverlap(e.target.value)}
                    />
                  </div>
                </div>

                {strategy === "semantic" && (
                  <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                    <div className="col-span-2">
                      <label className="mb-1 block text-[10px] font-medium text-blue-600 dark:text-blue-400">
                        Semantic Chunking Options
                      </label>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                        Similarity Threshold (0-1)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        max="1.0"
                        min="0.0"
                        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                        value={semanticThreshold}
                        onChange={(e) => setSemanticThreshold(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                          Max Size
                        </label>
                        <input
                          type="number"
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                          value={maxChunkSize}
                          onChange={(e) => setMaxChunkSize(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                          Min Size
                        </label>
                        <input
                          type="number"
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                          value={minChunkSize}
                          onChange={(e) => setMinChunkSize(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center pt-1">
                  <input
                    type="checkbox"
                    id="preserve-newlines"
                    className="h-3 w-3 rounded border-zinc-300"
                    checked={preserveNewlines}
                    onChange={(e) => setPreserveNewlines(e.target.checked)}
                  />
                  <label
                    htmlFor="preserve-newlines"
                    className="ml-2 text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    Preserve Newlines
                  </label>
                </div>

                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  {strategy === "fixed" &&
                    "按固定字符数切分，简单高效但不感知语义。"}
                  {strategy === "recursive" &&
                    "递归切分 (段落 > 句子 > 词)，保持文段结构完整。"}
                  {strategy === "semantic" &&
                    "基于 Embedding 相似度切分，确保 Chunk 语义连贯，需消耗 Token。"}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            disabled={isLoading}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            disabled={isLoading || !name.trim()}
          >
            {isLoading
              ? "提交中..."
              : mode === "create"
                ? "立即创建"
                : "保存修改"}
          </button>
        </div>
      </div>
    </div>
  );
}
