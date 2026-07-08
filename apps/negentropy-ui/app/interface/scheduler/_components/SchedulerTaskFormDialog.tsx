"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type {
  ScheduledTaskDTO,
  HandlerDescriptor,
  TaskWritePayload,
  TriggerType,
} from "@/features/scheduler";
import { fetchHandlers } from "@/features/scheduler";
import { ManifestField } from "./ManifestField";

interface SchedulerTaskFormDialogProps {
  open: boolean;
  task: ScheduledTaskDTO | null; // null = create, object = edit
  onClose: () => void;
  onSubmit: (mode: "create" | "edit", id: string | null, body: TaskWritePayload) => Promise<void>;
}

type FormState = {
  key: string;
  handler_kind: string;
  trigger_type: TriggerType;
  interval_seconds: string;
  cron_expr: string;
  enabled: boolean;
  display_name: string;
  description: string;
  role: string;
  scenario: string;
  category: string;
  max_concurrency: string;
  token_budget: string;
};

const EMPTY_FORM: FormState = {
  key: "",
  handler_kind: "",
  trigger_type: "interval",
  interval_seconds: "60",
  cron_expr: "",
  enabled: true,
  display_name: "",
  description: "",
  role: "",
  scenario: "",
  category: "",
  max_concurrency: "1",
  token_budget: "",
};

