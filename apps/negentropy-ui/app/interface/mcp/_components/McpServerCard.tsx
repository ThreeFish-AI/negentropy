"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { defaultRemarkPlugins, defaultRehypePlugins } from "@/utils/markdown-plugins";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { SortableCardWrapper, SortableDragHandle } from "@/components/ui/SortableCardWrapper";
import { useAuth } from "@/components/providers/AuthProvider";

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
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-3 [&_pre]:text-zinc-100 dark:[&_pre]:bg-zinc-900",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:text-text-secondary",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:text-text-secondary",
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
  $schema?: string;
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

interface McpToolIcon {
  src?: string;
  mimeType?: string;
  sizes?: string;
}

interface McpToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

interface McpToolExecution {
  taskSupport?: "forbidden" | "optional" | "required" | string;
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
      <p className="text-sm text-text-muted">{emptyText}</p>
    );
  }

  if (parsed.kind === "json") {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <JsonViewer data={parsed.value} />
      </div>
    );
  }

  return (
    <div className={`${MARKDOWN_CONTENT_CLASS} text-text-secondary`}>
      <ReactMarkdown remarkPlugins={defaultRemarkPlugins} rehypePlugins={defaultRehypePlugins}>{parsed.value}</ReactMarkdown>
    </div>
  );
}

function getSchemaDialectLabel(schema: Record<string, unknown>): string {
  const schemaNode = getSchemaNode(schema);
  if (!schemaNode || typeof schemaNode.$schema !== "string" || schemaNode.$schema.trim().length === 0) {
    return "JSON Schema 2020-12";
  }

  const parts = schemaNode.$schema.split("/");
  return parts[parts.length - 1] || schemaNode.$schema;
}

