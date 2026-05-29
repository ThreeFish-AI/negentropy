"use client";

import { SidebarCard } from "./SidebarCard";

interface RetentionPolicyCardProps {
  policies: Record<string, unknown>;
}

export function RetentionPolicyCard({ policies }: RetentionPolicyCardProps) {
  return (
    <SidebarCard title="Retention Policy">
      <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground">
        {JSON.stringify(policies, null, 2)}
      </pre>
    </SidebarCard>
  );
}
