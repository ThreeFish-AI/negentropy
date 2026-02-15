"use client";

import { FormFieldConfig } from "@/features/knowledge/utils/api-specs";
import {
  TextInput,
  TextareaInput,
  NumberInput,
  SelectInput,
  CheckboxInput,
  JsonInput,
  CorpusSelect,
} from "./form-fields";

interface FormFieldRendererProps {
  field: FormFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function FormFieldRenderer({
  field,
  value,
  onChange,
}: FormFieldRendererProps) {
  switch (field.type) {
    case "text":
      return (
        <TextInput
          field={field}
          value={(value as string) ?? ""}
          onChange={(val) => onChange(val)}
        />
      );

    case "textarea":
      return (
        <TextareaInput
          field={field}
          value={(value as string) ?? ""}
          onChange={(val) => onChange(val)}
        />
      );

    case "number":
      return (
        <NumberInput
          field={field}
          value={value as number | undefined}
          onChange={(val) => onChange(val)}
        />
      );

    case "select":
      return (
        <SelectInput
          field={field}
          value={(value as string) ?? field.defaultValue?.toString() ?? ""}
          onChange={(val) => onChange(val)}
        />
      );

    case "checkbox":
      return (
        <CheckboxInput
          field={field}
          value={(value as boolean) ?? false}
          onChange={(val) => onChange(val)}
        />
      );

    case "json":
      return (
        <JsonInput
          field={field}
          value={value as Record<string, unknown> | undefined}
          onChange={(val) => onChange(val)}
        />
      );

    case "corpus_select":
      return (
        <CorpusSelect
          field={field}
          value={(value as string) ?? ""}
          onChange={(val) => onChange(val)}
        />
      );

    default:
      return null;
  }
}
