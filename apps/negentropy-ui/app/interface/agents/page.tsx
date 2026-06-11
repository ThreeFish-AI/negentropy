/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Bot } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { AgentCard } from "./_components/AgentCard";
import { AgentFormDialog } from "./_components/AgentFormDialog";

interface Agent {
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
  kind?: "root" | "agent";
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
  const [manualOrder, setManualOrder] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fetchAgents = async () => {
    try {
      const response = await fetch("/api/interface/agents");
      if (!response.ok) {
        throw new Error("Failed to fetch agents");
      }
      const data = await response.json();
      setAgents(data);
      setManualOrder(false);
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

  const sortedAgents = useMemo(() => {
    if (manualOrder) return agents;
    const rank = (agent: Agent) => (agent.kind === "root" ? 0 : 1);
    return [...agents].sort((a, b) => {
      const diff = rank(a) - rank(b);
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name);
    });
  }, [agents, manualOrder]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setManualOrder(true);
      setAgents((prev) => {
        const oldIndex = prev.findIndex((a) => a.id === active.id);
        const newIndex = prev.findIndex((a) => a.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    },
    [],
  );

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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortedAgents.map((a) => a.id)}
                  strategy={rectSortingStrategy}
                >
                  <div
                    data-testid="agents-grid"
                    className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                  >
                    {sortedAgents.map((agent) => (
                      <div key={agent.id} className="h-[176px]" data-testid="agent-grid-item">
                        <AgentCard
                          agent={agent}
                          onEdit={() => handleEdit(agent)}
                          onDelete={() => handleDelete(agent.id)}
                        />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      <AgentFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleFormSubmit}
        agent={editingAgent}
      />
      {confirmDialog}
    </div>
  );
}
