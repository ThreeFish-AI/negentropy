"use client";

import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";

interface TextareaInputProps {
  field: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function TextareaInput({ field, value, onChange }: TextareaInputProps) {
  return (
    <Field
      label={field.label}
      required={field.required}
      description={field.description}
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
      />
    </Field>
  );
}
