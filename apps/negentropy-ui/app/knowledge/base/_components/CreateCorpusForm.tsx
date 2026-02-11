import { useState } from "react";
import { CorpusRecord } from "@/features/knowledge";

interface CreateCorpusFormProps {
  onCreate: (params: {
    name: string;
    description?: string;
  }) => Promise<CorpusRecord>;
  isLoading: boolean;
}

export function CreateCorpusForm({
  onCreate,
  isLoading,
}: CreateCorpusFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!name.trim() || isLoading) return;
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      setIsOpen(false);
    } catch {
      // error handled by hook's onError callback
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
      >
        + 新建数据源
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-900">新建数据源</p>
        <button
          onClick={() => setIsOpen(false)}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          取消
        </button>
      </div>
      <input
        className="mt-2 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
        placeholder="Corpus name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        className="mt-2 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
        rows={2}
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button
        className="mt-2 w-full rounded bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        disabled={isLoading || !name.trim()}
        onClick={handleCreate}
      >
        {isLoading ? "创建中…" : "Create Corpus"}
      </button>
    </div>
  );
}
