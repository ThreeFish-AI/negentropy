"use client";

import { useState, useMemo, useCallback } from "react";
import { Loader2, Play, ChevronRight } from "lucide-react";
import { ApiEndpoint, InteractiveFormConfig, FormFieldConfig } from "@/features/knowledge/utils/api-specs";
import { FormFieldRenderer } from "./FormFieldRenderer";
import { executeApiCall } from "./utils/ApiExecutor";

interface DynamicApiFormProps {
  endpoint: ApiEndpoint;
  config: InteractiveFormConfig;
  onSubmit: (result: unknown) => void;
  onError: (error: string) => void;
  onLoadingChange: (loading: boolean) => void;
  loading: boolean;
}

/**
 * 初始化表单值
 */
function initFormValues(fields: FormFieldConfig[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue;
    } else if (field.type === "checkbox") {
      values[field.name] = false;
    } else if (field.type === "json") {
      values[field.name] = undefined;
    } else {
      values[field.name] = "";
    }
  }
  return values;
}

/**
 * 检查是否可以提交
 */
function canSubmit(
  fields: FormFieldConfig[],
  values: Record<string, unknown>,
): boolean {
  for (const field of fields) {
    if (field.required) {
      const value = values[field.name];
      if (value === undefined || value === null || value === "") {
        return false;
      }
    }
  }
  return true;
}

export function DynamicApiForm({
  endpoint,
  config,
  onSubmit,
  onError,
  onLoadingChange,
  loading,
}: DynamicApiFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    initFormValues(config.fields),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // 分离 basic 和 advanced 字段
  const { basicFields, advancedFields } = useMemo(() => {
    const basic: FormFieldConfig[] = [];
    const advanced: FormFieldConfig[] = [];

    for (const field of config.fields) {
      if (field.group === "advanced") {
        advanced.push(field);
      } else {
        basic.push(field);
      }
    }

    return { basicFields: basic, advancedFields: advanced };
  }, [config.fields]);

  const handleChange = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = async () => {
    // 如果有确认对话框配置，先显示确认对话框
    if (config.confirmDialog && !showConfirmDialog) {
      setShowConfirmDialog(true);
      return;
    }

    setShowConfirmDialog(false);
    onLoadingChange(true);

    try {
      const result = await executeApiCall(endpoint, values);
      onSubmit(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onLoadingChange(false);
    }
  };

  const handleConfirm = () => {
    handleSubmit();
  };

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
  };

  const isSubmittable = canSubmit(config.fields, values);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          交互式调用
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          填写参数后点击执行，直接调用 {endpoint.summary} API
        </p>

        <div className="mt-4 space-y-3">
          {/* 基础字段 */}
          {basicFields.map((field) => (
            <FormFieldRenderer
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(val) => handleChange(field.name, val)}
            />
          ))}

          {/* 高级配置（可折叠） */}
          {advancedFields.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <span>高级配置</span>
                <ChevronRight
                  className={`ml-1 h-3 w-3 transform transition-transform ${
                    showAdvanced ? "rotate-90" : ""
                  }`}
                />
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
                  {advancedFields.map((field) => (
                    <FormFieldRenderer
                      key={field.name}
                      field={field}
                      value={values[field.name]}
                      onChange={(val) => handleChange(field.name, val)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            onClick={handleSubmit}
            disabled={!isSubmittable || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                执行中...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                {config.submitLabel || "执行"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 确认对话框 */}
      {showConfirmDialog && config.confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {config.confirmDialog.title}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {config.confirmDialog.message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleCancelConfirm}
                className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
