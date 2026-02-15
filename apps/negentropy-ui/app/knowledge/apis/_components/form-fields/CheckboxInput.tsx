"use client";

import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";

interface CheckboxInputProps {
  field: FormFieldConfig;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function CheckboxInput({ field, value, onChange }: CheckboxInputProps) {
  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        id={field.name}
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
      />
      <label
        htmlFor={field.name}
        className="ml-2 text-xs text-zinc-700 dark:text-zinc-300"
      >
        {field.label}
        {field.required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {field.description && (
        <span className="ml-2 text-[10px] text-zinc-500 dark:text-zinc-400">
          {field.description}
        </span>
      )}
    </div>
  );
}
