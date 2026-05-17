"use client";

import { useEffect, useState } from "react";
import { CorpusRecord, fetchCorpora } from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

interface CorpusSelectorProps {
  value: string | null;
  onChange: (corpusId: string) => void;
}

export function CorpusSelector({ value, onChange }: CorpusSelectorProps) {
  const [corpora, setCorpora] = useState<CorpusRecord[]>([]);

  useEffect(() => {
    fetchCorpora(APP_NAME).then(setCorpora).catch(console.error);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted whitespace-nowrap">
        语料库:
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <option value="">选择语料库...</option>
        {corpora.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
