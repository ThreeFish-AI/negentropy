"use client";

import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";
import { useCorporaList } from "../hooks/useCorporaList";
import { Loader2 } from "lucide-react";

interface CorpusSelectProps {
  field: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function CorpusSelect({ field, value, onChange }: CorpusSelectProps) {
  const { corpora, loading, error } = useCorporaList();

  return (
    <div>
      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {field.label}{" "}
        {field.required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative mt-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">
            {loading ? "加载中..." : "选择语料库..."}
          </option>
          {corpora.map((corpus) => (
            <option key={corpus.id} value={corpus.id}>
              {corpus.name} ({corpus.id.slice(0, 8)}...)
            </option>
          ))}
        </select>
        {loading && (
          <Loader2 className="absolute right-8 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-zinc-400" />
        )}
      </div>
      {error && (
        <p className="mt-1 text-[10px] text-rose-500">{error}</p>
      )}
      {!loading && corpora.length === 0 && !error && (
        <p className="mt-1 text-[10px] text-amber-500">
          暂无语料库，请先创建一个
        </p>
      )}
      {field.description && (
        <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
          {field.description}
        </p>
      )}
    </div>
  );
}