function SchemaSection({
  title,
  schema,
}: {
  title: string;
  schema: Record<string, unknown>;
}) {
  const rows = useMemo(() => collectSchemaRows(schema), [schema]);

  if (Object.keys(schema).length === 0) {
    return null;
  }

  const requiredCount = rows.filter((row) => row.required).length;

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-text-secondary">
          {title}
        </span>
        {rows.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-caption text-text-secondary">
            {rows.length} fields
          </span>
        )}
        <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-caption text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
          {getSchemaDialectLabel(schema)}
        </span>
        {requiredCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-caption text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            {requiredCount} required
          </span>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-[640px] w-full text-left text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Field
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Type
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Required
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Description
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Constraints
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.map((row) => (
                <tr key={row.path}>
                  <td className="px-3 py-2 font-mono text-foreground">
                    {row.path}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {row.type}
                  </td>
                  <td className="px-3 py-2">
                    {row.required ? (
                      <span className="text-rose-600 dark:text-rose-400">Yes</span>
                    ) : (
                      <span className="text-text-muted">No</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {row.description || "-"}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {row.constraints || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          Schema structure cannot be flattened. Use raw JSON view below.
        </p>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-text-muted hover:text-text-secondary">
          Raw JSON
        </summary>
        <div className="mt-2 rounded-md border border-border bg-card p-2">
          <JsonViewer data={schema} />
        </div>
      </details>
    </div>
  );
}

function isSafeIconSrc(src: string): boolean {
  if (src.startsWith("https://") || src.startsWith("http://")) {
    return true;
  }
  return /^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,/i.test(src);
}

function getPrimaryIcon(tool: McpTool): McpToolIcon | null {
  for (const candidate of tool.icons) {
    if (!isRecord(candidate)) {
      continue;
    }
    const icon = candidate as McpToolIcon;
    if (typeof icon.src === "string" && icon.src.length > 0 && isSafeIconSrc(icon.src)) {
      return icon;
    }
  }
  return null;
}

function getToolAnnotations(tool: McpTool): McpToolAnnotations {
  return isRecord(tool.annotations) ? (tool.annotations as McpToolAnnotations) : {};
}

function getToolExecution(tool: McpTool): McpToolExecution {
  return isRecord(tool.execution) ? (tool.execution as McpToolExecution) : {};
}

function getToolLabel(tool: McpTool): string {
  const annotations = getToolAnnotations(tool);
  return tool.title || annotations.title || tool.display_name || tool.name;
}

function getToolTooltipText(tool: McpTool): string {
  const text = tool.description?.trim();
  return text && text.length > 0 ? text : "No description";
}

function getBehaviorBadges(tool: McpTool): Array<{ label: string; tone: string }> {
  const annotations = getToolAnnotations(tool);
  const badges: Array<{ label: string; tone: string }> = [];

  if (annotations.readOnlyHint) {
    badges.push({
      label: "Read Only Hint",
      tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    });
  }
  if (annotations.destructiveHint) {
    badges.push({
      label: "Destructive Hint",
      tone: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    });
  }
  if (annotations.idempotentHint) {
    badges.push({
      label: "Idempotent Hint",
      tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    });
  }
  if (annotations.openWorldHint) {
    badges.push({
      label: "Open World Hint",
      tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    });
  }

  return badges;
}

function ToolDetailPanel({ tool }: { tool: McpTool }) {
  const primaryIcon = getPrimaryIcon(tool);
  const annotations = getToolAnnotations(tool);
  const behaviorBadges = getBehaviorBadges(tool);
  const execution = getToolExecution(tool);

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          {primaryIcon ? (
            // MCP icons come from dynamic server metadata, so Next/Image remote allowlists are not viable here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryIcon.src}
              alt=""
              aria-hidden="true"
              className="mt-0.5 h-9 w-9 rounded-lg border border-border bg-card object-contain p-1"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold text-text-muted">
              {getToolLabel(tool).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h4 className="font-mono text-sm font-semibold text-foreground">
              {getToolLabel(tool)}
            </h4>
            {(tool.title || annotations.title || tool.display_name) && (
              <p className="mt-0.5 font-mono text-caption text-text-muted">
                {tool.name}
              </p>
            )}
            {(tool.title || annotations.title) && tool.display_name && (
              <p className="mt-0.5 text-caption text-text-muted">
                Local display name: {tool.display_name}
              </p>
            )}
            {primaryIcon?.mimeType && (
              <p className="mt-0.5 text-caption text-text-muted">
                Icon: {primaryIcon.mimeType}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tool.is_enabled ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-caption font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Enabled
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-caption text-text-muted">
              Disabled
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-caption tabular-nums text-text-muted">
            {tool.call_count} calls
          </span>
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3">
        <RichTextContent content={tool.description} emptyText="No description" />
      </div>

      {(behaviorBadges.length > 0 || execution.taskSupport) && (
        <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-text-secondary">
              Tool Metadata
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-caption text-text-secondary">
              Hints
            </span>
          </div>
          {behaviorBadges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {behaviorBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ${badge.tone}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
          {execution.taskSupport && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
              <span className="font-medium text-text-secondary">
                Task support
              </span>
              <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-caption text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                {execution.taskSupport}
              </span>
            </div>
          )}
        </div>
      )}

      <SchemaSection title="Input Schema" schema={tool.input_schema} />
      <SchemaSection title="Output Schema" schema={tool.output_schema} />

      {Object.keys(tool.meta).length > 0 && (
        <details className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-text-secondary hover:text-foreground">
            Advanced Metadata
          </summary>
          <div className="mt-2 rounded-md border border-border bg-card p-2">
            <JsonViewer data={tool.meta} />
          </div>
        </details>
      )}
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
  resource_template_count: number;
  // 「系统内置」标识：后端从显式 is_system 列 / owner_id 前缀派生。
  is_builtin?: boolean;
}

interface McpTool {
  id: string | null;
  name: string;
  title: string | null;
  display_name: string | null;
  description: string | null;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  icons: Array<Record<string, unknown>>;
  annotations: Record<string, unknown>;
  execution: Record<string, unknown>;
  meta: Record<string, unknown>;
  is_enabled: boolean;
  call_count: number;
}

interface McpResourceTemplate {
  id: string | null;
  uri_template: string;
  name: string | null;
  title: string | null;
  description: string | null;
  mime_type: string | null;
  annotations: Record<string, unknown>;
  meta: Record<string, unknown>;
  is_enabled: boolean;
}

interface McpServerCardProps {
  server: McpServer;
  onTry: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLoad: () => void;
  tools?: McpTool[];
  resourceTemplates?: McpResourceTemplate[];
  loadingTools?: boolean;
  loadError?: string | null;
}

function getTemplateLabel(template: McpResourceTemplate): string {
  return template.title || template.name || template.uri_template;
}

function getTemplateTooltipText(template: McpResourceTemplate): string {
  const desc = template.description?.trim();
  if (desc && desc.length > 0) {
    return desc;
  }
  return template.uri_template;
}

function ResourceDetailPanel({ template }: { template: McpResourceTemplate }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold text-text-muted">
            R
          </div>
          <div>
            <h4 className="font-mono text-sm font-semibold text-foreground">
              {getTemplateLabel(template)}
            </h4>
            <p className="mt-0.5 font-mono text-caption text-text-muted">
              {template.uri_template}
            </p>
            {template.mime_type && (
              <p className="mt-0.5 text-caption text-text-muted">
                MIME: {template.mime_type}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {template.is_enabled ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-caption font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Enabled
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-caption text-text-muted">
              Disabled
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3">
        <RichTextContent content={template.description} emptyText="No description" />
      </div>

      {Object.keys(template.meta || {}).length > 0 && (
        <details className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-text-secondary hover:text-foreground">
            Advanced Metadata
          </summary>
          <div className="mt-2 rounded-md border border-border bg-card p-2">
            <JsonViewer data={template.meta} />
          </div>
        </details>
      )}
    </div>
  );
}

function formatTransportTypeLabel(transportType: string): string {
  if (transportType === "http") {
    return "HTTP(Streamable)";
  }

  return transportType;
}

function formatVisibilityLabel(visibility: string): string {
  if (visibility === "public") {
    return "Public";
  }

  return visibility;
}

export function McpServerCard({
  server,
  onTry,
  onEdit,
  onDelete,
  onLoad,
  tools = [],
  resourceTemplates = [],
  loadingTools = false,
  loadError = null,
}: McpServerCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;
  // 后端 _mcp_server_to_response 在显式 is_system 列与 owner_id 前缀间取并；
  // 前端做一次同步派生以兼容旧接口（is_builtin 字段缺失时回退 owner_id）。
  const isBuiltin = server.is_builtin ?? (server.owner_id || "").startsWith("system");
  const canEdit = isAdmin || !isBuiltin;

  const [showTools, setShowTools] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [expandedToolName, setExpandedToolName] = useState<string | null>(null);
  const [expandedTemplateUri, setExpandedTemplateUri] = useState<string | null>(null);
  const visibleToolCount = tools.length > 0 ? tools.length : server.tool_count;
  const visibleResourceTemplateCount =
    resourceTemplates.length > 0 ? resourceTemplates.length : server.resource_template_count;
  const showToolToggle = visibleToolCount > 0 || loadingTools;
  const showResourceToggle = visibleResourceTemplateCount > 0 || loadingTools;
  const summaryDescription = server.description?.trim() || "No description";
  const toolSummaryLabel =
    loadingTools && visibleToolCount === 0 ? "Loading tools..." : `${visibleToolCount} Tools`;
  const resourceSummaryLabel =
    loadingTools && visibleResourceTemplateCount === 0
      ? "Loading resources..."
      : `${visibleResourceTemplateCount} Resource Template${visibleResourceTemplateCount === 1 ? "" : "s"}`;

  const expandedTool = useMemo(
    () => tools.find((tool) => tool.name === expandedToolName) || null,
    [expandedToolName, tools]
  );
  const expandedTemplate = useMemo(
    () => resourceTemplates.find((tpl) => tpl.uri_template === expandedTemplateUri) || null,
    [expandedTemplateUri, resourceTemplates]
  );

  const handleToggleTools = () => {
    if (showTools) {
      setShowTools(false);
      setExpandedToolName(null);
      return;
    }

    setShowTools(true);
    if (tools.length === 0 && !loadingTools) {
      onLoad();
    }
  };

  const handleToggleResources = () => {
    if (showResources) {
      setShowResources(false);
      setExpandedTemplateUri(null);
      return;
    }

    setShowResources(true);
    if (resourceTemplates.length === 0 && !loadingTools) {
      onLoad();
    }
  };

  return (
    <div className="space-y-2">
      <SortableCardWrapper
        id={server.id}
        onEdit={canEdit ? onEdit : undefined}
        canEdit={canEdit}
      >
        <div className="relative z-20 flex min-h-0 flex-1 flex-col pointer-events-none">
          <div className="mb-1 flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-1">
              <SortableDragHandle />
              <h3 className="truncate text-lg font-semibold text-foreground">
                {server.display_name || server.name}
              </h3>
            </div>
            <div className="flex shrink-0 items-center gap-2 pointer-events-auto">
              <button
                onClick={(e) => { e.stopPropagation(); onTry(); }}
                className="cursor-pointer rounded-md p-2 text-text-muted transition-colors hover:bg-emerald-50 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                title="Try MCP Server"
                aria-label={`Try ${server.display_name || server.name}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-5.197-3.03A1 1 0 008 9.03v5.94a1 1 0 001.555.832l5.197-3.03a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onLoad(); }}
                disabled={loadingTools}
                className="cursor-pointer rounded-md p-2 text-text-muted transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                title="Load Tools from Server"
                aria-label={`Load tools for ${server.display_name || server.name}`}
              >
                {loadingTools ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    title="Edit Server"
                    aria-label={`Edit ${server.display_name || server.name}`}
                    className="cursor-pointer rounded-md p-2 text-text-muted transition-colors hover:bg-muted hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    title="Delete Server"
                    aria-label={`Delete ${server.display_name || server.name}`}
                    className="cursor-pointer rounded-md p-2 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mb-1 flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden whitespace-nowrap pl-6">
            {server.is_enabled ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Enabled
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                Disabled
              </span>
            )}
            {isBuiltin && (
              <span
                className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                title="系统内置：对全员可见，仅 admin 可编辑"
              >
                Built-In
              </span>
            )}
            <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              {formatTransportTypeLabel(server.transport_type)}
            </span>
            <span className="inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {formatVisibilityLabel(server.visibility)}
            </span>
            {server.auto_start && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Auto-start
              </span>
            )}
          </div>

          <p
            className="mb-1 pl-6 pr-2 h-[60px] min-w-0 overflow-hidden text-sm leading-5 text-text-muted line-clamp-3"
            title={summaryDescription}
          >
            {summaryDescription}
          </p>

          <div className="mt-auto ml-6 flex min-w-0 flex-nowrap items-center gap-3 overflow-hidden whitespace-nowrap pt-1 text-xs text-text-muted">
            {showToolToggle && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleToggleTools(); }}
                className="pointer-events-auto inline-flex shrink-0 cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-text-muted transition-colors hover:bg-muted hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={showTools}
                aria-label={`Toggle tools list for ${server.display_name || server.name}`}
                title="Toggle tools list"
              >
                {loadingTools ? (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V1a11 11 0 00-8 19l2-2.4A8 8 0 014 12z" />
                  </svg>
                ) : (
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${showTools ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                  {toolSummaryLabel}
                </span>
              </button>
            )}
            {!showToolToggle && (
              <span className="inline-flex shrink-0 items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
                {toolSummaryLabel}
              </span>
            )}
            {showResourceToggle && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleToggleResources(); }}
                className="pointer-events-auto inline-flex shrink-0 cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-text-muted transition-colors hover:bg-muted hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={showResources}
                aria-label={`Toggle resource templates list for ${server.display_name || server.name}`}
                title="Toggle resource templates list"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${showResources ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0v10l-8 4-8-4V7m16 0l-8 4m0 0L4 7m8 4v10"
                    />
                  </svg>
                  {resourceSummaryLabel}
                </span>
              </button>
            )}
          </div>
        </div>
      </SortableCardWrapper>

      {loadError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive" role="alert">
          {loadError}
        </div>
      )}

      {showTools && tools.length > 0 && (
        <div className="border-t border-border pt-2">
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="mb-2 text-xs text-text-muted">
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
                          setExpandedToolName((prev) => (prev === tool.name ? null : tool.name))
                        }
                        aria-expanded={isExpanded}
                        title={getToolTooltipText(tool)}
                        className={`inline-flex items-center rounded-lg border px-3 py-1.5 font-mono text-sm transition-colors ${
                          isExpanded
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                            : "border-border bg-muted text-text-secondary hover:bg-border/60 dark:hover:bg-border"
                        }`}
                      >
                        {getToolLabel(tool)}
                      </button>

                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-border bg-card/95 p-2 text-xs text-text-secondary shadow-lg backdrop-blur group-hover:block group-focus-within:block">
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
              <div className="rounded-xl border border-border/70 bg-muted/40 p-2">
                <ToolDetailPanel tool={expandedTool} />
              </div>
            )}
          </div>
        </div>
      )}

      {showResources && resourceTemplates.length > 0 && (
        <div className="border-t border-border pt-2">
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="mb-2 text-xs text-text-muted">
                Resource Templates 描述该 Server 提供的资源类别。具体实例（如{" "}
                <code className="font-mono">perceives://pdf/&lt;job_id&gt;/&lt;filename&gt;</code>）在工具调用时动态生成。
              </p>
              <div className="flex flex-wrap gap-2">
                {resourceTemplates.map((tpl) => {
                  const isExpanded = expandedTemplateUri === tpl.uri_template;

                  return (
                    <div key={tpl.uri_template} className="group relative">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTemplateUri((prev) =>
                            prev === tpl.uri_template ? null : tpl.uri_template
                          )
                        }
                        aria-expanded={isExpanded}
                        title={getTemplateTooltipText(tpl)}
                        className={`inline-flex items-center rounded-lg border px-3 py-1.5 font-mono text-sm transition-colors ${
                          isExpanded
                            ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-300"
                            : "border-border bg-muted text-text-secondary hover:bg-border/60 dark:hover:bg-border"
                        }`}
                      >
                        {getTemplateLabel(tpl)}
                      </button>

                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-border bg-card/95 p-2 text-xs text-text-secondary shadow-lg backdrop-blur group-hover:block group-focus-within:block">
                        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
                          {getTemplateTooltipText(tpl)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {expandedTemplate && (
              <div className="rounded-xl border border-border/70 bg-muted/40 p-2">
                <ResourceDetailPanel template={expandedTemplate} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
