import { CorpusRecord } from "@/features/knowledge";

interface CorpusListProps {
  corpora: CorpusRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

export function CorpusList({
  corpora,
  selectedId,
  onSelect,
  isLoading,
}: CorpusListProps) {
  if (isLoading && corpora.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg bg-zinc-200"
          />
        ))}
      </div>
    );
  }

  if (corpora.length === 0) {
    return <p className="text-xs text-zinc-500">暂无数据源</p>;
  }

  return (
    <div className="space-y-2">
      {corpora.map((corpus) => (
        <button
          key={corpus.id}
          onClick={() => onSelect(corpus.id)}
          className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
            selectedId === corpus.id
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 text-zinc-700 hover:border-zinc-400"
          }`}
        >
          <p className="text-xs font-semibold">{corpus.name}</p>
          <p className="mt-1 text-[11px] opacity-70">
            {corpus.description || corpus.app_name}
          </p>
        </button>
      ))}
    </div>
  );
}
