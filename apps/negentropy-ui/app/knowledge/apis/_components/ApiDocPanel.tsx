"use client";

import { ApiEndpoint, getMethodColor } from "@/features/knowledge/utils/api-specs";
import { TextTooltip } from "@/components/ui/TextTooltip";
import { CodeExample } from "./CodeExample";

interface ApiDocPanelProps {
  endpoint: ApiEndpoint;
}

export function ApiDocPanel({ endpoint }: ApiDocPanelProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${getMethodColor(
              endpoint.method
            )}`}
          >
            {endpoint.method}
          </span>
          <code className="text-sm font-mono text-foreground">
            {endpoint.path}
          </code>
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          {endpoint.summary}
        </h3>
        <p className="text-sm text-text-secondary">
          {endpoint.description}
        </p>
      </div>

      {/* Parameters */}
      {endpoint.parameters.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            参数
          </h4>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full table-fixed text-sm">
              {/* 固定列宽（合计 100%）：名称 20 · 位置 10 · 类型 16 · 必填 8 · 描述 46。
                  5 列须与下方 5 个 <th> 严格对齐；colgroup 内不得夹带空白文本节点。 */}
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[8%]" />
                <col className="w-[46%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-overline text-text-secondary">
                  <th className="px-4 py-2.5 font-medium">名称</th>
                  <th className="px-4 py-2.5 font-medium">位置</th>
                  <th className="px-4 py-2.5 font-medium">类型</th>
                  <th className="px-4 py-2.5 font-medium">必填</th>
                  <th className="px-4 py-2.5 font-medium">描述</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.parameters.map((param) => (
                  <tr
                    key={param.name}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <TextTooltip content={param.name}>
                        <span className="block truncate font-mono text-xs text-foreground">
                          {param.name}
                        </span>
                      </TextTooltip>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      <TextTooltip content={param.in}>
                        <span className="block truncate">{param.in}</span>
                      </TextTooltip>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      <TextTooltip
                        content={`${param.type}${param.enum ? ` (${param.enum.join(", ")})` : ""}`}
                      >
                        <span className="block truncate">
                          {param.type}
                          {param.enum && (
                            <span className="text-text-muted">
                              {" "}({param.enum.join(", ")})
                            </span>
                          )}
                        </span>
                      </TextTooltip>
                    </td>
                    <td className="px-4 py-3">
                      {param.required ? (
                        <span className="text-rose-500">是</span>
                      ) : (
                        <span className="text-text-muted">否</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      <TextTooltip
                        content={`${param.description}${param.default !== undefined ? ` (默认: ${String(param.default)})` : ""}`}
                      >
                        <span className="block truncate">
                          {param.description}
                          {param.default !== undefined && (
                            <span className="text-text-muted">
                              {" "}(默认: {String(param.default)})
                            </span>
                          )}
                        </span>
                      </TextTooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Body */}
      {endpoint.requestBody && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            请求体
          </h4>
          <div className="space-y-2">
            <p className="text-xs text-text-muted">
              Content-Type: {endpoint.requestBody.contentType}
            </p>
            <div className="overflow-hidden rounded-lg border border-border bg-muted p-3">
              <pre className="text-xs text-text-secondary">
                {JSON.stringify(endpoint.requestBody.example, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Responses */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          响应
        </h4>
        <div className="space-y-2">
          {endpoint.responses.map((response) => (
            <div
              key={response.status}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                  response.status >= 200 && response.status < 300
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : response.status >= 400 && response.status < 500
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                }`}
              >
                {response.status}
              </span>
              <span className="text-xs text-text-secondary">
                {response.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Code Examples */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          代码示例
        </h4>
        <CodeExample examples={endpoint.examples} />
      </div>
    </div>
  );
}
