"use client";

import { useState, useEffect } from "react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

interface McpServer {
  id: string;
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
  visibility: string;
}

interface McpServerFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  server: McpServer | null;
}

export function McpServerFormDialog({
  open,
  onClose,
  onSubmit,
  server,
}: McpServerFormDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    description: "",
    transport_type: "stdio",
    command: "",
    args: "",
    env: "",
    url: "",
    headers: "",
    is_enabled: true,
    auto_start: false,
    visibility: "private",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (server) {
      setFormData({
        name: server.name,
        display_name: server.display_name || "",
        description: server.description || "",
        transport_type: server.transport_type,
        command: server.command || "",
        args: Array.isArray(server.args) ? server.args.join("\n") : "",
        env: typeof server.env === "object" ? JSON.stringify(server.env, null, 2) : "{}",
        url: server.url || "",
        headers: typeof server.headers === "object" ? JSON.stringify(server.headers, null, 2) : "{}",
        is_enabled: server.is_enabled,
        auto_start: server.auto_start,
        visibility: server.visibility,
      });
    } else {
      setFormData({
        name: "",
        display_name: "",
        description: "",
        transport_type: "stdio",
        command: "",
        args: "",
        env: "{}",
        url: "",
        headers: "{}",
        is_enabled: true,
        auto_start: false,
        visibility: "private",
      });
    }
    setError(null);
  }, [server, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data: Record<string, unknown> = {
        name: formData.name,
        display_name: formData.display_name || null,
        description: formData.description || null,
        transport_type: formData.transport_type,
        is_enabled: formData.is_enabled,
        auto_start: formData.auto_start,
        visibility: formData.visibility,
      };

      if (formData.transport_type === "stdio") {
        data.command = formData.command || null;
        data.args = formData.args
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        try {
          data.env = JSON.parse(formData.env || "{}");
        } catch {
          throw new Error("Invalid JSON in environment variables");
        }
      } else {
        data.url = formData.url || null;
        try {
          data.headers = JSON.parse(formData.headers || "{}");
        } catch {
          throw new Error("Invalid JSON in headers");
        }
      }

      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <OverlayDismissLayer
      open={open}
      onClose={onClose}
      busy={loading}
      backdropClassName="bg-black/55"
      containerClassName="flex min-h-full items-start justify-center overflow-y-auto p-3 sm:p-6"
      contentClassName="my-3 flex max-h-[calc(100vh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)] dark:border-zinc-700 dark:bg-zinc-900"
    >
          <div className="border-b border-zinc-200 px-5 py-4 sm:px-6 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {server ? "Edit MCP Server" : "Add MCP Server"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Configure transport and runtime options with a consistent, scannable plugins form layout.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Basic Information
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="my-mcp-server"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="My MCP Server"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      rows={2}
                      placeholder="Description of this MCP server"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Runtime Setup
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Transport Type *
                    </label>
                    <select
                      value={formData.transport_type}
                      onChange={(e) => setFormData({ ...formData, transport_type: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      <option value="stdio">STDIO</option>
                      <option value="http">HTTP (Streamable)</option>
                      <option value="sse">SSE</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Visibility
                    </label>
                    <select
                      value={formData.visibility}
                      onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      <option value="private">Private</option>
                      <option value="shared">Shared</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex w-full items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={formData.is_enabled}
                        onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                        className="rounded border-zinc-300 dark:border-zinc-600"
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="flex items-end">
                    <label className="flex w-full items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={formData.auto_start}
                        onChange={(e) => setFormData({ ...formData, auto_start: e.target.checked })}
                        className="rounded border-zinc-300 dark:border-zinc-600"
                      />
                      Auto-start
                    </label>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Connection Details
                </h3>

                {formData.transport_type === "stdio" ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Command *
                      </label>
                      <input
                        type="text"
                        value={formData.command}
                        onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        placeholder="npx"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Arguments (one per line)
                      </label>
                      <textarea
                        value={formData.args}
                        onChange={(e) => setFormData({ ...formData, args: e.target.value })}
                        className="min-h-[200px] w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        rows={7}
                        placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/path/to/allowed/dir"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Environment Variables (JSON)
                      </label>
                      <textarea
                        value={formData.env}
                        onChange={(e) => setFormData({ ...formData, env: e.target.value })}
                        className="min-h-[200px] w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        rows={7}
                        placeholder='{"API_KEY": "xxx"}'
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        URL *
                      </label>
                      <input
                        type="url"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        placeholder={formData.transport_type === "http"
                          ? "http://localhost:8080/mcp"
                          : "http://localhost:8080/sse"}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Headers (JSON)
                      </label>
                      <textarea
                        value={formData.headers}
                        onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                        className="min-h-[200px] w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        rows={7}
                        placeholder='{"Authorization": "Bearer xxx"}'
                      />
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-zinc-200 bg-white px-5 py-4 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading ? "Saving..." : server ? "Update" : "Create"}
              </button>
            </div>
          </form>
    </OverlayDismissLayer>
  );
}
