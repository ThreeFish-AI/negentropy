"use client";

import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { PayloadFieldSchema } from "@/features/scheduler";

interface ManifestFieldProps {
  field: PayloadFieldSchema;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
  disabled?: boolean;
}

/**
 * 单个 Manifest payload 字段渲染器。
 * 按 PayloadFieldSchema.type 映射到对应的表单控件。
 */
export function ManifestField({ field, value, onChange, disabled }: ManifestFieldProps) {
  const handleChange = (v: unknown) => onChange(field.name, v);

  if (field.type === "boolean") {
    return (
      <Field variant="check" label={field.label} required={field.required}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => handleChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-border text-foreground focus:ring-ring"
        />
      </Field>
    );
  }

  if (field.type === "enum" && field.enum_options) {
    return (
      <Field label={field.label} required={field.required} description={field.help_text}>
        <Select
          value={String(value ?? "")}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">—</option>
          {field.enum_options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (field.type === "integer") {
    return (
      <Field label={field.label} required={field.required}>
        <Input
          type="number"
          step={1}
          value={value != null ? String(value) : ""}
          onChange={(e) =>
            handleChange(e.target.value === "" ? null : parseInt(e.target.value, 10))
          }
          disabled={disabled}
          placeholder={field.help_text}
        />
      </Field>
    );
  }

  if (field.type === "number") {
    return (
      <Field label={field.label} required={field.required}>
        <Input
          type="number"
          step="any"
          value={value != null ? String(value) : ""}
          onChange={(e) =>
            handleChange(e.target.value === "" ? null : parseFloat(e.target.value))
          }
          disabled={disabled}
          placeholder={field.help_text}
        />
      </Field>
    );
  }

  // default: string
  return (
    <Field label={field.label} required={field.required}>
      <Input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder={field.help_text}
      />
    </Field>
  );
}
