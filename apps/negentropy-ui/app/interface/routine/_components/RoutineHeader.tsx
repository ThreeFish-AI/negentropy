"use client";

import { Button } from "@/components/ui/Button";

interface RoutineHeaderProps {
  connected: boolean;
  onRefresh: () => void;
  loading: boolean;
  onCreate: () => void;
  onFromPreset?: () => void;
}

export function RoutineHeader({ connected, onRefresh, loading, onCreate, onFromPreset }: RoutineHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Routine</h1>
        <p className="text-sm text-text-muted">
          Long-horizon autonomous task execution — Engine orchestrates, Claude Code executes
        </p>
      </div>

      <div className="flex items-center gap-3">
        {onFromPreset && (
          <Button
            variant="outline"
            size="sm"
            onClick={onFromPreset}
          >
            Template
          </Button>
        )}

        <Button
          variant="neutral"
          size="sm"
          onClick={onCreate}
          leftIcon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          New Routine
        </Button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? "bg-emerald-500" : "bg-text-muted animate-pulse"
            }`}
          />
          {connected ? "Live" : "Reconnecting..."}
        </div>

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
