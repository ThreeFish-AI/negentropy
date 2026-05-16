import type { CorpusRecord } from "@/features/knowledge";

function CorpusStatusBadge({ corpus }: { corpus: CorpusRecord }) {
  const hasKnowledge = corpus.knowledge_count > 0;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        hasKnowledge
          ? "bg-emerald-100 text-emerald-700"
          : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {hasKnowledge ? "Ready" : "Empty"}
    </span>
  );
}

export { CorpusStatusBadge };