export function SchedulerTaskFormDialog({
  open,
  task,
  onClose,
  onSubmit,
}: SchedulerTaskFormDialogProps) {
  const isEdit = task !== null;
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [payloadValues, setPayloadValues] = useState<Record<string, unknown>>({});
  const [payloadJsonText, setPayloadJsonText] = useState("{}");
  const [payloadMode, setPayloadMode] = useState<"form" | "json">("form");
  const [handlers, setHandlers] = useState<HandlerDescriptor[]>([]);
  const [loadingHandlers, setLoadingHandlers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch handler manifest on open
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoadingHandlers(true);
      try {
        const res = await fetchHandlers();
        if (mounted) setHandlers(res.items);
      } catch {
        // fallback: empty handlers → JSON mode only
        if (mounted) setHandlers([]);
      } finally {
        if (mounted) setLoadingHandlers(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open]);

  // Reset/populate form on task change
  useEffect(() => {
    if (!open) return;

    const resetState = task
      ? {
          key: task.key,
          handler_kind: task.handler_kind,
          trigger_type: task.trigger_type,
          interval_seconds: task.interval_seconds != null ? String(task.interval_seconds) : "",
          cron_expr: task.cron_expr || "",
          enabled: task.enabled,
          display_name: task.display_name || "",
          description: task.description || "",
          role: task.role || "",
          scenario: task.scenario || "",
          category: task.category || "",
          max_concurrency: String(task.max_concurrency),
          token_budget: task.token_budget != null ? String(task.token_budget) : "",
        }
      : EMPTY_FORM;
    const resetPayload = task ? (task.payload || {}) : {};
    const resetJson = task ? JSON.stringify(task.payload || {}, null, 2) : "{}";

    queueMicrotask(() => {
      setError(null);
      setFieldErrors({});
      setFormData(resetState);
      setPayloadValues(resetPayload);
      setPayloadJsonText(resetJson);
      setPayloadMode("form");
    });
  }, [task, open]);

  // Get current handler descriptor
  const currentDescriptor = handlers.find((h) => h.handler_kind === formData.handler_kind);

  // When handler changes, reset payload
  useEffect(() => {
    if (!open || !handlers.length) return;
    const desc = handlers.find((h) => h.handler_kind === formData.handler_kind);
    if (!desc) return;

    // Set defaults from schema
    const defaults: Record<string, unknown> = {};
    for (const f of desc.payload_fields) {
      if (f.default !== undefined && f.default !== null) {
        defaults[f.name] = f.default;
      }
    }
    // Merge with existing only if creating or handler matches task's handler
    if (!task || task.handler_kind !== formData.handler_kind) {
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setPayloadValues(defaults);
        setPayloadJsonText(JSON.stringify(defaults, null, 2));
      });
    }

    // Adjust trigger_type if not supported
    if (desc.trigger_types.length > 0 && !desc.trigger_types.includes(formData.trigger_type)) {
      const fallback = (desc.default_trigger_type && desc.trigger_types.includes(desc.default_trigger_type as TriggerType))
        ? (desc.default_trigger_type as TriggerType)
        : desc.trigger_types[0];
      queueMicrotask(() => {
        setFormData((prev) => ({
          ...prev,
          trigger_type: fallback,
        }));
      });
    }
  }, [formData.handler_kind, formData.trigger_type, handlers, open, task]);

  const updateField = useCallback((key: keyof FormState, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Get visible payload fields based on discriminator
  const visibleFields = currentDescriptor
    ? currentDescriptor.payload_fields.filter((f) => {
        if (!f.applies_when || !currentDescriptor.discriminator_field) return true;
        const discValue = payloadValues[currentDescriptor.discriminator_field];
        return discValue != null && f.applies_when.includes(String(discValue));
      })
    : [];

  // All payload field names (including non-visible) for known-set check
  const allFieldNames = new Set((currentDescriptor?.payload_fields || []).map((f) => f.name));

  const handlePayloadChange = useCallback((name: string, value: unknown) => {
    setPayloadValues((prev) => {
      const next = { ...prev, [name]: value };
      setPayloadJsonText(JSON.stringify(next, null, 2));
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};

    // Validate key (create only)
    if (!isEdit && !formData.key.trim()) {
      errors.key = "Key is required";
    }
    if (!formData.handler_kind) {
      errors.handler_kind = "Handler is required";
    }
    // Trigger consistency
    if (formData.trigger_type === "interval") {
      const val = parseFloat(formData.interval_seconds);
      if (!val || val <= 0) errors.interval_seconds = "Must be > 0";
    }
    if (formData.trigger_type === "cron") {
      if (!formData.cron_expr.trim()) errors.cron_expr = "Cron expression is required";
    }
    // Max concurrency
    if (formData.max_concurrency && parseInt(formData.max_concurrency, 10) < 1) {
      errors.max_concurrency = "Must be ≥ 1";
    }
    // Token budget
    if (formData.token_budget && parseInt(formData.token_budget, 10) < 0) {
      errors.token_budget = "Must be ≥ 0";
    }
    // Payload validation
    let finalPayload: Record<string, unknown>;
    if (payloadMode === "json") {
      try {
        finalPayload = JSON.parse(payloadJsonText) as Record<string, unknown>;
      } catch (err) {
        errors.payloadJson = err instanceof Error ? err.message : "Invalid JSON";
        finalPayload = {};
      }
    } else {
      // Form mode: validate required visible fields
      for (const f of visibleFields) {
        if (f.required && (payloadValues[f.name] === undefined || payloadValues[f.name] === "" || payloadValues[f.name] === null)) {
          errors[`payload_${f.name}`] = `${f.label} is required`;
        }
      }
      // Trim: only send visible + known fields
      finalPayload = {};
      for (const [k, v] of Object.entries(payloadValues)) {
        if (allFieldNames.has(k) || !currentDescriptor) {
          finalPayload[k] = v;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Fix the highlighted fields before saving.");
      setLoading(false);
      return;
    }

    const body: TaskWritePayload = {
      handler_kind: formData.handler_kind,
      trigger_type: formData.trigger_type,
      interval_seconds: formData.trigger_type === "interval" ? parseFloat(formData.interval_seconds) || null : null,
      cron_expr: formData.trigger_type === "cron" ? formData.cron_expr || null : null,
      enabled: formData.enabled,
      display_name: formData.display_name || null,
      description: formData.description || null,
      role: formData.role || null,
      scenario: formData.scenario || null,
      category: formData.category || null,
      payload: finalPayload,
      max_concurrency: parseInt(formData.max_concurrency, 10) || 1,
      token_budget: formData.token_budget ? parseInt(formData.token_budget, 10) : null,
    };
    if (!isEdit) {
      body.key = formData.key.trim();
    }

    try {
      await onSubmit(isEdit ? "edit" : "create", isEdit ? task.id : null, body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const sectionTitleCls = "text-micro uppercase tracking-overline text-text-muted mb-2";

  return (
    <OverlayDismissLayer
      open={open}
      onClose={onClose}
      busy={loading}
      containerClassName="flex min-h-full items-start justify-center overflow-y-auto p-3 sm:p-6"
      contentClassName="my-3 flex max-h-[calc(100vh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-modal border border-border bg-card shadow-xl sm:max-h-[calc(100vh-2rem)]"
    >
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isEdit ? "Edit Task" : "New Task"}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {isEdit ? `Editing "${task.display_name || task.key}"` : "Create a new scheduled task definition"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Error banner */}
          {error && <ErrorBanner message={error} />}

          {/* Basic Info */}
          <section>
            <h3 className={sectionTitleCls}>Basic</h3>
            <div className="space-y-3">
              {isEdit ? (
                <Field label="Key" description="Key cannot be changed after creation">
                  <Input type="text" value={formData.key} disabled />
                </Field>
              ) : (
                <Field label="Key" required error={fieldErrors.key}>
                  <Input
                    type="text"
                    value={formData.key}
                    onChange={(e) => updateField("key", e.target.value)}
                    placeholder="unique_task_key"
                    className={fieldErrors.key ? "border-error focus:ring-error/60" : undefined}
                  />
                </Field>
              )}

              <Field label="Handler" required error={fieldErrors.handler_kind}>
                <Select
                  value={formData.handler_kind}
                  onChange={(e) => updateField("handler_kind", e.target.value)}
                  disabled={isEdit || loadingHandlers}
                  className={fieldErrors.handler_kind ? "border-error focus:ring-error/60" : undefined}
                >
                  <option value="">— Select handler —</option>
                  {handlers.map((h) => (
                    <option key={h.handler_kind} value={h.handler_kind}>
                      {h.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Display Name">
                <Input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => updateField("display_name", e.target.value)}
                  placeholder="Human-readable name"
                />
              </Field>

              <Field label="Description">
                <Textarea
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="What this task does"
                  rows={2}
                />
              </Field>

              <Field variant="check" label="Enabled">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => updateField("enabled", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
              </Field>
            </div>
          </section>

          {/* Schedule */}
          <section>
            <h3 className={sectionTitleCls}>Schedule</h3>
            <div className="space-y-3">
              <Field label="Trigger Type">
                <Select
                  value={formData.trigger_type}
                  onChange={(e) => updateField("trigger_type", e.target.value)}
                >
                  {(currentDescriptor?.trigger_types || ["interval", "cron", "oneshot"]).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              {formData.trigger_type === "interval" && (
                <Field label="Interval (seconds)" required error={fieldErrors.interval_seconds}>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={formData.interval_seconds}
                    onChange={(e) => updateField("interval_seconds", e.target.value)}
                    placeholder="60"
                    className={fieldErrors.interval_seconds ? "border-error focus:ring-error/60" : undefined}
                  />
                </Field>
              )}
              {formData.trigger_type === "cron" && (
                <Field
                  label="Cron Expression"
                  required
                  error={fieldErrors.cron_expr}
                  description="5-field POSIX cron: min hour day month weekday"
                >
                  <Input
                    type="text"
                    value={formData.cron_expr}
                    onChange={(e) => updateField("cron_expr", e.target.value)}
                    placeholder="0 * * * *"
                    className={`font-mono ${fieldErrors.cron_expr ? "border-error focus:ring-error/60" : ""}`}
                  />
                </Field>
              )}
            </div>
          </section>

          {/* Metadata */}
          <section>
            <h3 className={sectionTitleCls}>Metadata</h3>
            <div className="space-y-3">
              <Field label="Role">
                <Input
                  type="text"
                  value={formData.role}
                  onChange={(e) => updateField("role", e.target.value)}
                  placeholder="e.g. sentinel"
                />
              </Field>
              <Field label="Scenario">
                <Input
                  type="text"
                  value={formData.scenario}
                  onChange={(e) => updateField("scenario", e.target.value)}
                  placeholder="e.g. maintenance"
                />
              </Field>
              <Field label="Category">
                <Input
                  type="text"
                  value={formData.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  placeholder="e.g. maintenance"
                />
              </Field>
              <Field label="Max Concurrency" error={fieldErrors.max_concurrency}>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={formData.max_concurrency}
                  onChange={(e) => updateField("max_concurrency", e.target.value)}
                  className={fieldErrors.max_concurrency ? "border-error focus:ring-error/60" : undefined}
                />
              </Field>
              {currentDescriptor?.supports_token_budget && (
                <Field label="Token Budget">
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.token_budget}
                    onChange={(e) => updateField("token_budget", e.target.value)}
                    placeholder="e.g. 100000"
                  />
                </Field>
              )}
            </div>
          </section>

          {/* Payload */}
          {currentDescriptor && currentDescriptor.payload_fields.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className={sectionTitleCls}>Payload</h3>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPayloadMode("form")}
                    className={`cursor-pointer rounded px-2 py-0.5 text-micro font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      payloadMode === "form"
                        ? "bg-muted text-foreground"
                        : "text-text-muted hover:text-foreground"
                    }`}
                  >
                    Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayloadMode("json")}
                    className={`cursor-pointer rounded px-2 py-0.5 text-micro font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      payloadMode === "json"
                        ? "bg-muted text-foreground"
                        : "text-text-muted hover:text-foreground"
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>

              {payloadMode === "form" ? (
                <div className="space-y-3">
                  {currentDescriptor.payload_fields.map((f) => {
                    // Check visibility via discriminator
                    if (f.applies_when && currentDescriptor.discriminator_field) {
                      const discValue = payloadValues[currentDescriptor.discriminator_field];
                      if (discValue == null || !f.applies_when.includes(String(discValue))) return null;
                    }
                    return (
                      <div key={f.name}>
                        <ManifestField
                          field={f}
                          value={payloadValues[f.name]}
                          onChange={handlePayloadChange}
                        />
                        {fieldErrors[`payload_${f.name}`] && (
                          <p className="mt-0.5 text-micro text-red-500">
                            {fieldErrors[`payload_${f.name}`]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <Textarea
                    value={payloadJsonText}
                    onChange={(e) => setPayloadJsonText(e.target.value)}
                    rows={6}
                    className={`font-mono text-xs ${
                      fieldErrors.payloadJson ? "border-error focus:ring-error/60" : ""
                    }`}
                  />
                  {fieldErrors.payloadJson && (
                    <p className="mt-0.5 text-micro text-red-500">{fieldErrors.payloadJson}</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Fallback JSON for handlers without manifest */}
          {(!currentDescriptor || currentDescriptor.payload_fields.length === 0) && !loadingHandlers && formData.handler_kind && (
            <section>
              <h3 className={sectionTitleCls}>Payload (JSON)</h3>
              <Textarea
                value={payloadJsonText}
                onChange={(e) => setPayloadJsonText(e.target.value)}
                rows={4}
                className="font-mono text-xs"
                placeholder="{}"
              />
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="neutral" size="sm" disabled={loading || loadingHandlers}>
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      </form>
    </OverlayDismissLayer>
  );
}
