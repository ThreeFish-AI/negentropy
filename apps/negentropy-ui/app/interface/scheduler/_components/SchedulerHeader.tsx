"use client";

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
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Scheduler
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Unified task scheduling and execution management
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* New Task button */}
        {onCreateTask && (
          <button
            onClick={onCreateTask}
            className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          >
            <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        )}
        {/* Tab pills */}
        <div className="flex items-center bg-muted/50 p-1 rounded-full">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
                activeTab === tab.key
                  ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? "bg-emerald-500" : "bg-zinc-400 animate-pulse"
            }`}
          />
          {connected ? "Live" : "Reconnecting..."}
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <svg
            className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
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
          Refresh
        </button>
      </div>
    </div>
  );
}
