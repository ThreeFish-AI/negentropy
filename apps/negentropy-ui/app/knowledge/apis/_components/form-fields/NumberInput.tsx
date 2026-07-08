"use client";

import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";

interface NumberInputProps {
  field: FormFieldConfig;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

export function NumberInput({ field, value, onChange }: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      onChange(undefined);
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        onChange(num);
      }
    }
  };

  return (
    <Field
      label={field.label}
      required={field.required}
      description={field.description}
    >
      <Input
        type="number"
        value={value ?? ""}
        onChange={handleChange}
        min={field.min}
        max={field.max}
        step={field.max && field.max < 10 ? 0.01 : 1}
        placeholder={field.placeholder}
        className="tabular-nums"
      />
    </Field>
  );
}
