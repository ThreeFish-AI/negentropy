"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { JsonViewer } from "@/components/ui/JsonViewer";

const MARKDOWN_CONTENT_CLASS = [
  "space-y-2 overflow-hidden break-words whitespace-normal text-sm leading-relaxed",
  "[&>p]:mb-2 [&>p:last-child]:mb-0",
  "[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-blue-400",
  "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
  "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
  "[&_li]:leading-relaxed",
  "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-2",
  "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2",
  "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1",
  "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs dark:[&_code]:bg-zinc-800",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-3 [&_pre]:text-zinc-100 dark:[&_pre]:bg-zinc-900",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-zinc-200 [&_th]:bg-zinc-100 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:text-zinc-700",
  "[&_td]:border [&_td]:border-zinc-200 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:text-zinc-600",
  "dark:[&_th]:border-zinc-700 dark:[&_th]:bg-zinc-800 dark:[&_th]:text-zinc-200",
  "dark:[&_td]:border-zinc-700 dark:[&_td]:text-zinc-300",
].join(" ");

type ParsedContent =
  | { kind: "empty" }
  | { kind: "json"; value: unknown }
  | { kind: "markdown"; value: string };

interface SchemaFieldRow {
  path: string;
  type: string;
  required: boolean;
  description: string;
  constraints: string;
}

interface JsonSchemaNode {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  additionalProperties?: boolean | JsonSchemaNode;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: JsonSchemaNode | JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  anyOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseContent(content: string | null | undefined): ParsedContent {
  if (!content || content.trim().length === 0) {
    return { kind: "empty" };
  }

  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed) || isRecord(parsed)) {
        return { kind: "json", value: parsed };
      }
    } catch {
      // ignore parse error and fallback to markdown rendering
    }
  }

  return { kind: "markdown", value: content };
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getSchemaNode(value: unknown): JsonSchemaNode | null {
  return isRecord(value) ? (value as JsonSchemaNode) : null;
}

function getArrayItemSchema(
  items: JsonSchemaNode | JsonSchemaNode[] | undefined
): JsonSchemaNode | null {
  if (!items) {
    return null;
  }
  if (Array.isArray(items)) {
    const candidate = items.find((item) => isRecord(item));
    return candidate ? (candidate as JsonSchemaNode) : null;
  }
  return isRecord(items) ? (items as JsonSchemaNode) : null;
}

function getComposedNodes(node: JsonSchemaNode): JsonSchemaNode[] {
  return [
    ...(Array.isArray(node.anyOf) ? node.anyOf : []),
    ...(Array.isArray(node.oneOf) ? node.oneOf : []),
    ...(Array.isArray(node.allOf) ? node.allOf : []),
  ];
}

function normalizeType(node: JsonSchemaNode): string {
  if (Array.isArray(node.type) && node.type.length > 0) {
    return node.type.join(" | ");
  }

  if (typeof node.type === "string") {
    if (node.type === "array") {
      const itemSchema = getArrayItemSchema(node.items);
      if (itemSchema) {
        const itemType = normalizeType(itemSchema);
        return itemType === "unknown" ? "array" : `array<${itemType}>`;
      }
    }
    return node.type;
  }

  const composedNodes = getComposedNodes(node);
  if (composedNodes.length > 0) {
    const composedTypes = Array.from(
      new Set(
        composedNodes
          .map((item) => normalizeType(item))
          .filter((item) => item.length > 0 && item !== "unknown")
      )
    );
    if (composedTypes.length > 0) {
      return composedTypes.join(" | ");
    }
  }

  if (node.enum && node.enum.length > 0) {
    return "enum";
  }
  if (isRecord(node.properties)) {
    return "object";
  }
  if (node.items) {
    return "array";
  }
  return "unknown";
}

