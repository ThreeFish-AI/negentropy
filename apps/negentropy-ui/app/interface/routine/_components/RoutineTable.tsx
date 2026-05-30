"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import type { RoutineDTO } from "@/features/routine";

import { routineStatusClass, scoreColorClass } from "./status-style";

interface RoutineTableProps {
  routines: RoutineDTO[];
  loading: boolean;
  onSelect: (r: RoutineDTO) => void;
}

export function RoutineTable({ routines, loading, onSelect }: RoutineTableProps) {
  if (loading && routines.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (routines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card py-12 text-center">
        <p className="text-sm text-text-muted">No routines yet. Create your first autonomous task.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Progress</th>
            <th className="px-4 py-2.5 font-medium">Best Score</th>
            <th className="px-4 py-2.5 font-medium">Cost</th>
            <th className="px-4 py-2.5 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {routines.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r)}
              className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{r.display_name || r.title}</div>
                <div className="text-[10px] text-text-muted">{r.key}</div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${routineStatusClass(r.status)}`}
                >
                  {r.status}
                </span>
                {r.termination_reason && (
                  <div className="mt-0.5 text-[10px] text-text-muted">{r.termination_reason}</div>
                )}
              </td>
              <td className="px-4 py-3 tabular-nums text-text-secondary">
                {r.iteration_count}
                {r.max_iterations ? ` / ${r.max_iterations}` : ""}
              </td>
              <td className={`px-4 py-3 font-semibold tabular-nums ${scoreColorClass(r.best_score)}`}>
                {r.best_score ?? "—"}
              </td>
              <td className="px-4 py-3 tabular-nums text-text-secondary">
                ${r.total_cost_usd.toFixed(3)}
                {r.max_cost_usd ? <span className="text-text-muted"> / ${r.max_cost_usd}</span> : null}
              </td>
              <td className="px-4 py-3 text-[11px] text-text-muted">
                {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
