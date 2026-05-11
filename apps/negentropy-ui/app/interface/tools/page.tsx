"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <InterfaceNav title="Tools" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Tools
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Configure builtin tool integrations for your AI agents.
                </p>
              </div>
              <button
                onClick={handleCreate}
                className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Add Tool
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-[196px] animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="mb-3 h-5 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="mb-2 flex gap-2">
                      <div className="h-4 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                      <div className="h-4 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                    </div>
                    <div className="mb-1 h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div role="alert" className="text-sm text-red-500">
                {error}
              </div>
            ) : tools.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-zinc-400 dark:text-zinc-500 mb-4">
                  No tools configured yet.
                </div>
                <button
                  onClick={handleCreate}
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                >
                  Configure your first tool →
                </button>
              </div>
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
