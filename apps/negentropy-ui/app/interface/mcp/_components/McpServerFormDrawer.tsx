/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import {
  useState,
  useEffect,
  useId,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { BaseDrawer } from "@/components/ui/BaseDrawer";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";

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

interface McpServerFormDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  server: McpServer | null;
}

const EMPTY_FORM = {
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
};

export function McpServerFormDrawer({
  open,
  onClose,
  onSubmit,
  server,
}: McpServerFormDrawerProps) {
  const formId = useId();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 脏检基线 ──
  const [baseline, setBaseline] = useState(EMPTY_FORM);
  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(baseline),
    [formData, baseline],
  );

  const { confirm, confirmDialog } = useConfirmDialog();
  const confirmingRef = useRef(false);

  const requestClose = useCallback(async () => {
    if (confirmingRef.current) return;
    if (!isDirty) {
      onClose();
      return;
    }
    confirmingRef.current = true;
    const ok = await confirm({
      title: "Discard changes?",
      message: "You have unsaved changes. Closing now will discard them.",
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
      destructive: true,
    });
    confirmingRef.current = false;
    if (ok) onClose();
  }, [isDirty, confirm, onClose]);

  // Escape 键关闭（脏检确认）
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") void requestClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, requestClose]);

  useEffect(() => {
    if (server) {
      const seeded = {
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
      };
      setFormData(seeded);
      setBaseline(seeded);
    } else {
      setFormData(EMPTY_FORM);
      setBaseline(EMPTY_FORM);
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
      setBaseline(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BaseDrawer
        open={open}
        title={server ? "Edit MCP Server" : "Add MCP Server"}
        subtitle="Configure transport and runtime options with a consistent, scannable interface form layout."
        onClose={() => void requestClose()}
        closeOnBackdrop={!loading}
        closeOnEscape={false}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => void requestClose()}
            >
              Cancel
            </Button>
            <Button
              variant="neutral"
              type="submit"
              form={formId}
              disabled={loading}
            >
              {loading ? "Saving..." : server ? "Update" : "Create"}
            </Button>
          </div>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-6 px-5 py-5">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Basic Information
            </h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                  placeholder="my-mcp-server"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                  placeholder="My MCP Server"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                  rows={2}
                  placeholder="Description of this MCP server"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Runtime Setup
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Transport Type *
                </label>
                <select
                  value={formData.transport_type}
                  onChange={(e) => setFormData({ ...formData, transport_type: e.target.value })}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                >
                  <option value="stdio">STDIO</option>
                  <option value="http">HTTP (Streamable)</option>
                  <option value="sse">SSE</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Visibility
                </label>
                <select
                  value={formData.visibility}
                  onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                >
                  <option value="private">Private</option>
                  <option value="shared">Shared</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={formData.is_enabled}
                    onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                    className="rounded border-border"
                  />
                  Enabled
                </label>
              </div>
              <div className="flex items-end">
                <label className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={formData.auto_start}
                    onChange={(e) => setFormData({ ...formData, auto_start: e.target.checked })}
                    className="rounded border-border"
                  />
                  Auto-start
                </label>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Connection Details
            </h3>

            {formData.transport_type === "stdio" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Command *
                  </label>
                  <input
                    type="text"
                    value={formData.command}
                    onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                    placeholder="npx"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Arguments (one per line)
                  </label>
                  <textarea
                    value={formData.args}
                    onChange={(e) => setFormData({ ...formData, args: e.target.value })}
                    className="min-h-[200px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                    rows={7}
                    placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/path/to/allowed/dir"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Environment Variables (JSON)
                  </label>
                  <textarea
                    value={formData.env}
                    onChange={(e) => setFormData({ ...formData, env: e.target.value })}
                    className="min-h-[200px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                    rows={7}
                    placeholder='{"API_KEY": "xxx"}'
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    URL *
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                    placeholder={formData.transport_type === "http"
                      ? "http://localhost:8080/mcp"
                      : "http://localhost:8080/sse"}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Headers (JSON)
                  </label>
                  <textarea
                    value={formData.headers}
                    onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                    className="min-h-[200px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                    rows={7}
                    placeholder='{"Authorization": "Bearer xxx"}'
                  />
                </div>
              </div>
            )}
          </section>
        </form>
      </BaseDrawer>
      {confirmDialog}
    </>
  );
}
