"use client";

import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";

interface SelectInputProps {
  field: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function SelectInput({ field, value, onChange }: SelectInputProps) {
  return (
    <Field
      label={field.label}
      required={field.required}
      description={field.description}
    >
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
