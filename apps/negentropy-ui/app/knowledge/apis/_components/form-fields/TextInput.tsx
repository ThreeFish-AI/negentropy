"use client";

import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";

interface TextInputProps {
  field: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function TextInput({ field, value, onChange }: TextInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {field.label}{" "}
        {field.required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      {field.description && (
        <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
          {field.description}
        </p>
      )}
    </div>
  );
}
