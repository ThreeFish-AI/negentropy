"use client";

import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";

interface SelectInputProps {
  field: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function SelectInput({ field, value, onChange }: SelectInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary">
        {field.label}{" "}
        {field.required && <span className="text-rose-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {field.description && (
        <p className="mt-1 text-micro text-text-muted">
          {field.description}
        </p>
      )}
    </div>
  );
}
