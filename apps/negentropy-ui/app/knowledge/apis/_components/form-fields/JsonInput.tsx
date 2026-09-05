"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
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
    <Field
      label={field.label}
      required={field.required}
      description={field.description}
      error={error ?? undefined}
    >
      <Textarea
        value={text}
        onChange={handleChange}
        placeholder={field.placeholder || '{"key": "value"}'}
        rows={3}
        className={cn(
          "font-mono",
          error ? "border-error focus:ring-error/60" : undefined,
        )}
      />
    </Field>
  );
}
