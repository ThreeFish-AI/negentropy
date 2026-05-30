"use client";

import { ApiEndpoint, getMethodColor } from "@/features/knowledge/utils/api-specs";
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
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    名称
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    位置
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    类型
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    必填
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    描述
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {endpoint.parameters.map((param) => (
                  <tr
                    key={param.name}
                    className="bg-card"
                  >
                    <td className="px-3 py-2 font-mono text-foreground">
                      {param.name}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {param.in}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {param.type}
                      {param.enum && (
                        <span className="ml-1 text-text-muted">
                          ({param.enum.join(", ")})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {param.required ? (
                        <span className="text-rose-500">是</span>
                      ) : (
                        <span className="text-text-muted">否</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {param.description}
                      {param.default !== undefined && (
                        <span className="ml-1 text-text-muted">
                          (默认: {String(param.default)})
                        </span>
                      )}
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
