"use client";

import { ApiEndpoint, getMethodColor } from "@/features/knowledge/utils/api-specs";

interface EndpointCardProps {
  endpoint: ApiEndpoint;
  isSelected: boolean;
  onClick: () => void;
}

export function EndpointCard({ endpoint, isSelected, onClick }: EndpointCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        isSelected
          ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
          : "border-border bg-card hover:border-foreground/20 hover:bg-muted"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getMethodColor(
            endpoint.method
          )}`}
        >
          {endpoint.method}
        </span>
        <span className="flex-1 truncate text-xs font-medium text-foreground">
          {endpoint.summary}
        </span>
      </div>
      <p className="mt-1.5 truncate text-[11px] font-mono text-text-muted">
        {endpoint.path}
      </p>
    </button>
  );
}
