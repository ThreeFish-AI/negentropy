/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot } from "lucide-react";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { SortableCardGrid } from "@/components/ui/SortableCardGrid";
import { useSortableCardGrid } from "@/app/interface/_hooks/useSortableCardGrid";
import { AgentCard } from "./_components/AgentCard";
import { AgentFormDrawer } from "./_components/AgentFormDrawer";
import type { Agent as AgentType } from "./_components/_types";

interface Agent extends AgentType {
  owner_id: string;
  adk_config: Record<string, unknown>;
  source: string;
  is_builtin: boolean;
  kind?: "root" | "agent";
  sort_order?: number;
}

interface SyncResponse {
  created: number;
  updated: number;
  skipped: number;
}

export default function AgentsPage() {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const fetchAgents = async () => {
    try {
      const response = await fetch("/api/interface/agents");
      if (!response.ok) {
        throw new Error("Failed to fetch agents");
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
      const response = await fetch("/api/interface/agents/sync/negentropy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to sync Negentropy agents");
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

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setDialogOpen(true);
  };

  const handleDelete = async (agentId: string) => {
    const confirmed = await confirm({
      title: "Delete Agent",
      message: "Are you sure you want to delete this agent?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      const response = await fetch(`/api/interface/agents/${agentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete agent");
      }
      fetchAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingAgent(null);
  };

  // 后端已按 sort_order ASC 返回；若所有 sort_order 为默认值 0（从未拖拽过），
  // 则做前端兜底排序：root 置顶 + name 字母序。
  const sortedAgents = useMemo(() => {
    const hasCustomOrder = agents.some((a) => (a.sort_order ?? 0) !== 0);
    if (hasCustomOrder) return agents;
    const rank = (agent: Agent) => (agent.kind === "root" ? 0 : 1);
    return [...agents].sort((a, b) => {
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [agents]);

  const { sortableItemIds, handleDragEnd } = useSortableCardGrid({
    items: sortedAgents,
    onReorder: (reordered) => {
      setAgents(reordered as Agent[]);
      fetch("/api/interface/agents/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: reordered.map((a) => ({ id: a.id, sort_order: a.sort_order })),
        }),
      }).catch(() => {
        fetchAgents();
      });
    },
  });

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    try {
      const url = editingAgent
        ? `/api/interface/agents/${editingAgent.id}`
        : "/api/interface/agents";
      const method = editingAgent ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save agent");
      }

      handleDialogClose();
      fetchAgents();
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Agents" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="w-full">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Agents
                </h1>
                <p className="text-sm text-text-muted">
                  Configure ADK-compatible agents for complex tasks.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSyncNegentropy}
                  loading={syncing}
                >
                  {syncing ? "Syncing..." : "Sync Negentropy"}
                </Button>
                <Button variant="neutral" onClick={handleCreate}>
                  Add Agent
                </Button>
              </div>
            </div>

            {syncMessage && (
              <div className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-text-secondary">
                {syncMessage}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" label="Loading agents" className="text-text-muted" />
              </div>
            ) : error ? (
              <ErrorState
                title="Failed to load agents"
                description={error}
                onRetry={fetchAgents}
              />
            ) : agents.length === 0 ? (
              <EmptyState
                icon={Bot}
                title="No agents configured yet"
                description="Sync Negentropy's built-in agents or create one manually."
                action={
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleSyncNegentropy}>
                      Sync Negentropy
                    </Button>
                    <Button variant="neutral" size="sm" onClick={handleCreate}>
                      Create manually
                    </Button>
                  </div>
                }
              />
            ) : (
              <SortableCardGrid
                itemIds={sortableItemIds}
                onDragEnd={handleDragEnd}
                data-testid="agents-grid"
              >
                {sortedAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={() => handleEdit(agent)}
                    onDelete={() => handleDelete(agent.id)}
                  />
                ))}
              </SortableCardGrid>
            )}
          </div>
        </div>
      </div>

      <AgentFormDrawer
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleFormSubmit}
        agent={editingAgent}
      />
      {confirmDialog}
    </div>
  );
}
