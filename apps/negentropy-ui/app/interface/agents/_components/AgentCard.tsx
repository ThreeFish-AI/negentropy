"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { SortableCardWrapper, SortableDragHandle } from "@/components/ui/SortableCardWrapper";
import { Trash2 } from "lucide-react";

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

interface AgentCardProps {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
}

export function AgentCard({ agent, onEdit, onDelete }: AgentCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;
  const canEdit = isAdmin || !agent.is_builtin;

  return (
    <SortableCardWrapper
      id={agent.id}
      onEdit={canEdit ? onEdit : undefined}
      canEdit={canEdit}
    >
      <div className="relative z-20 flex min-h-0 flex-1 flex-col pointer-events-none">
        {/* Header: drag handle + title + delete */}
        <div className="mb-1 flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-1">
            <SortableDragHandle />
            <h3 className="truncate text-lg font-semibold text-foreground">
              {agent.display_name || agent.name}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete Agent"
                aria-label={`Delete ${agent.display_name || agent.name}`}
                className="pointer-events-auto cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="mb-1 flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden whitespace-nowrap pl-6">
          {agent.is_enabled ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Enabled
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
              Disabled
            </span>
          )}
          <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
            {agent.agent_type}
          </span>
          <span className="inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {agent.visibility}
          </span>
          {agent.kind === "root" && (
            <span
              className="inline-flex shrink-0 items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
              title="Negentropy 主 Agent，编辑后通过 InstructionProvider 在运行时生效"
            >
              Root
            </span>
          )}
          {agent.is_builtin && (
            <span
              className="inline-flex min-w-0 items-center truncate rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              title="系统内置：对全员可见，仅 admin 可编辑"
            >
              Built-In
            </span>
          )}
        </div>

        {/* Description */}
        <p
          className="mb-1 pl-6 pr-2 h-[60px] min-w-0 overflow-hidden leading-5 line-clamp-3 text-sm text-text-muted"
          title={agent.description || "No description"}
        >
          {agent.description || "No description"}
        </p>

        {/* Footer metadata */}
        <div className="mt-auto flex ml-6 min-w-0 flex-nowrap items-center gap-3 overflow-hidden whitespace-nowrap pt-1 text-xs text-text-muted">
          {agent.model && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate" title={agent.model}>
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="truncate">{agent.model}</span>
            </span>
          )}
          {"agent_class" in agent.adk_config &&
            typeof agent.adk_config["agent_class"] === "string" && (
            <span
              className="inline-flex min-w-0 items-center gap-1 truncate"
              title={String(agent.adk_config["agent_class"])}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="truncate">{String(agent.adk_config["agent_class"])}</span>
            </span>
          )}
          {agent.tools && agent.tools.length > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {agent.tools.length} tools
            </span>
          )}
          <span className="inline-flex min-w-0 items-center gap-1 truncate" title={`source: ${agent.source}`}>
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="truncate">source: {agent.source}</span>
          </span>
        </div>
      </div>
    </SortableCardWrapper>
  );
}
