/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ToolCard } from "./_components/ToolCard";
import { ToolFormDialog } from "./_components/ToolFormDialog";

interface BuiltinTool {
  id: string;
  owner_id: string;
  visibility: string;
  name: string;
  display_name: string | null;
  description: string | null;
  tool_type: string;
  version: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  config_schema: Record<string, unknown>;
  is_enabled: boolean;
  is_system: boolean;
}

export default function ToolsPage() {
  const [tools, setTools] = useState<BuiltinTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<BuiltinTool | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BuiltinTool | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      const response = await fetch("/api/interface/tools");
      if (!response.ok) {
        throw new Error("Failed to fetch tools");
      }
      const data = await response.json();
      setTools(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTools();
  }, [fetchTools]);

  const handleCreate = () => {
    setEditingTool(null);
    setDialogOpen(true);
  };

  const handleEdit = (tool: BuiltinTool) => {
    setEditingTool(tool);
    setDialogOpen(true);
  };

  const handleDeleteRequest = (tool: BuiltinTool) => {
    if (tool.is_system) {
      toast.error("System tools cannot be deleted, only disabled");
      return;
    }
    setPendingDelete(tool);
  };

  const handleDeleteConfirmed = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      const response = await fetch(`/api/interface/tools/${target.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let message = "Failed to delete tool";
        try {
          const body = await response.json();
          message = body?.detail || body?.message || message;
        } catch {
          // body not JSON
        }
        throw new Error(message);
      }
      toast.success(`Deleted tool "${target.display_name || target.name}"`);
      setPendingDelete(null);
      void fetchTools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleEnabled = async (tool: BuiltinTool) => {
    setTogglingId(tool.id);
    const next = !tool.is_enabled;
    try {
      const response = await fetch(`/api/interface/tools/${tool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: next }),
      });
      if (!response.ok) {
        let message = "Failed to update tool";
        try {
          const body = await response.json();
          message = body?.detail || body?.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      toast.success(`${next ? "Enabled" : "Disabled"} "${tool.display_name || tool.name}"`);
      void fetchTools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingTool(null);
  };

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    const url = editingTool
      ? `/api/interface/tools/${editingTool.id}`
      : "/api/interface/tools";
    const method = editingTool ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let message = "Failed to save tool";
      try {
        const body = await response.json();
        message = body?.detail || body?.message || message;
      } catch {
        // body not JSON
      }
      toast.error(message);
      throw new Error(message);
    }

    toast.success(
      editingTool
        ? `Updated tool "${(data.display_name as string) || (data.name as string)}"`
        : `Created tool "${(data.display_name as string) || (data.name as string)}"`,
    );
    handleDialogClose();
    void fetchTools();
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Tools" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Tools
                </h1>
                <p className="text-sm text-text-muted">
                  Configure builtin tool integrations for your AI agents.
                </p>
              </div>
              <button
                onClick={handleCreate}
                className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Add Tool
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-[196px] rounded-xl border border-border bg-card p-4"
                  >
                    <Skeleton className="mb-3 h-5 w-1/3" />
                    <div className="mb-2 flex gap-2">
                      <Skeleton className="h-4 w-16 rounded-full" />
                      <Skeleton className="h-4 w-12 rounded-full" />
                    </div>
                    <Skeleton className="mb-1 h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <ErrorState
                title="Failed to load tools"
                description={error}
                onRetry={fetchTools}
              />
            ) : tools.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="No tools configured yet"
                action={
                  <button
                    onClick={handleCreate}
                    className="text-sm text-text-secondary hover:text-foreground transition-colors"
                  >
                    Configure your first tool →
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {tools.map((tool) => (
                  <div key={tool.id} className="h-[196px]">
                    <ToolCard
                      tool={tool}
                      onEdit={() => handleEdit(tool)}
                      onDelete={() => handleDeleteRequest(tool)}
                      onToggleEnabled={() => handleToggleEnabled(tool)}
                      toggling={togglingId === tool.id}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ToolFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleFormSubmit}
        tool={editingTool}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete tool?"
        message={
          pendingDelete
            ? `"${pendingDelete.display_name || pendingDelete.name}" will be permanently removed. This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
