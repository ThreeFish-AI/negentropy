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
      <label className="block text-xs font-medium text-text-secondary">
        {field.label}{" "}
        {field.required && <span className="text-rose-500">*</span>}
      </label>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder={field.placeholder || '{"key": "value"}'}
        rows={3}
        className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500 dark:border-rose-700"
            : "border-input focus:border-blue-500 focus:ring-blue-500"
        }`}
      />
      {error && (
        <p className="mt-1 text-micro text-rose-500">{error}</p>
      )}
      {field.description && !error && (
        <p className="mt-1 text-micro text-text-muted">
          {field.description}
        </p>
      )}
    </div>
  );
}
