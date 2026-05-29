/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

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

interface ToolFormDialogProps {
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

export function ToolFormDialog({
  open,
  onClose,
  onSubmit,
  tool,
}: ToolFormDialogProps) {
  const emptyForm = {
    name: "",
    display_name: "",
    description: "",
    tool_type: "search",
    version: "1.0.0",
    visibility: "private",
    is_enabled: true,
  };

  const [formData, setFormData] = useState(emptyForm);
  const [configFields, setConfigFields] = useState<Record<string, unknown>>({});
  const [credentialFields, setCredentialFields] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency_ms?: number } | null>(null);

  const configSchema = (tool?.config_schema || {}) as Record<string, Record<string, FieldSchema>>;
  const configFieldDefs = configSchema.config || {};
  const credentialFieldDefs = configSchema.credentials || {};

  useEffect(() => {
    if (tool) {
      setFormData({
        name: tool.name,
        display_name: tool.display_name || "",
        description: tool.description || "",
        tool_type: tool.tool_type,
        version: tool.version,
        visibility: "private",
        is_enabled: tool.is_enabled,
      });
      setConfigFields(tool.config || {});
      setCredentialFields(tool.credentials || {});
    } else {
      setFormData({
        name: "",
        display_name: "",
        description: "",
        tool_type: "search",
        version: "1.0.0",
        visibility: "private",
        is_enabled: true,
      });
      setConfigFields({});
      setCredentialFields({});
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

  if (!open) return null;

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
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {schema.title || key}
          {schema.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {schema.description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{schema.description}</p>
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
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>
    );
  };

  return (
    <OverlayDismissLayer open={open} onClose={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            {tool ? `Edit Tool: ${tool.display_name || tool.name}` : "Add Tool"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 基本信息 */}
            {!tool && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="e.g. google_search"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="e.g. Google Search"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Tool Type
                </label>
                <select
                  value={formData.tool_type}
                  onChange={(e) => setFormData({ ...formData, tool_type: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  disabled={!!tool}
                >
                  <option value="search">Search</option>
                  <option value="retrieval">Retrieval</option>
                  <option value="custom">Custom</option>
                  <option value="claude_code">Agent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                rows={2}
                placeholder="Tool description"
              />
            </div>

            {/* 凭证字段 */}
            {Object.keys(credentialFieldDefs).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                  Credentials
                </h3>
                <div className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
                  {Object.entries(credentialFieldDefs).map(([key, schema]) =>
                    renderDynamicField(key, schema, credentialFields[key], (k, v) =>
                      setCredentialFields((prev) => ({ ...prev, [k]: v })),
                    ),
                  )}
                </div>
              </div>
            )}

            {/* 配置字段 */}
            {Object.keys(configFieldDefs).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                  Configuration
                </h3>
                <div className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
                  {Object.entries(configFieldDefs).map(([key, schema]) =>
                    renderDynamicField(key, schema, configFields[key], (k, v) =>
                      setConfigFields((prev) => ({ ...prev, [k]: v })),
                    ),
                  )}
                </div>
              </div>
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

            {/* 操作按钮 */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {tool && (
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing || submitting}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {testing ? "Testing..." : "Test Connection"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {submitting ? "Saving..." : tool ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </OverlayDismissLayer>
  );
}
