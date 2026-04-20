"use client";

import { useEffect, useMemo, useState } from "react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { JsonViewer } from "@/components/ui/JsonViewer";

interface McpServer {
  id: string;
  name: string;
  display_name: string | null;
}

interface McpTool {
  id: string | null;
  name: string;
  title: string | null;
  display_name: string | null;
  description: string | null;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  is_enabled: boolean;
  call_count: number;
}

interface McpToolRunEvent {
  id: string;
  run_id: string;
  sequence_num: number;
  stage: string;
  status: string;
  title: string;
  detail: string | null;
  payload: Record<string, unknown>;
  duration_ms: number;
  timestamp: string | null;
}

interface McpToolRun {
  id: string;
  server_id: string;
  tool_id: string | null;
  tool_name: string;
  origin: string;
  status: string;
  created_by: string | null;
  request_payload: Record<string, unknown>;
  normalized_request_payload: Record<string, unknown>;
  result_payload: Record<string, unknown>;
  error_summary: string | null;
  duration_ms: number;
  started_at: string | null;
  ended_at: string | null;
  events?: McpToolRunEvent[];
}

interface ExecuteToolResponse {
  success: boolean;
  run: McpToolRun;
  error: string | null;
}

interface McpServerTrialDialogProps {
  isOpen: boolean;
  server: McpServer | null;
  tools: McpTool[];
  onClose: () => void;
  onEnsureTools: (serverId: string) => Promise<void>;
}

type FormMode = "guided" | "raw";

function classifyTool(toolName: string): string {
  if (toolName.includes("markdown")) return "Markdown 转换";
  if (toolName.includes("pdf")) return "PDF 转换";
  if (toolName === "get_server_metrics" || toolName === "clear_cache") return "运维";
  if (toolName.includes("extract") || toolName.includes("fill_")) return "抓取与抽取";
  return "页面探测";
}

function buildInitialValues(tool: McpTool | null): Record<string, unknown> {
  const properties = ((tool?.input_schema.properties as Record<string, Record<string, unknown>>) || {});
  const next: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(properties)) {
    if (schema.default !== undefined) {
      next[key] = schema.default;
      continue;
    }
    if (schema.type === "boolean") {
      next[key] = false;
      continue;
    }
    if (schema.type === "array") {
      next[key] = [];
      continue;
    }
    next[key] = "";
  }
  return next;
}

function buildRawJson(tool: McpTool | null): string {
  return JSON.stringify(buildInitialValues(tool), null, 2);
}

function formatTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function McpServerTrialDialog({
  isOpen,
  server,
  tools,
  onClose,
  onEnsureTools,
}: McpServerTrialDialogProps) {
  const [selectedToolName, setSelectedToolName] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("guided");
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [rawJson, setRawJson] = useState("{}");
  const [singlePdfFile, setSinglePdfFile] = useState<File | null>(null);
  const [batchPdfFiles, setBatchPdfFiles] = useState<File[]>([]);
  const [history, setHistory] = useState<McpToolRun[]>([]);
  const [activeRun, setActiveRun] = useState<McpToolRun | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !server) return;
    if (tools.length === 0) {
      void onEnsureTools(server.id);
    }
  }, [isOpen, server, tools.length, onEnsureTools]);

  const groupedTools = useMemo(() => {
    const groups = new Map<string, McpTool[]>();
    for (const tool of tools.filter((item) => item.is_enabled)) {
      const group = classifyTool(tool.name);
      const list = groups.get(group) || [];
      list.push(tool);
      groups.set(group, list);
    }
    return Array.from(groups.entries());
  }, [tools]);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.name === selectedToolName) || null,
    [selectedToolName, tools],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedToolName && tools.length > 0) {
      setSelectedToolName(tools[0].name);
    }
  }, [isOpen, selectedToolName, tools]);

  useEffect(() => {
    setFormValues(buildInitialValues(selectedTool));
    setRawJson(buildRawJson(selectedTool));
    setSinglePdfFile(null);
    setBatchPdfFiles([]);
    setError(null);
  }, [selectedToolName, selectedTool]);

  useEffect(() => {
    if (!isOpen || !server || !selectedTool) return;
    setHistoryLoading(true);
    void fetch(`/api/interface/mcp/servers/${server.id}/runs?tool_name=${selectedTool.name}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load execution history");
        }
        return response.json();
      })
      .then((runs: McpToolRun[]) => {
        setHistory(runs);
        setActiveRun((current) => current && current.tool_name === selectedTool.name ? current : runs[0] || null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load execution history");
      })
      .finally(() => setHistoryLoading(false));
  }, [isOpen, server, selectedTool]);

  const loadRunDetail = async (runId: string) => {
    const response = await fetch(`/api/interface/mcp/runs/${runId}`);
    if (!response.ok) {
      throw new Error("Failed to load run detail");
    }
    const detail: McpToolRun = await response.json();
    setActiveRun(detail);
  };

  const uploadTrialAsset = async (file: File) => {
    if (!server) {
      throw new Error("Server not selected");
    }
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(`/api/interface/mcp/servers/${server.id}/trial-assets`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error("Failed to upload trial asset");
    }
    const result = await response.json();
    return result.id as string;
  };

  const buildGuidedArguments = (): Record<string, unknown> => {
    const args: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(formValues)) {
      if (Array.isArray(value)) {
        if (value.length > 0) args[key] = value;
        continue;
      }
      if (value !== "" && value !== null && value !== undefined) {
        args[key] = value;
      }
    }
    return args;
  };

  const handleExecute = async () => {
    if (!server || !selectedTool) return;
    setExecuting(true);
    setError(null);

    try {
      const argumentsPayload =
        formMode === "raw" ? (JSON.parse(rawJson) as Record<string, unknown>) : buildGuidedArguments();
      const assetRefs: Record<string, unknown> = {};

      if (singlePdfFile) {
        assetRefs.pdf_source = await uploadTrialAsset(singlePdfFile);
      }
      if (batchPdfFiles.length > 0) {
        assetRefs.pdf_sources = await Promise.all(batchPdfFiles.map(uploadTrialAsset));
      }

      const response = await fetch(`/api/interface/mcp/servers/${server.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_name: selectedTool.name,
          arguments: argumentsPayload,
          asset_refs: assetRefs,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to execute tool");
      }
      const result: ExecuteToolResponse = await response.json();
      setActiveRun(result.run);
      await loadRunDetail(result.run.id);
      const historyResponse = await fetch(`/api/interface/mcp/servers/${server.id}/runs?tool_name=${selectedTool.name}`);
      if (historyResponse.ok) {
        const runs: McpToolRun[] = await historyResponse.json();
        setHistory(runs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute tool");
    } finally {
      setExecuting(false);
    }
  };

  const renderGuidedField = (name: string, schema: Record<string, unknown>) => {
    const label = schema.description ? `${name} · ${schema.description}` : name;
    if (name === "pdf_source") {
      return (
        <div key={name} className="space-y-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
          <input
            value={String(formValues[name] || "")}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [name]: event.target.value }))}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="PDF URL，或改用下方文件上传"
          />
          <input type="file" accept="application/pdf" onChange={(event) => setSinglePdfFile(event.target.files?.[0] || null)} />
        </div>
      );
    }
    if (name === "pdf_sources") {
      return (
        <div key={name} className="space-y-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
          <textarea
            value={Array.isArray(formValues[name]) ? (formValues[name] as string[]).join("\n") : ""}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                [name]: event.target.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              }))
            }
            rows={4}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="每行一个 PDF URL，或改用下方多文件上传"
          />
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={(event) => setBatchPdfFiles(Array.from(event.target.files || []))}
          />
        </div>
      );
    }

    const fieldType = schema.type;
    if (fieldType === "boolean") {
      return (
        <label key={name} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={Boolean(formValues[name])}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [name]: event.target.checked }))}
          />
          {label}
        </label>
      );
    }
    if (fieldType === "array") {
      return (
        <div key={name} className="space-y-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
          <textarea
            value={Array.isArray(formValues[name]) ? (formValues[name] as string[]).join("\n") : ""}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                [name]: event.target.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              }))
            }
            rows={4}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      );
    }
    if (fieldType === "object" || schema.additionalProperties || schema.anyOf) {
      return (
        <div key={name} className="space-y-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
          <textarea
            value={
              typeof formValues[name] === "string"
                ? String(formValues[name])
                : JSON.stringify(formValues[name] || {}, null, 2)
            }
            onChange={(event) => {
              const nextValue = event.target.value;
              setFormValues((prev) => {
                try {
                  return { ...prev, [name]: JSON.parse(nextValue) };
                } catch {
                  return { ...prev, [name]: nextValue };
                }
              });
            }}
            rows={6}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      );
    }
    return (
      <div key={name} className="space-y-2">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
        <input
          type={fieldType === "integer" || fieldType === "number" ? "number" : "text"}
          value={String(formValues[name] ?? "")}
          onChange={(event) =>
            setFormValues((prev) => ({
              ...prev,
              [name]:
                fieldType === "integer" || fieldType === "number"
                  ? Number(event.target.value)
                  : event.target.value,
            }))
          }
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
    );
  };

  if (!isOpen || !server) return null;

  return (
    <OverlayDismissLayer
      open={isOpen}
      onClose={onClose}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="flex h-[90vh] w-full max-w-[1400px] flex-col rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            试用 MCP Server: {server.display_name || server.name}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            白盒查看参数、执行阶段、结果与历史审计。
          </p>
        </div>
        <button onClick={onClose} className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          关闭
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <div className="col-span-3 flex min-h-0 flex-col rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="shrink-0 mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tools</div>
          <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
            {groupedTools.map(([group, items]) => (
              <div key={group}>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{group}</div>
                <div className="space-y-1">
                  {items.map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => setSelectedToolName(tool.name)}
                      className={`w-full rounded-lg border px-3 py-2 text-left ${
                        selectedToolName === tool.name
                          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                      }`}
                    >
                      <div className="font-mono text-xs">{tool.display_name || tool.title || tool.name}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">{tool.call_count} calls</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-4 flex min-h-0 flex-col rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="shrink-0 mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedTool?.display_name || selectedTool?.title || selectedTool?.name || "选择 Tool"}
              </div>
              <div className="line-clamp-3 text-xs text-zinc-500">{selectedTool?.description || "暂无描述"}</div>
            </div>
            <div className="flex shrink-0 gap-2 text-xs">
              <button
                className={`rounded px-2 py-1 ${formMode === "guided" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
                onClick={() => setFormMode("guided")}
              >
                表单
              </button>
              <button
                className={`rounded px-2 py-1 ${formMode === "raw" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
                onClick={() => setFormMode("raw")}
              >
                Raw JSON
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto space-y-3">
            {formMode === "raw" ? (
              <textarea
                value={rawJson}
                onChange={(event) => setRawJson(event.target.value)}
                className="h-72 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
            ) : (
              Object.entries(((selectedTool?.input_schema.properties as Record<string, Record<string, unknown>>) || {})).map(
                ([name, schema]) => renderGuidedField(name, schema),
              )
            )}

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Input Schema</div>
              <JsonViewer data={selectedTool?.input_schema || {}} />
            </div>
          </div>

          <div className="shrink-0 mt-3 flex items-center justify-between">
            <div className="text-xs text-red-500">{error}</div>
            <button
              onClick={handleExecute}
              disabled={!selectedTool || executing}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {executing ? "执行中..." : "试用该 Tool"}
            </button>
          </div>
        </div>

        <div className="col-span-5 grid min-h-0 grid-rows-[220px_minmax(0,1fr)] gap-4">
          <div className="flex min-h-0 flex-col rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="shrink-0 mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">执行历史</div>
            <div className="min-h-0 flex-1 overflow-y-auto space-y-2">
              {historyLoading ? (
                <div className="text-sm text-zinc-500">加载中...</div>
              ) : history.length === 0 ? (
                <div className="text-sm text-zinc-500">暂无执行历史</div>
              ) : (
                history.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => void loadRunDetail(run.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${
                      activeRun?.id === run.id
                        ? "border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                        : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{run.tool_name}</span>
                      <span className="text-[11px] text-zinc-500">{run.status}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {run.origin} · {run.duration_ms} ms · {formatTime(run.started_at)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="shrink-0 mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">白盒详情</div>
              <div className="text-xs text-zinc-500">{activeRun ? `${activeRun.status} · ${activeRun.duration_ms} ms` : "-"}</div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
              {!activeRun ? (
                <div className="text-sm text-zinc-500">选择一条执行记录查看详情</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
                      <div className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">原始参数</div>
                      <JsonViewer data={activeRun.request_payload} />
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
                      <div className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">归一化参数</div>
                      <JsonViewer data={activeRun.normalized_request_payload} />
                    </div>
                  </div>

                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
                    <div className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">结果</div>
                    <JsonViewer data={activeRun.result_payload} />
                  </div>

                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
                    <div className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">阶段时间线</div>
                    <div className="space-y-2">
                      {(activeRun.events || []).map((event) => (
                        <div key={event.id} className="rounded border border-zinc-200 p-2 dark:border-zinc-700">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-zinc-800 dark:text-zinc-100">
                              {event.sequence_num}. {event.title}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {event.stage} · {event.status}
                            </div>
                          </div>
                          {event.detail ? <div className="mt-1 text-xs text-zinc-500">{event.detail}</div> : null}
                          {Object.keys(event.payload || {}).length > 0 ? (
                            <div className="mt-2 rounded bg-zinc-100 p-2 dark:bg-zinc-950">
                              <JsonViewer data={event.payload} />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500">
                    开始时间：{formatTime(activeRun.started_at)} | 结束时间：{formatTime(activeRun.ended_at)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </OverlayDismissLayer>
  );
}
