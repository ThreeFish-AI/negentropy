"use client";

import { useEffect, useRef, useState } from "react";
import { CorpusRecord, fetchCorpora } from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

interface CorpusSelectorProps {
  value: string | null;
  onChange: (corpusId: string) => void;
}

export function CorpusSelector({ value, onChange }: CorpusSelectorProps) {
  const [corpora, setCorpora] = useState<CorpusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const autoSelected = useRef(false);

  useEffect(() => {
    let mounted = true;
    fetchCorpora(APP_NAME)
      .then((data) => {
        if (mounted) {
          setCorpora(data);
          if (!autoSelected.current && data.length > 0) {
            autoSelected.current = true;
            onChange(data[0].id);
          }
        }
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [onChange]);

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
        语料库
      </label>
      <select
        key={loading ? "loading" : "loaded"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        disabled={loading}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      >
        <option value="" disabled>{loading ? "加载中..." : "选择语料库..."}</option>
        {corpora.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