function buildConstraints(node: JsonSchemaNode): string {
  const parts: string[] = [];
  if (node.format) {
    parts.push(`format: ${node.format}`);
  }
  if (Array.isArray(node.enum) && node.enum.length > 0) {
    parts.push(`enum: ${node.enum.map((item) => formatValue(item)).join(", ")}`);
  }
  if (typeof node.minimum === "number") {
    parts.push(`minimum: ${node.minimum}`);
  }
  if (typeof node.maximum === "number") {
    parts.push(`maximum: ${node.maximum}`);
  }
  if (typeof node.minLength === "number") {
    parts.push(`minLength: ${node.minLength}`);
  }
  if (typeof node.maxLength === "number") {
    parts.push(`maxLength: ${node.maxLength}`);
  }
  if (typeof node.minItems === "number") {
    parts.push(`minItems: ${node.minItems}`);
  }
  if (typeof node.maxItems === "number") {
    parts.push(`maxItems: ${node.maxItems}`);
  }
  if (typeof node.pattern === "string" && node.pattern.length > 0) {
    parts.push(`pattern: ${node.pattern}`);
  }
  if (typeof node.additionalProperties === "boolean") {
    parts.push(`additionalProperties: ${node.additionalProperties}`);
  } else if (isRecord(node.additionalProperties)) {
    parts.push("additionalProperties: object");
  }
  if (node.default !== undefined) {
    parts.push(`default: ${formatValue(node.default)}`);
  }
  return parts.join(" | ");
}

function collectSchemaRows(schema: Record<string, unknown>): SchemaFieldRow[] {
  const root = getSchemaNode(schema);
  if (!root) {
    return [];
  }

  const rows: SchemaFieldRow[] = [];
  const pathSeen = new Set<string>();

  const walkObjectSchema = (node: JsonSchemaNode, basePath = "") => {
    const properties = isRecord(node.properties) ? node.properties : null;
    if (!properties) {
      return;
    }

    const requiredSet = new Set(
      Array.isArray(node.required)
        ? node.required.filter(
            (item): item is string => typeof item === "string" && item.length > 0
          )
        : []
    );

    for (const [fieldName, rawChild] of Object.entries(properties)) {
      const child = getSchemaNode(rawChild);
      if (!child) {
        continue;
      }

      const path = basePath ? `${basePath}.${fieldName}` : fieldName;
      if (!pathSeen.has(path)) {
        pathSeen.add(path);
        rows.push({
          path,
          type: normalizeType(child),
          required: requiredSet.has(fieldName),
          description: child.description ?? "",
          constraints: buildConstraints(child),
        });
      }

      if (isRecord(child.properties)) {
        walkObjectSchema(child, path);
      }

      const arrayItemSchema = getArrayItemSchema(child.items);
      if (arrayItemSchema && isRecord(arrayItemSchema.properties)) {
        walkObjectSchema(arrayItemSchema, `${path}[]`);
      }

      for (const composedSchema of getComposedNodes(child)) {
        if (isRecord(composedSchema.properties)) {
          walkObjectSchema(composedSchema, path);
        }
        const composedItemSchema = getArrayItemSchema(composedSchema.items);
        if (composedItemSchema && isRecord(composedItemSchema.properties)) {
          walkObjectSchema(composedItemSchema, `${path}[]`);
        }
      }
    }
  };

  walkObjectSchema(root);

  if (rows.length === 0) {
    for (const item of getComposedNodes(root)) {
      walkObjectSchema(item);
    }
  }

  return rows;
}

function RichTextContent({
  content,
  emptyText,
}: {
  content: string | null;
  emptyText: string;
}) {
  const parsed = useMemo(() => parseContent(content), [content]);

  if (parsed.kind === "empty") {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyText}</p>
    );
  }

  if (parsed.kind === "json") {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
        <JsonViewer data={parsed.value} />
      </div>
    );
  }

  return (
    <div className={`${MARKDOWN_CONTENT_CLASS} text-zinc-600 dark:text-zinc-300`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.value}</ReactMarkdown>
    </div>
  );
}

