"use client";

import { useState } from "react";
import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";

interface JsonInputProps {
  field: FormFieldConfig;
  value: Record<string, unknown> | undefined;
  onChange: (value: Record<string, unknown> | undefined) => void;
}

export function JsonInput({ field, value, onChange }: JsonInputProps) {
  const [text, setText] = useState(() => {
    if (value === undefined || value === null) return "";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    if (!newText.trim()) {
      onChange(undefined);
      setError(null);
      return;
    }

    try {
      const parsed = JSON.parse(newText);
      onChange(parsed);
      setError(null);
    } catch {
      setError("JSON 格式无效");
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {field.label}{" "}
        {field.required && <span className="text-rose-500">*</span>}
      </label>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder={field.placeholder || '{"key": "value"}'}
        rows={3}
        className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500 dark:border-rose-700"
            : "border-zinc-200 focus:border-blue-500 focus:ring-blue-500 dark:border-zinc-700"
        }`}
      />
      {error && (
        <p className="mt-1 text-[10px] text-rose-500">{error}</p>
      )}
      {field.description && !error && (
        <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
          {field.description}
        </p>
      )}
    </div>
  );
}
