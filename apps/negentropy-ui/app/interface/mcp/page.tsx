"use client";

import { useState, useEffect } from "react";
import { MCP_HUB_LABEL } from "@/app/interface/copy";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { McpServerCard } from "./_components/McpServerCard";
import { McpServerFormDialog } from "./_components/McpServerFormDialog";
import { McpServerTrialDialog } from "./_components/McpServerTrialDialog";

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

interface ServerWithTools extends McpServer {
  tools?: McpTool[];
  loadingTools?: boolean;
  loadError?: string | null;
}

interface LoadToolsResponse {
  success: boolean;
  server_id: string;
  tools: McpTool[];
  duration_ms: number;
  error?: string;
}

export default function McpServersPage() {
  const [servers, setServers] = useState<ServerWithTools[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [hasAutoRequestedTools, setHasAutoRequestedTools] = useState(false);
  const [trialServer, setTrialServer] = useState<McpServer | null>(null);

  const fetchServers = async () => {
    try {
      const response = await fetch("/api/interface/mcp/servers");
      if (!response.ok) {
        throw new Error("Failed to fetch servers");
      }
      const data = await response.json();
      setServers(data);
      setHasAutoRequestedTools(false);
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
      const response = await fetch(`/api/interface/mcp/servers/${serverId}`, {
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

  const handleLoadTools = async (serverId: string) => {
    // 设置加载状态
    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId ? { ...s, loadingTools: true, loadError: null } : s
      )
    );

    try {
      const response = await fetch(`/api/interface/mcp/servers/${serverId}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.error?.message || "Failed to load tools");
      }

      const data: LoadToolsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load tools");
      }

      // 更新 tools 数据和 tool_count
      setServers((prev) =>
        prev.map((s) =>
          s.id === serverId
            ? {
                ...s,
                tools: data.tools,
                loadingTools: false,
                tool_count: data.tools.length,
              }
            : s
        )
      );
      return data.tools;
    } catch (err) {
      setServers((prev) =>
        prev.map((s) =>
          s.id === serverId
            ? {
                ...s,
                loadingTools: false,
                loadError: err instanceof Error ? err.message : "Unknown error",
              }
            : s
        )
      );
      return [];
    }
  };

  useEffect(() => {
    if (loading || error || hasAutoRequestedTools || servers.length === 0) {
      return;
    }

    const enabledServerIds = servers
      .filter((server) => server.is_enabled)
      .map((server) => server.id);

    if (enabledServerIds.length === 0) {
      setHasAutoRequestedTools(true);
      return;
    }

    setHasAutoRequestedTools(true);
    enabledServerIds.forEach((serverId) => {
      void handleLoadTools(serverId);
    });
  }, [loading, error, hasAutoRequestedTools, servers]);

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingServer(null);
  };

  const handleTrialClose = () => {
    setTrialServer(null);
  };

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    try {
      const url = editingServer
        ? `/api/interface/mcp/servers/${editingServer.id}`
        : "/api/interface/mcp/servers";
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
      <InterfaceNav title={MCP_HUB_LABEL} />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {MCP_HUB_LABEL}
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
              <div
                data-testid="mcp-grid"
                className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              >
                {servers.map((server) => (
                  <div key={server.id} data-testid="mcp-grid-item">
                    <McpServerCard
                      server={server}
                      onTry={() => setTrialServer(server)}
                      onEdit={() => handleEdit(server)}
                      onDelete={() => handleDelete(server.id)}
                      onLoad={() => handleLoadTools(server.id)}
                      tools={server.tools}
                      loadingTools={server.loadingTools}
                      loadError={server.loadError}
                    />
                  </div>
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
      <McpServerTrialDialog
        isOpen={trialServer !== null}
        server={trialServer}
        tools={trialServer ? servers.find((server) => server.id === trialServer.id)?.tools || [] : []}
        onClose={handleTrialClose}
        onEnsureTools={async (serverId) => {
          await handleLoadTools(serverId);
        }}
      />
    </div>
  );
}