function InputSchemaSection({ schema }: { schema: Record<string, unknown> }) {
  const rows = useMemo(() => collectSchemaRows(schema), [schema]);

  if (Object.keys(schema).length === 0) {
    return null;
  }

  const requiredCount = rows.filter((row) => row.required).length;

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          Input Schema
        </span>
        {rows.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {rows.length} fields
          </span>
        )}
        {requiredCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            {requiredCount} required
          </span>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-[640px] w-full text-left text-xs">
            <thead className="bg-zinc-100 dark:bg-zinc-800/70">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">
                  Field
                </th>
                <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">
                  Type
                </th>
                <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">
                  Required
                </th>
                <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">
                  Description
                </th>
                <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">
                  Constraints
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
              {rows.map((row) => (
                <tr key={row.path}>
                  <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-200">
                    {row.path}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.type}
                  </td>
                  <td className="px-3 py-2">
                    {row.required ? (
                      <span className="text-rose-600 dark:text-rose-400">Yes</span>
                    ) : (
                      <span className="text-zinc-400">No</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.description || "-"}
                  </td>
                  <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                    {row.constraints || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Schema structure cannot be flattened. Use raw JSON view below.
        </p>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300">
          Raw JSON
        </summary>
        <div className="mt-2 rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
          <JsonViewer data={schema} />
        </div>
      </details>
    </div>
  );
}

function getToolLabel(tool: McpTool): string {
  return tool.display_name || tool.name;
}

function getToolTooltipText(tool: McpTool): string {
  const text = tool.description?.trim();
  return text && text.length > 0 ? text : "No description";
}

function ToolDetailPanel({ tool }: { tool: McpTool }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {getToolLabel(tool)}
          </h4>
          {tool.display_name && (
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              {tool.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tool.is_enabled ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Enabled
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              Disabled
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {tool.call_count} calls
          </span>
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
        <RichTextContent content={tool.description} emptyText="No description" />
      </div>

      <InputSchemaSection schema={tool.input_schema} />
    </div>
  );
}

interface McpServer {
  id: string;
  owner_id: string;
  visibility: string;
  name: string;
  display_name: string | null;
  description: string | null;
  transport_type: string;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  headers: Record<string, string>;
  is_enabled: boolean;
  auto_start: boolean;
  config: Record<string, unknown>;
  tool_count: number;
}

interface McpTool {
  id: string | null;
  name: string;
  display_name: string | null;
  description: string | null;
  input_schema: Record<string, unknown>;
  is_enabled: boolean;
  call_count: number;
}

interface McpServerCardProps {
  server: McpServer;
  onEdit: () => void;
  onDelete: () => void;
  onLoad: () => void;
  tools?: McpTool[];
  loadingTools?: boolean;
  loadError?: string | null;
}

export function McpServerCard({
  server,
  onEdit,
  onDelete,
  onLoad,
  tools = [],
  loadingTools = false,
  loadError = null,
}: McpServerCardProps) {
  const [showTools, setShowTools] = useState(false);
  const [expandedToolName, setExpandedToolName] = useState<string | null>(null);

  const expandedTool = useMemo(
    () => tools.find((tool) => tool.name === expandedToolName) || null,
    [expandedToolName, tools]
  );

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700/80 dark:from-zinc-900 dark:to-zinc-900">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {server.display_name || server.name}
            </h3>
            {server.is_enabled ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Enabled
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Disabled
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {server.visibility}
            </span>
          </div>
          <div className="mb-2">
            <RichTextContent
              content={server.description}
              emptyText="No description"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
              {server.transport_type}
            </span>
            {server.tool_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {server.tool_count} tools
              </span>
            )}
            {server.auto_start && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Auto-start
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Load 按钮 */}
          <button
            onClick={onLoad}
            disabled={loadingTools}
            className="rounded-md p-2 text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Load Tools from Server"
          >
            {loadingTools ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
          {/* Edit 按钮 */}
          <button
            onClick={onEdit}
            className="rounded-md p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {/* Delete 按钮 */}
          <button
            onClick={onDelete}
            className="rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {loadError && (
        <div className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {loadError}
        </div>
      )}

      {/* Tools 展示区域 */}
      {tools.length > 0 && (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <button
            onClick={() => {
              if (showTools) {
                setExpandedToolName(null);
              }
              setShowTools((prev) => !prev);
            }}
            className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showTools ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {tools.length} Tools Loaded
          </button>

          {showTools && (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Hover to preview description. Click a tool to expand details.
                </p>
                <div className="flex flex-wrap gap-2">
                  {tools.map((tool) => {
                    const isExpanded = expandedToolName === tool.name;

                    return (
                      <div key={tool.name} className="group relative">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedToolName((prev) =>
                              prev === tool.name ? null : tool.name
                            )
                          }
                          aria-expanded={isExpanded}
                          title={getToolTooltipText(tool)}
                          className={`inline-flex items-center rounded-lg border px-3 py-1.5 font-mono text-sm transition-colors ${
                            isExpanded
                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                              : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                          }`}
                        >
                          {getToolLabel(tool)}
                        </button>

                        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-zinc-200 bg-white/95 p-2 text-xs text-zinc-600 shadow-lg backdrop-blur group-hover:block group-focus-within:block dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-300">
                          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
                            {getToolTooltipText(tool)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {expandedTool && (
                <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-2 dark:border-zinc-700/70 dark:bg-zinc-900/40">
                  <ToolDetailPanel tool={expandedTool} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
