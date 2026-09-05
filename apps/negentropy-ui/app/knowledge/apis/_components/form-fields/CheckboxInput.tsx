"use client";

import { Field } from "@/components/ui/Field";
import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";

interface CheckboxInputProps {
  field: FormFieldConfig;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function CheckboxInput({ field, value, onChange }: CheckboxInputProps) {
  return (
    <Field
      variant="check"
      label={field.label}
      required={field.required}
      description={field.description}
    >
      <input
        type="checkbox"
        id={field.name}
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </Field>
  );
}
