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
          <code className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
            {endpoint.path}
          </code>
        </div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {endpoint.summary}
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {endpoint.description}
        </p>
      </div>

      {/* Parameters */}
      {endpoint.parameters.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            参数
          </h4>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    名称
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    位置
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    类型
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    必填
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    描述
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {endpoint.parameters.map((param) => (
                  <tr
                    key={param.name}
                    className="bg-white dark:bg-zinc-900"
                  >
                    <td className="px-3 py-2 font-mono text-zinc-900 dark:text-zinc-100">
                      {param.name}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {param.in}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {param.type}
                      {param.enum && (
                        <span className="ml-1 text-zinc-400">
                          ({param.enum.join(", ")})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {param.required ? (
                        <span className="text-rose-500">是</span>
                      ) : (
                        <span className="text-zinc-400">否</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {param.description}
                      {param.default !== undefined && (
                        <span className="ml-1 text-zinc-400">
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
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            请求体
          </h4>
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Content-Type: {endpoint.requestBody.contentType}
            </p>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
              <pre className="text-xs text-zinc-700 dark:text-zinc-300">
                {JSON.stringify(endpoint.requestBody.example, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Responses */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          响应
        </h4>
        <div className="space-y-2">
          {endpoint.responses.map((response) => (
            <div
              key={response.status}
              className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
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
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {response.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Code Examples */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          代码示例
        </h4>
        <CodeExample examples={endpoint.examples} />
      </div>
    </div>
  );
}
