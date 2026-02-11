import { useEffect, useState } from "react";
import { CorpusRecord } from "@/features/knowledge";

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
  const [chunkSize, setChunkSize] = useState<string>("1000");
  const [overlap, setOverlap] = useState<string>("200");
  const [preserveNewlines, setPreserveNewlines] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialData) {
        setName(initialData.name);
        setDescription(initialData.description || "");
        setChunkSize(String(initialData.config?.chunk_size || "1000"));
        setOverlap(String(initialData.config?.overlap || "200"));
        setPreserveNewlines(initialData.config?.preserve_newlines !== false);
        setShowAdvanced(false);
      } else {
        setName("");
        setDescription("");
        setChunkSize("1000");
        setOverlap("200");
        setPreserveNewlines(true);
        setShowAdvanced(false);
      }
    }
  }, [isOpen, mode, initialData]);

  const handleSubmit = async () => {
    if (!name.trim() || isLoading) return;

    const config: Record<string, unknown> = {};
    const size = parseInt(chunkSize, 10);
    const ov = parseInt(overlap, 10);

    if (!isNaN(size)) config.chunk_size = size;
    if (!isNaN(ov)) config.overlap = ov;
    config.preserve_newlines = preserveNewlines;

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      config,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            {mode === "create" ? "新建数据源" : "编辑数据源"}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600"
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
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              名称 <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
              placeholder="例如：产品文档"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              描述
            </label>
            <textarea
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
              rows={3}
              placeholder="简要描述该数据源的内容用途..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-xs font-medium text-zinc-500 hover:text-zinc-800"
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
              <div className="mt-3 grid grid-cols-2 gap-4 rounded-lg bg-zinc-50 p-3">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-zinc-500">
                    Chunk Size (Chars)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-zinc-500">
                    Overlap (Chars)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                    value={overlap}
                    onChange={(e) => setOverlap(e.target.value)}
                  />
                </div>
                <div className="col-span-2 flex items-center">
                  <input
                    type="checkbox"
                    id="preserve-newlines"
                    className="h-3 w-3 rounded border-zinc-300"
                    checked={preserveNewlines}
                    onChange={(e) => setPreserveNewlines(e.target.checked)}
                  />
                  <label
                    htmlFor="preserve-newlines"
                    className="ml-2 text-xs text-zinc-600"
                  >
                    Preserve Newlines (Keep paragraph structure)
                  </label>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-zinc-400">
                    注意：修改配置仅影响后续导入的文档，不影响已索引的内容。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            disabled={isLoading}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
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
