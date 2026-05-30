"use client";

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
  const inputCls =
    "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
  const labelCls = "mb-1 block text-xs font-medium text-text-secondary";

  const handleChange = (v: unknown) => onChange(field.name, v);

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => handleChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-border text-foreground focus:ring-ring"
        />
        <span className={labelCls}>
          {field.label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      </label>
    );
  }

  if (field.type === "enum" && field.enum_options) {
    return (
      <div>
        <label className={labelCls}>
          {field.label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <select
          value={String(value ?? "")}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className={inputCls}
        >
          <option value="">—</option>
          {field.enum_options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {field.help_text && (
          <p className="mt-0.5 text-micro text-text-muted">{field.help_text}</p>
        )}
      </div>
    );
  }

  if (field.type === "integer") {
    return (
      <div>
        <label className={labelCls}>
          {field.label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <input
          type="number"
          step={1}
          value={value != null ? String(value) : ""}
          onChange={(e) => handleChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
          disabled={disabled}
          placeholder={field.help_text}
          className={inputCls}
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        <label className={labelCls}>
          {field.label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <input
          type="number"
          step="any"
          value={value != null ? String(value) : ""}
          onChange={(e) => handleChange(e.target.value === "" ? null : parseFloat(e.target.value))}
          disabled={disabled}
          placeholder={field.help_text}
          className={inputCls}
        />
      </div>
    );
  }

  // default: string
  return (
    <div>
      <label className={labelCls}>
        {field.label}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder={field.help_text}
        className={inputCls}
      />
    </div>
  );
}
