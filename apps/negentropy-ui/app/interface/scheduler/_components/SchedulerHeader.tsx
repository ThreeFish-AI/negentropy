"use client";

import { Button } from "@/components/ui/Button";
import {
  navPillClassName,
  navRailContainerClassName,
} from "@/components/ui/nav-styles";

interface SchedulerHeaderProps {
  connected: boolean;
  activeTab: string;
  onTabChange: (tab: "tasks" | "executions" | "stats") => void;
  onRefresh: () => void;
  loading: boolean;
  onCreateTask?: () => void;
}

const TABS: { key: "tasks" | "executions" | "stats"; label: string }[] = [
  { key: "tasks", label: "Tasks" },
  { key: "executions", label: "Executions" },
  { key: "stats", label: "Stats" },
];

export function SchedulerHeader({
  connected,
  activeTab,
  onTabChange,
  onRefresh,
  loading,
  onCreateTask,
}: SchedulerHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Scheduler
        </h1>
        <p className="text-sm text-text-muted">
          Unified task scheduling and execution management
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* New Task button */}
        {onCreateTask && (
          <Button
            variant="neutral"
            size="sm"
            onClick={onCreateTask}
            leftIcon={
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            New Task
          </Button>
        )}
        {/* Tab pills */}
        <div className={navRailContainerClassName}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={navPillClassName(activeTab === tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? "bg-emerald-500" : "bg-text-muted animate-pulse"
            }`}
          />
          {connected ? "Live" : "Reconnecting..."}
        </div>

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          leftIcon={
            <svg
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          }
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
