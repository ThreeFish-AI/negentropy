"use client";

import { useState } from "react";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { ApiEndpoint } from "@/features/knowledge/utils/api-specs";
import { DynamicApiForm } from "./DynamicApiForm";

interface TryItPanelProps {
  endpoint: ApiEndpoint;
}

export function TryItPanel({ endpoint }: TryItPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const config = endpoint.interactiveForm;

  // 无配置则显示提示
  if (!config) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-xs text-text-muted">
          此 API 暂不支持交互式调用。请参考代码示例使用。
        </p>
      </div>
    );
  }

  const handleSubmit = (response: unknown) => {
    setResult(response);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <DynamicApiForm
        endpoint={endpoint}
        config={config}
        onSubmit={handleSubmit}
        onError={handleError}
        onLoadingChange={setLoading}
        loading={loading}
      />

      {/* 响应结果 */}
      {(result || error) && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-foreground">
            响应结果
          </h4>
          <div className="mt-3">
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
                {error}
              </div>
            ) : result ? (
              <div className="max-h-80 overflow-auto rounded-lg border border-border bg-muted p-3">
                <JsonViewer data={result} />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
