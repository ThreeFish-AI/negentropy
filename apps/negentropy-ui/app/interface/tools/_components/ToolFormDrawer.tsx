/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import {
  useState,
  useEffect,
  useId,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { BaseDrawer } from "@/components/ui/BaseDrawer";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";

interface BuiltinTool {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  tool_type: string;
  version: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  config_schema: Record<string, unknown>;
  is_enabled: boolean;
  is_system: boolean;
}

interface ToolFormDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  tool: BuiltinTool | null;
}

interface FieldSchema {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  minimum?: number;
  maximum?: number;
}

const EMPTY_FORM = {
  name: "",
  display_name: "",
  description: "",
  tool_type: "search",
  version: "1.0.0",
  visibility: "private",
  is_enabled: true,
};

export function ToolFormDrawer({
  open,
  onClose,
  onSubmit,
  tool,
}: ToolFormDrawerProps) {
  const formId = useId();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [configFields, setConfigFields] = useState<Record<string, unknown>>({});
  const [credentialFields, setCredentialFields] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency_ms?: number } | null>(null);

  // ── 脏检基线 ──
  const [baseline, setBaseline] = useState({
    form: EMPTY_FORM,
    config: {} as Record<string, unknown>,
    credentials: {} as Record<string, unknown>,
  });
  const isDirty = useMemo(
    () =>
      JSON.stringify(formData) !== JSON.stringify(baseline.form) ||
      JSON.stringify(configFields) !== JSON.stringify(baseline.config) ||
      JSON.stringify(credentialFields) !== JSON.stringify(baseline.credentials),
    [formData, configFields, credentialFields, baseline],
  );

  const { confirm, confirmDialog } = useConfirmDialog();
  const confirmingRef = useRef(false);

  const requestClose = useCallback(async () => {
    if (confirmingRef.current) return;
    if (!isDirty) {
      onClose();
      return;
    }
    confirmingRef.current = true;
    const ok = await confirm({
      title: "Discard changes?",
      message: "You have unsaved changes. Closing now will discard them.",
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
      destructive: true,
    });
    confirmingRef.current = false;
    if (ok) onClose();
  }, [isDirty, confirm, onClose]);

  // Escape 键关闭（脏检确认）
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") void requestClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, requestClose]);

  const configSchema = (tool?.config_schema || {}) as Record<string, Record<string, FieldSchema>>;
  const configFieldDefs = configSchema.config || {};
  const credentialFieldDefs = configSchema.credentials || {};

  useEffect(() => {
    if (tool) {
      const seeded = {
        name: tool.name,
        display_name: tool.display_name || "",
        description: tool.description || "",
        tool_type: tool.tool_type,
        version: tool.version,
        visibility: "private" as const,
        is_enabled: tool.is_enabled,
      };
      setFormData(seeded);
      setConfigFields(tool.config || {});
      setCredentialFields(tool.credentials || {});
      setBaseline({ form: seeded, config: tool.config || {}, credentials: tool.credentials || {} });
    } else {
      setFormData(EMPTY_FORM);
      setConfigFields({});
      setCredentialFields({});
      setBaseline({ form: EMPTY_FORM, config: {}, credentials: {} });
    }
    setTestResult(null);
  }, [tool, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {
        display_name: formData.display_name || null,
        description: formData.description || null,
        tool_type: formData.tool_type,
        version: formData.version,
        is_enabled: formData.is_enabled,
        visibility: formData.visibility,
        config: configFields,
        credentials: credentialFields,
      };
      if (!tool) {
        data.name = formData.name;
      }
      await onSubmit(data);
      setBaseline({ form: formData, config: configFields, credentials: credentialFields });
    } catch {
      // onSubmit already handles toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!tool) return;
    setTesting(true);
    setTestResult(null);
    try {
      const testResponse = await fetch(`/api/interface/tools/${tool.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: configFields, credentials: credentialFields }),
      });
      const result = await testResponse.json();
      setTestResult(result);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test failed";
      setTestResult({ success: false, message });
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const renderDynamicField = (
    key: string,
    schema: FieldSchema,
    value: unknown,
    onChange: (key: string, value: unknown) => void,
    isPassword = false,
  ) => {
    const inputType = isPassword || schema.type === "password" ? "password" : schema.type === "number" || schema.type === "integer" ? "number" : "text";
    const step = schema.type === "number" ? "0.1" : undefined;
    const min = schema.minimum;
    const max = schema.maximum;

    return (
      <div key={key}>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {schema.title || key}
          {schema.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {schema.description && (
          <p className="text-xs text-text-muted mb-1">{schema.description}</p>
        )}
        <input
          type={inputType}
          value={value === undefined || value === null ? String(schema.default ?? "") : String(value)}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            let val: unknown = e.target.value;
            if (inputType === "number") {
              val = e.target.value === "" ? "" : Number(e.target.value);
            }
            onChange(key, val);
          }}
          className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
        />
      </div>
    );
  };

  return (
    <>
      <BaseDrawer
        open={open}
        title={tool ? `Edit Tool: ${tool.display_name || tool.name}` : "Add Tool"}
        subtitle="Configure tool credentials and runtime parameters."
        onClose={() => void requestClose()}
        closeOnBackdrop={!submitting}
        closeOnEscape={false}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div>
              {tool && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing || submitting}
                  loading={testing}
                >
                  Test Connection
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={() => void requestClose()}>
                Cancel
              </Button>
              <Button
                type="submit"
                form={formId}
                variant="neutral"
                disabled={submitting}
              >
                {submitting ? "Saving..." : tool ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-6 px-5 py-5">
          {/* 基本信息 */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Basic Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {!tool && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                    placeholder="e.g. google_search"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                  placeholder="e.g. Google Search"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Tool Type
                </label>
                <select
                  value={formData.tool_type}
                  onChange={(e) => setFormData({ ...formData, tool_type: e.target.value })}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                  disabled={!!tool}
                >
                  <option value="search">Search</option>
                  <option value="retrieval">Retrieval</option>
                  <option value="custom">Custom</option>
                  <option value="claude_code">Agent</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                  rows={2}
                  placeholder="Tool description"
                />
              </div>
            </div>
          </section>

          {/* 凭证字段 */}
          {Object.keys(credentialFieldDefs).length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Credentials
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(credentialFieldDefs).map(([key, schema]) =>
                  renderDynamicField(key, schema, credentialFields[key], (k, v) =>
                    setCredentialFields((prev) => ({ ...prev, [k]: v })),
                  ),
                )}
              </div>
            </section>
          )}

          {/* 配置字段 */}
          {Object.keys(configFieldDefs).length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Configuration
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(configFieldDefs).map(([key, schema]) =>
                  renderDynamicField(key, schema, configFields[key], (k, v) =>
                    setConfigFields((prev) => ({ ...prev, [k]: v })),
                  ),
                )}
              </div>
            </section>
          )}

          {/* 测试结果 */}
          {testResult && (
            <div
              className={`rounded-md p-3 text-sm ${
                testResult.success
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {testResult.message}
              {testResult.success && testResult.latency_ms !== undefined && (
                <span className="ml-2 text-xs opacity-70">({testResult.latency_ms}ms)</span>
              )}
            </div>
          )}
        </form>
      </BaseDrawer>
      {confirmDialog}
    </>
  );
}
