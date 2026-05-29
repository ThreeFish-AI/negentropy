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
        className="h-3.5 w-3.5 rounded border-input text-blue-600 focus:ring-blue-500 dark:bg-input"
      />
      <label
        htmlFor={field.name}
        className="ml-2 text-xs text-text-secondary"
      >
        {field.label}
        {field.required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {field.description && (
        <span className="ml-2 text-[10px] text-text-muted">
          {field.description}
        </span>
      )}
    </div>
  );
}
