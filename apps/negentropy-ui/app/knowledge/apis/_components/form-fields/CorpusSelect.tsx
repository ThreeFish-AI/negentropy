"use client";

import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Loader2 } from "lucide-react";
import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";
import { useCorporaList } from "../hooks/useCorporaList";

interface CorpusSelectProps {
  field: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function CorpusSelect({ field, value, onChange }: CorpusSelectProps) {
  const { corpora, loading, error } = useCorporaList();

  return (
    <Field
      label={field.label}
      required={field.required}
      description={field.description}
      error={error ?? undefined}
    >
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        trailing={
          loading ? (
            <Loader2 className="pointer-events-none absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />
          ) : null
        }
      >
        <option value="">{loading ? "加载中..." : "选择语料库..."}</option>
        {corpora.map((corpus) => (
          <option key={corpus.id} value={corpus.id}>
            {corpus.name} ({corpus.id.slice(0, 8)}...)
          </option>
        ))}
      </Select>
      {!loading && corpora.length === 0 && !error && (
        <p className="text-caption text-amber-500">
          暂无语料库，请先创建一个
        </p>
      )}
    </Field>
  );
}
