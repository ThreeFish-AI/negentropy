"use client";

import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";

interface TextInputProps {
  field: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function TextInput({ field, value, onChange }: TextInputProps) {
  return (
    <Field
      label={field.label}
      required={field.required}
      description={field.description}
    >
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </Field>
  );
}
