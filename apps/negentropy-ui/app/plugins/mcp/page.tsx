"use client";

import { useState, useEffect } from "react";
import { PluginsNav } from "@/components/ui/PluginsNav";
import { McpServerCard } from "./_components/McpServerCard";
import { McpServerFormDialog } from "./_components/McpServerFormDialog";

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

export default function McpServersPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);

  const fetchServers = async () => {
    try {
      const response = await fetch("/api/plugins/mcp/servers");
      if (!response.ok) {
        throw new Error("Failed to fetch servers");
      }
      const data = await response.json();
      setServers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleCreate = () => {
    setEditingServer(null);
    setDialogOpen(true);
  };

  const handleEdit = (server: McpServer) => {
    setEditingServer(server);
    setDialogOpen(true);
  };

  const handleDelete = async (serverId: string) => {
    if (!confirm("Are you sure you want to delete this server?")) {
      return;
    }
    try {
      const response = await fetch(`/api/plugins/mcp/servers/${serverId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete server");
      }
      fetchServers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingServer(null);
  };

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    try {
      const url = editingServer
        ? `/api/plugins/mcp/servers/${editingServer.id}`
        : "/api/plugins/mcp/servers";
      const method = editingServer ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save server");
      }

      handleDialogClose();
      fetchServers();
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <PluginsNav title="MCP Servers" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  MCP Servers
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Manage Model Context Protocol servers for external tool integration.
                </p>
              </div>
              <button
                onClick={handleCreate}
                className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Add Server
              </button>
            </div>

            {loading ? (
              <div className="text-sm text-zinc-500">Loading...</div>
            ) : error ? (
              <div className="text-sm text-red-500">{error}</div>
            ) : servers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-zinc-400 dark:text-zinc-500 mb-4">
                  No MCP servers registered yet.
                </div>
                <button
                  onClick={handleCreate}
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                >
                  Add your first server →
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {servers.map((server) => (
                  <McpServerCard
                    key={server.id}
                    server={server}
                    onEdit={() => handleEdit(server)}
                    onDelete={() => handleDelete(server.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <McpServerFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleFormSubmit}
        server={editingServer}
      />
    </div>
  );
}
