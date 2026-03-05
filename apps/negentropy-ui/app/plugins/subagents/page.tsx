"use client";

import { useState, useEffect } from "react";
import { PluginsNav } from "@/components/ui/PluginsNav";
import { SubAgentCard } from "./_components/SubAgentCard";
import { SubAgentFormDialog } from "./_components/SubAgentFormDialog";

interface SubAgent {
  id: string;
  owner_id: string;
  visibility: string;
  name: string;
  display_name: string | null;
  description: string | null;
  agent_type: string;
  system_prompt: string | null;
  model: string | null;
  config: Record<string, unknown>;
  adk_config: Record<string, unknown>;
  skills: string[];
  tools: string[];
  source: string;
  is_builtin: boolean;
  is_enabled: boolean;
}

interface SyncResponse {
  created: number;
  updated: number;
  skipped: number;
}

export default function SubAgentsPage() {
  const [agents, setAgents] = useState<SubAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<SubAgent | null>(null);

  const fetchAgents = async () => {
    try {
      const response = await fetch("/api/plugins/subagents");
      if (!response.ok) {
        throw new Error("Failed to fetch subagents");
      }
      const data = await response.json();
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleCreate = () => {
    setEditingAgent(null);
    setDialogOpen(true);
  };

  const handleSyncNegentropy = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const response = await fetch("/api/plugins/subagents/sync/negentropy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to sync Negentropy subagents");
      }
      const data = (await response.json()) as SyncResponse;
      setSyncMessage(
        `Synced: created ${data.created}, updated ${data.updated}, skipped ${data.skipped}.`,
      );
      await fetchAgents();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "An error occurred during sync");
    } finally {
      setSyncing(false);
    }
  };

  const handleEdit = (agent: SubAgent) => {
    setEditingAgent(agent);
    setDialogOpen(true);
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm("Are you sure you want to delete this subagent?")) {
      return;
    }
    try {
      const response = await fetch(`/api/plugins/subagents/${agentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete subagent");
      }
      fetchAgents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingAgent(null);
  };

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    try {
      const url = editingAgent
        ? `/api/plugins/subagents/${editingAgent.id}`
        : "/api/plugins/subagents";
      const method = editingAgent ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save subagent");
      }

      handleDialogClose();
      fetchAgents();
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <PluginsNav title="SubAgents" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  SubAgents
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Configure ADK-compatible sub-agents for complex tasks.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncNegentropy}
                  disabled={syncing}
                  className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {syncing ? "Syncing..." : "Sync Negentropy 5"}
                </button>
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Add SubAgent
                </button>
              </div>
            </div>

            {syncMessage && (
              <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-100/60 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {syncMessage}
              </div>
            )}

            {loading ? (
              <div className="text-sm text-zinc-500">Loading...</div>
            ) : error ? (
              <div className="text-sm text-red-500">{error}</div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-zinc-400 dark:text-zinc-500 mb-4">
                  No subagents configured yet.
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleSyncNegentropy}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    Sync Negentropy 5 →
                  </button>
                  <button
                    onClick={handleCreate}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    Create manually →
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {agents.map((agent) => (
                  <SubAgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={() => handleEdit(agent)}
                    onDelete={() => handleDelete(agent.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <SubAgentFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleFormSubmit}
        agent={editingAgent}
      />
    </div>
  );
}
